/**
 * Wheel Strategy Tracker
 * Tracks the full wheel cycle: CSP → Assignment → CC → Called Away
 */

/**
 * Detect wheel stage for a symbol
 * @param {Array} positions - all positions
 * @param {string} symbol - symbol to check
 * @returns {Object} - wheel stage and recommendations
 */
export function analyzeWheelStage(positions, symbol) {
  const symbolPositions = positions.filter(p => p.underlying === symbol);

  const stockPos = symbolPositions.find(p => p.assetClass === 'STOCK' && p.netQuantity > 0);
  const shortPut = symbolPositions.find(p => 
    p.assetClass === 'OPTION' && p.optionType === 'PUT' && p.netQuantity < 0 && p.isOpen
  );
  const shortCall = symbolPositions.find(p => 
    p.assetClass === 'OPTION' && p.optionType === 'CALL' && p.netQuantity < 0 && p.isOpen
  );

  // Stage detection
  if (!stockPos && !shortPut && !shortCall) {
    return {
      stage: 'READY',
      description: 'Bereit für neuen Wheel-Cycle. Verkaufe CSP.',
      nextAction: 'CSP',
      recommendation: 'Verkaufe Cash Secured Put auf ' + symbol
    };
  }

  if (shortPut && !stockPos) {
    return {
      stage: 'CSP_ACTIVE',
      description: `CSP aktiv: Strike $${shortPut.strike}, DTE ${shortPut.daysToExpiry}`,
      nextAction: shortPut.daysToExpiry <= 7 ? 'ROLL_OR_ASSIGN' : 'HOLD',
      position: shortPut,
      recommendation: shortPut.daysToExpiry <= 7 
        ? 'Prüfe Roll oder akzeptiere Assignment'
        : 'Halte CSP bis Verfall oder Roll'
    };
  }

  if (stockPos && !shortCall) {
    return {
      stage: 'ASSIGNED',
      description: `${stockPos.netQuantity} Shares zugewiesen. Bereit für CC.`,
      nextAction: 'CC',
      position: stockPos,
      recommendation: `Verkaufe Covered Call auf ${symbol} (${stockPos.netQuantity} Shares)`,
      context: {
        shares: stockPos.netQuantity,
        costBasis: stockPos.avgCost,
        currentPrice: stockPos.marketPrice,
        unrealizedPnl: stockPos.unrealizedPnl
      }
    };
  }

  if (stockPos && shortCall) {
    return {
      stage: 'CC_ACTIVE',
      description: `CC aktiv: ${shortCall.strike} Call auf ${stockPos.netQuantity} Shares`,
      nextAction: shortCall.daysToExpiry <= 7 ? 'ROLL_OR_ASSIGN' : 'HOLD',
      positions: { stock: stockPos, call: shortCall },
      recommendation: shortCall.daysToExpiry <= 7
        ? 'Prüfe Roll oder akzeptiere Assignment (Wheel-Cycle komplett)'
        : 'Halte CC bis Verfall',
      wheelProgress: {
        stage: 3,
        totalStages: 4,
        stages: ['CSP', 'Assignment', 'CC', 'Called Away'],
        current: 'CC_ACTIVE',
        pnl: {
          stock: stockPos.unrealizedPnl,
          call: shortCall.totalPremium || 0
        }
      }
    };
  }

  return {
    stage: 'UNKNOWN',
    description: 'Unklarer Wheel-Status',
    nextAction: 'REVIEW'
  };
}

/**
 * Calculate total wheel P&L for a completed cycle
 */
export function calculateWheelPnL(trades, symbol) {
  const symbolTrades = trades.filter(t => t.underlying === symbol);

  const cspPremium = symbolTrades
    .filter(t => t.strategy === 'CASH_SECURED_PUT' && t.side === 'SELL')
    .reduce((sum, t) => sum + (t.premium * t.quantity * 100), 0);

  const ccPremium = symbolTrades
    .filter(t => t.strategy === 'COVERED_CALL' && t.side === 'SELL')
    .reduce((sum, t) => sum + (t.premium * t.quantity * 100), 0);

  const stockPnl = symbolTrades
    .filter(t => t.assetClass === 'STOCK')
    .reduce((sum, t) => sum + (t.realizedPnl || 0), 0);

  const total = cspPremium + ccPremium + stockPnl;

  return {
    symbol,
    cspPremium: cspPremium.toFixed(2),
    ccPremium: ccPremium.toFixed(2),
    stockPnl: stockPnl.toFixed(2),
    totalPnL: total.toFixed(2),
    cycleComplete: symbolTrades.some(t => t.code?.includes('Ex'))
  };
}
