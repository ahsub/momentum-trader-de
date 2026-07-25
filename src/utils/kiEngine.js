/**
 * KI Strategy Engine
 * Combines market regime (from Snapshot) with portfolio state
 * Generates actionable recommendations
 */

import { differenceInDays, parseISO } from 'date-fns';

const PRIORITIES = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

/**
 * Generate all recommendations based on portfolio + market context
 * @param {Object} portfolioSummary 
 * @param {Object} snapshot - from useSnapshotReader
 * @param {Array} positions - open positions
 * @returns {Array} - sorted recommendations
 */
export function generateRecommendations(portfolioSummary, snapshot, positions) {
  if (!portfolioSummary || !snapshot) return [];

  const recommendations = [];
  const { regime, riskScore } = snapshot.computed || {};

  // === 1. REGIME-BASED PORTFOLIO ALIGNMENT ===

  // CRITICAL: Portfolio not aligned with crisis
  if (regime === 'CRISIS') {
    if (portfolioSummary.portfolioDelta > 500) {
      recommendations.push({
        id: 'crisis-delta',
        priority: 'CRITICAL',
        category: 'RISK',
        title: '🔴 CRISIS: Portfolio zu bullisch',
        description: `Regime ist CRISIS, aber dein Portfolio-Delta ist +${portfolioSummary.portfolioDelta}. Das ist gefährlich.`,
        action: 'Reduziere Long-Exposure um 50% oder kaufe SPY-Puts als Hedge.',
        impact: 'Verhindert signifikante Drawdowns in Crash-Phasen.',
        triggeredBy: ['regime-crisis', 'high-delta'],
        regimeContext: regime
      });
    }

    // Check short options in crisis
    const shortOptions = positions.filter(p => 
      p.assetClass === 'OPTION' && p.netQuantity < 0
    );
    if (shortOptions.length > 0) {
      recommendations.push({
        id: 'crisis-short-options',
        priority: 'CRITICAL',
        category: 'RISK',
        title: '🔴 Short-Options in CRISIS gefährlich',
        description: `Du hast ${shortOptions.length} offene Short-Optionen. In CRISIS steigt IV explosiv.`,
        action: 'Schließe alle Short-Options sofort oder rolle auf sichere Strikes.',
        impact: 'Vermeidet Margin-Calls und unbegrenzte Verluste.',
        triggeredBy: ['regime-crisis', 'short-vega-exposure']
      });
    }
  }

  // HIGH: Elevated risk score with bullish portfolio
  if (riskScore >= 75 && portfolioSummary.portfolioDelta > 0) {
    recommendations.push({
      id: 'elevated-risk',
      priority: 'HIGH',
      category: 'RISK',
      title: '🟡 Hohes Risiko: Portfolio nicht hedged',
      description: `Risk Score ist ${riskScore}/100, aber Portfolio ist net-long.`,
      action: 'Reduziere Positionen oder füge defensiven Options-Overlay hinzu.',
      impact: 'Bessere Risk-Adjusted Returns.',
      triggeredBy: ['high-risk-score', 'positive-delta']
    });
  }

  // === 2. POSITION-SPECIFIC RECOMMENDATIONS ===

  positions.forEach(pos => {
    // Assignment risk
    if (pos.assignmentRisk === 'HIGH') {
      recommendations.push({
        id: `assignment-${pos.symbol}`,
        priority: 'CRITICAL',
        category: 'RISK',
        symbol: pos.underlying,
        title: `🔴 Assignment-Risiko: ${pos.underlying}`,
        description: `${pos.underlying} ${pos.optionType} Strike $${pos.strike} läuft in ${pos.daysToExpiry} Tagen aus. Underlying bei $${pos.marketPrice}.`,
        action: pos.optionType === 'PUT' 
          ? `Roll auf ${pos.daysToExpiry + 14} DTE, Strike $${Math.floor(pos.strike * 0.97)} oder akzeptiere Assignment.`
          : `Roll auf ${pos.daysToExpiry + 14} DTE, Strike $${Math.ceil(pos.strike * 1.03)} oder liefere Shares.`,
        impact: 'Kontrolliere ob du das Underlying halten willst.',
        triggeredBy: ['assignment-risk', 'dte-low']
      });
    }

    // DTE warning for short options
    if (pos.assetClass === 'OPTION' && pos.netQuantity < 0 && pos.daysToExpiry && pos.daysToExpiry <= 7 && pos.daysToExpiry > 1) {
      recommendations.push({
        id: `dte-warning-${pos.symbol}`,
        priority: 'HIGH',
        category: 'OPTIMIZATION',
        symbol: pos.underlying,
        title: `⏰ ${pos.underlying}: Option läuft bald ab`,
        description: `Short ${pos.optionType} auf ${pos.underlying}, ${pos.daysToExpiry} Tage bis Verfall.`,
        action: `Prüfe Roll auf 30-45 DTE für weiteren Premium-Ertrag.`,
        impact: 'Maximiert Theta-Decay-Einnahmen.',
        triggeredBy: ['dte-low', 'theta-decay']
      });
    }

    // Concentration risk
    if (pos.marketValue && portfolioSummary.totalValue > 0) {
      const posPercent = (Math.abs(pos.marketValue) / portfolioSummary.totalValue) * 100;
      if (posPercent > 25) {
        recommendations.push({
          id: `concentration-${pos.underlying}`,
          priority: 'HIGH',
          category: 'RISK',
          symbol: pos.underlying,
          title: `⚠️ Konzentration: ${pos.underlying} = ${posPercent.toFixed(1)}%`,
          description: `Dein ${pos.underlying}-Exposure ist ${posPercent.toFixed(1)}% des Portfolios. Empfohlen: <15%.`,
          action: 'Reduziere Position oder diversifiziere in andere Sektoren.',
          impact: 'Reduziert Einzelaktien-Risiko.',
          triggeredBy: ['concentration-risk']
        });
      }
    }
  });

  // === 3. OPPORTUNITY RECOMMENDATIONS ===

  // Cash deployment in bull quiet
  if (regime === 'BULL_QUIET' && portfolioSummary.cashPercent > 40) {
    recommendations.push({
      id: 'cash-deployment',
      priority: 'MEDIUM',
      category: 'OPPORTUNITY',
      title: '🟢 BULL_QUIET: Zu viel Cash',
      description: `${portfolioSummary.cashPercent.toFixed(1)}% Cash in BULL_QUIET-Regime. Vermisste Rendite.`,
      action: 'Erhöhe Equity-Exposure oder verkaufe CSPs auf Qualitätsaktien.',
      impact: 'Höhere Kapitalrendite in bullishen Phasen.',
      triggeredBy: ['regime-bull-quiet', 'high-cash']
    });
  }

  // Wheel opportunity check
  const assignedStocks = positions.filter(p => 
    p.assetClass === 'STOCK' && p.netQuantity > 0 && !p.openingTrades?.some(t => t.code?.includes('O') && t.assetClass === 'STK')
  );
  // Actually check for stocks without covered calls
  const stocksWithCC = new Set(
    positions.filter(p => p.strategy === 'COVERED_CALL').map(p => p.underlying)
  );
  const stocksWithoutCC = positions.filter(p => 
    p.assetClass === 'STOCK' && p.netQuantity >= 100 && !stocksWithCC.has(p.symbol)
  );

  if (regime === 'BULL_QUIET' && stocksWithoutCC.length > 0) {
    stocksWithoutCC.forEach(stock => {
      recommendations.push({
        id: `cc-opportunity-${stock.symbol}`,
        priority: 'MEDIUM',
        category: 'OPPORTUNITY',
        symbol: stock.symbol,
        title: `📈 CC-Opportunity: ${stock.symbol}`,
        description: `Du hast ${stock.netQuantity} Shares ${stock.symbol} ohne Covered Call.`,
        action: `Verkaufe OTM Call, 30 DTE, Delta 30. Geschätzter Premium: $${(stock.marketPrice * 0.015).toFixed(2)}/Share.`,
        impact: `Zusätzliches Einkommen: ~$${(stock.netQuantity * stock.marketPrice * 0.015).toFixed(0)}/Monat.`,
        triggeredBy: ['wheel-strategy', 'uncovered-shares']
      });
    });
  }

  // === 4. THETA OPTIMIZATION ===

  const totalTheta = portfolioSummary.portfolioTheta;
  if (totalTheta < -50) {
    recommendations.push({
      id: 'theta-optimization',
      priority: 'MEDIUM',
      category: 'OPTIMIZATION',
      title: `📉 Hoher Theta-Verlust: $${totalTheta}/Tag`,
      description: 'Dein Portfolio verliert täglich an Zeitwert. Prüfe Long-Optionen.',
      action: 'Schließe wertlose Long-Options oder konvertiere in Spreads.',
      impact: 'Reduziert Zeitwertverlust.',
      triggeredBy: ['negative-theta', 'long-options']
    });
  }

  // Sort by priority
  return recommendations.sort((a, b) => PRIORITIES[b.priority] - PRIORITIES[a.priority]);
}

/**
 * Generate alerts (time-sensitive notifications)
 * @param {Array} positions 
 * @param {Object} snapshot 
 * @returns {Array} - alerts
 */
export function generateAlerts(positions, snapshot) {
  const alerts = [];
  const today = new Date();

  positions.forEach(pos => {
    // Expiry today
    if (pos.expiry) {
      const expiryDate = parseISO(pos.expiry);
      const daysUntil = differenceInDays(expiryDate, today);

      if (daysUntil === 0 && pos.assetClass === 'OPTION' && pos.netQuantity < 0) {
        alerts.push({
          type: 'EXPIRY',
          severity: 'CRITICAL',
          symbol: pos.underlying,
          message: `${pos.underlying} ${pos.optionType} $${pos.strike} verfällt HEUTE!`,
          action: 'Schließen, rollen oder Assignment akzeptieren.'
        });
      }

      if (daysUntil === 1 && pos.assetClass === 'OPTION' && pos.netQuantity < 0) {
        alerts.push({
          type: 'EXPIRY',
          severity: 'HIGH',
          symbol: pos.underlying,
          message: `${pos.underlying} ${pos.optionType} $${pos.strike} verfällt MORGEN.`,
          action: 'Letzte Chance zum Rollen.'
        });
      }
    }

    // ITM warning for short options
    if (pos.assetClass === 'OPTION' && pos.netQuantity < 0) {
      const itm = pos.optionType === 'PUT' 
        ? pos.marketPrice < pos.strike 
        : pos.marketPrice > pos.strike;

      if (itm) {
        alerts.push({
          type: 'ITM',
          severity: 'HIGH',
          symbol: pos.underlying,
          message: `${pos.underlying} ${pos.optionType} $${pos.strike} ist ITM!`,
          action: 'Assignment-Risiko hoch. Prüfe Roll oder akzeptiere.'
        });
      }
    }
  });

  return alerts;
}
