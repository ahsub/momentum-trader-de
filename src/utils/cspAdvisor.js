/**
 * Cash Secured Put (CSP) Advisor
 * Recommends optimal put-selling setups based on market regime and options chain
 */

import { differenceInDays, addDays, format } from 'date-fns';

const DTE_TARGETS = {
  BULL_QUIET: { min: 21, max: 45, preferred: 30 },
  BULL_VOLATILE: { min: 30, max: 60, preferred: 45 },
  BEAR_QUIET: { min: 30, max: 60, preferred: 45 },
  BEAR_VOLATILE: { min: 45, max: 90, preferred: 60 },
  CRISIS: { min: 0, max: 0, preferred: 0 } // No new CSPs in crisis
};

const DELTA_TARGETS = {
  BULL_QUIET: { min: 0.15, max: 0.35, preferred: 0.30 },
  BULL_VOLATILE: { min: 0.10, max: 0.25, preferred: 0.20 },
  BEAR_QUIET: { min: 0.10, max: 0.25, preferred: 0.20 },
  BEAR_VOLATILE: { min: 0.05, max: 0.20, preferred: 0.15 },
  CRISIS: { min: 0, max: 0, preferred: 0 }
};

/**
 * Find optimal CSP setup for a given symbol
 * @param {Object} params
 * @param {string} params.symbol - Underlying symbol
 * @param {number} params.underlyingPrice - Current price
 * @param {number} params.availableCash - Cash available
 * @param {string} params.regime - Current market regime
 * @param {Array} params.optionsChain - Array of put options [{ strike, bid, ask, expiry, impliedVolatility, openInterest }]
 * @param {Array} params.supportLevels - Support levels from technical analysis
 * @returns {Object} - Recommendation
 */
export function findCSPSetup({
  symbol,
  underlyingPrice,
  availableCash,
  regime = 'BULL_QUIET',
  optionsChain = [],
  supportLevels = [],
  existingPositions = []
}) {
  // Check if we already have a CSP on this symbol
  const existingCSP = existingPositions.find(p => 
    p.underlying === symbol && p.strategy === 'CASH_SECURED_PUT' && p.isOpen
  );

  if (existingCSP) {
    return {
      recommendation: 'SKIP',
      reason: `Bereits ein CSP auf ${symbol} aktiv (Strike $${existingCSP.strike}, DTE ${existingCSP.daysToExpiry}).`,
      existingPosition: existingCSP
    };
  }

  // Regime check
  if (regime === 'CRISIS') {
    return {
      recommendation: 'AVOID',
      reason: 'CRISIS: Keine neuen Short-Puts. Cash behalten für Opportunities.',
      regime
    };
  }

  const dteTarget = DTE_TARGETS[regime] || DTE_TARGETS.BULL_QUIET;
  const deltaTarget = DELTA_TARGETS[regime] || DELTA_TARGETS.BULL_QUIET;

  // Filter puts by DTE
  const validPuts = optionsChain.filter(opt => {
    const dte = differenceInDays(new Date(opt.expiry), new Date());
    return dte >= dteTarget.min && dte <= dteTarget.max;
  });

  if (validPuts.length === 0) {
    return {
      recommendation: 'SKIP',
      reason: 'Keine passenden Put-Optionen im gewünschten DTE-Bereich gefunden.',
      dteTarget
    };
  }

  // Calculate delta approximation for each put
  // Simplified: Delta ≈ N(d1) where d1 ≈ ln(S/K) / (IV * sqrt(T))
  const putsWithMetrics = validPuts.map(put => {
    const dte = differenceInDays(new Date(put.expiry), new Date());
    const t = dte / 365;
    const iv = put.impliedVolatility || 0.30;

    // Approximate delta using moneyness and IV
    const moneyness = underlyingPrice / put.strike;
    const d1 = Math.log(moneyness) / (iv * Math.sqrt(t) + 0.001);
    const approxDelta = -Math.max(0.05, Math.min(0.50, 0.5 - d1 * 0.3));

    // Premium
    const premium = (put.bid + put.ask) / 2;
    const premiumPerContract = premium * 100;

    // Annualized return
    const cashRequired = put.strike * 100;
    const annualizedReturn = (premium / put.strike) * (365 / Math.max(dte, 1)) * 100;

    // Distance from support
    const nearestSupport = supportLevels.length > 0 
      ? supportLevels.filter(s => s < put.strike).sort((a, b) => b - a)[0]
      : null;
    const supportBuffer = nearestSupport 
      ? ((put.strike - nearestSupport) / put.strike) * 100 
      : null;

    // Risk score (0-100, lower is better)
    const deltaScore = Math.abs(Math.abs(approxDelta) - deltaTarget.preferred) * 100;
    const dteScore = Math.abs(dte - dteTarget.preferred) * 0.5;
    const returnScore = annualizedReturn < 10 ? 20 : annualizedReturn > 50 ? 15 : 0;
    const supportScore = supportBuffer && supportBuffer < 2 ? 25 : 0;
    const totalScore = deltaScore + dteScore + returnScore + supportScore;

    return {
      ...put,
      dte,
      approxDelta: Math.abs(approxDelta),
      premium,
      premiumPerContract,
      cashRequired,
      annualizedReturn,
      nearestSupport,
      supportBuffer,
      totalScore
    };
  });

  // Sort by score (ascending = best)
  putsWithMetrics.sort((a, b) => a.totalScore - b.totalScore);

  // Take top 3
  const topPicks = putsWithMetrics.slice(0, 3);

  if (topPicks.length === 0) {
    return {
      recommendation: 'SKIP',
      reason: 'Keine geeigneten Setups gefunden.',
    };
  }

  const best = topPicks[0];
  const contracts = Math.min(
    Math.floor(availableCash / best.cashRequired),
    10 // Max 10 contracts per trade
  );

  if (contracts === 0) {
    return {
      recommendation: 'SKIP',
      reason: `Nicht genug Cash für ${symbol} CSP. Benötigt: $${best.cashRequired.toLocaleString()} pro Contract.`,
      cashRequired: best.cashRequired
    };
  }

  return {
    recommendation: 'EXECUTE',
    symbol,
    strategy: 'CASH_SECURED_PUT',
    setup: {
      strike: best.strike,
      expiry: best.expiry,
      dte: best.dte,
      premium: best.premium.toFixed(2),
      premiumPerContract: best.premiumPerContract.toFixed(0),
      contracts,
      totalPremium: (best.premiumPerContract * contracts).toFixed(0),
      cashRequired: (best.cashRequired * contracts).toFixed(0),
      annualizedReturn: best.annualizedReturn.toFixed(1),
      approxDelta: best.approxDelta.toFixed(2),
      breakEven: (best.strike - best.premium).toFixed(2),
      supportBuffer: best.supportBuffer ? best.supportBuffer.toFixed(1) + '%' : 'N/A'
    },
    alternatives: topPicks.slice(1, 3).map(p => ({
      strike: p.strike,
      expiry: p.expiry,
      premium: p.premium.toFixed(2),
      annualizedReturn: p.annualizedReturn.toFixed(1),
      approxDelta: p.approxDelta.toFixed(2)
    })),
    rationale: [
      `Regime ${regime}: Ziel-Delta ${deltaTarget.preferred}, Ziel-DTE ${dteTarget.preferred}`,
      `Strike $${best.strike} = ${((best.strike / underlyingPrice - 1) * 100).toFixed(1)}% unter Spot`,
      `Jährliche Rendite: ${best.annualizedReturn.toFixed(1)}%`,
      best.supportBuffer 
        ? `Support-Buffer: ${best.supportBuffer.toFixed(1)}% über nächstem Support ($${best.nearestSupport})`
        : 'Kein Support-Level verfügbar'
    ],
    riskNotes: [
      best.annualizedReturn > 40 ? '⚠️ Hohe Rendite = höheres Risiko' : null,
      best.approxDelta > 0.35 ? '⚠️ Hohes Delta = näher am Geld' : null,
      regime === 'BEAR_VOLATILE' ? '⚠️ Erhöhtes Assignment-Risiko in Bärmarkt' : null
    ].filter(Boolean)
  };
}

/**
 * Analyze when to roll a CSP
 * @param {Object} position - Existing CSP position
 * @param {Object} params - Current market data
 */
export function analyzeCSPRoll(position, { underlyingPrice, optionsChain, regime }) {
  const daysToExpiry = position.daysToExpiry;

  // Roll triggers
  const triggers = [];

  if (daysToExpiry <= 7) {
    triggers.push({ type: 'DTE', message: `Nur noch ${daysToExpiry} Tage bis Verfall`, severity: 'HIGH' });
  }

  if (position.optionType === 'PUT' && underlyingPrice < position.strike * 0.99) {
    triggers.push({ 
      type: 'ITM', 
      message: `Underlying $${underlyingPrice} < Strike $${position.strike}`, 
      severity: 'CRITICAL' 
    });
  }

  if (regime === 'CRISIS') {
    triggers.push({ type: 'REGIME', message: 'CRISIS aktiv', severity: 'CRITICAL' });
  }

  if (triggers.length === 0) {
    return {
      recommendation: 'HOLD',
      reason: 'Keine Roll-Trigger aktiv. Position halten.',
      daysToExpiry
    };
  }

  // Find roll target
  const rollPuts = optionsChain.filter(opt => {
    const dte = differenceInDays(new Date(opt.expiry), new Date());
    return dte >= 30 && dte <= 60;
  });

  // Roll down and out if ITM, or just out if OTM
  const isITM = underlyingPrice < position.strike;
  const targetStrike = isITM 
    ? underlyingPrice * 0.95 // Roll down to 95% of current
    : position.strike; // Keep same strike

  const bestRoll = rollPuts.reduce((best, put) => {
    const strikeDiff = Math.abs(put.strike - targetStrike);
    const premium = (put.bid + put.ask) / 2;
    return strikeDiff < best.strikeDiff ? { put, strikeDiff, premium } : best;
  }, { strikeDiff: Infinity });

  return {
    recommendation: 'ROLL',
    triggers,
    current: {
      strike: position.strike,
      expiry: position.expiry,
      daysToExpiry
    },
    rollTarget: bestRoll.put ? {
      strike: bestRoll.put.strike,
      expiry: bestRoll.put.expiry,
      premium: bestRoll.premium.toFixed(2),
      netCredit: (bestRoll.premium * 100).toFixed(0)
    } : null,
    alternative: 'Assignment akzeptieren und CC verkaufen (Wheel)'
  };
}
