/**
 * Covered Call (CC) Advisor
 * Recommends optimal call-selling setups based on shares owned
 */

import { differenceInDays } from 'date-fns';

const CC_DTE_TARGETS = {
  BULL_QUIET: { min: 14, max: 30, preferred: 21 },
  BULL_VOLATILE: { min: 21, max: 45, preferred: 30 },
  BEAR_QUIET: { min: 30, max: 60, preferred: 45 },
  BEAR_VOLATILE: { min: 21, max: 45, preferred: 30 },
  CRISIS: { min: 0, max: 0, preferred: 0 }
};

const CC_DELTA_TARGETS = {
  BULL_QUIET: { min: 0.15, max: 0.35, preferred: 0.30 },
  BULL_VOLATILE: { min: 0.10, max: 0.25, preferred: 0.20 },
  BEAR_QUIET: { min: 0.15, max: 0.30, preferred: 0.25 },
  BEAR_VOLATILE: { min: 0.10, max: 0.20, preferred: 0.15 },
  CRISIS: { min: 0, max: 0, preferred: 0 }
};

/**
 * Find optimal CC setup for owned shares
 * @param {Object} params
 * @param {string} params.symbol - Underlying symbol
 * @param {number} params.sharesOwned - Number of shares (must be >= 100)
 * @param {number} params.costBasis - Average cost per share
 * @param {number} params.underlyingPrice - Current price
 * @param {string} params.regime - Current market regime
 * @param {Array} params.optionsChain - Array of call options
 * @param {Array} params.resistanceLevels - Resistance levels
 */
export function findCCSetup({
  symbol,
  sharesOwned,
  costBasis,
  underlyingPrice,
  regime = 'BULL_QUIET',
  optionsChain = [],
  resistanceLevels = [],
  existingPositions = []
}) {
  // Validate
  if (sharesOwned < 100) {
    return {
      recommendation: 'SKIP',
      reason: `Nur ${sharesOwned} Shares. Mindestens 100 für Covered Call nötig.`,
    };
  }

  // Check existing CC
  const existingCC = existingPositions.find(p => 
    p.underlying === symbol && p.strategy === 'COVERED_CALL' && p.isOpen
  );

  if (existingCC) {
    return {
      recommendation: 'SKIP',
      reason: `Bereits ein CC auf ${symbol} aktiv (Strike $${existingCC.strike}).`,
      existingPosition: existingCC
    };
  }

  if (regime === 'CRISIS') {
    return {
      recommendation: 'AVOID',
      reason: 'CRISIS: Keine neuen Short-Calls. Schütze Downside.',
      regime
    };
  }

  const dteTarget = CC_DTE_TARGETS[regime] || CC_DTE_TARGETS.BULL_QUIET;
  const deltaTarget = CC_DELTA_TARGETS[regime] || CC_DELTA_TARGETS.BULL_QUIET;

  const maxContracts = Math.floor(sharesOwned / 100);

  // Filter calls by DTE
  const validCalls = optionsChain.filter(opt => {
    const dte = differenceInDays(new Date(opt.expiry), new Date());
    return dte >= dteTarget.min && dte <= dteTarget.max;
  });

  if (validCalls.length === 0) {
    return {
      recommendation: 'SKIP',
      reason: 'Keine passenden Call-Optionen im gewünschten DTE-Bereich.',
    };
  }

  // Calculate metrics for each call
  const profitPercent = ((underlyingPrice - costBasis) / costBasis) * 100;
  const protectProfit = profitPercent > 20;

  const callsWithMetrics = validCalls.map(call => {
    const dte = differenceInDays(new Date(call.expiry), new Date());
    const iv = call.impliedVolatility || 0.30;
    const t = dte / 365;

    // Approximate delta
    const moneyness = call.strike / underlyingPrice;
    const d1 = Math.log(moneyness) / (iv * Math.sqrt(t) + 0.001);
    const approxDelta = Math.max(0.05, Math.min(0.50, 0.5 + d1 * 0.3));

    const premium = (call.bid + call.ask) / 2;
    const premiumPerContract = premium * 100;

    // Yield calculations
    const yieldPercent = (premium / underlyingPrice) * 100;
    const annualizedYield = yieldPercent * (365 / Math.max(dte, 1));

    // If protecting profit, prefer ITM calls
    const itmScore = protectProfit && call.strike <= underlyingPrice ? -20 : 0;

    // Distance to resistance
    const nearestResistance = resistanceLevels.length > 0
      ? resistanceLevels.filter(r => r > call.strike).sort((a, b) => a - b)[0]
      : null;

    // Total score (lower = better)
    const deltaScore = Math.abs(approxDelta - deltaTarget.preferred) * 100;
    const dteScore = Math.abs(dte - dteTarget.preferred) * 0.5;
    const returnScore = annualizedYield < 5 ? 30 : annualizedYield > 40 ? 10 : 0;
    const totalScore = deltaScore + dteScore + returnScore + itmScore;

    return {
      ...call,
      dte,
      approxDelta,
      premium,
      premiumPerContract,
      yieldPercent,
      annualizedYield,
      nearestResistance,
      totalScore,
      itm: call.strike <= underlyingPrice
    };
  });

  callsWithMetrics.sort((a, b) => a.totalScore - b.totalScore);

  const topPicks = callsWithMetrics.slice(0, 3);
  const best = topPicks[0];

  return {
    recommendation: 'EXECUTE',
    symbol,
    strategy: 'COVERED_CALL',
    setup: {
      strike: best.strike,
      expiry: best.expiry,
      dte: best.dte,
      premium: best.premium.toFixed(2),
      premiumPerContract: best.premiumPerContract.toFixed(0),
      contracts: maxContracts,
      totalPremium: (best.premiumPerContract * maxContracts).toFixed(0),
      yieldPercent: best.yieldPercent.toFixed(2),
      annualizedYield: best.annualizedYield.toFixed(1),
      approxDelta: best.approxDelta.toFixed(2),
      breakEven: (best.strike + best.premium).toFixed(2),
      maxProfit: ((best.strike - costBasis + best.premium) * maxContracts * 100).toFixed(0),
      assignmentRisk: best.itm ? 'HIGH (ITM)' : 'LOW (OTM)'
    },
    context: {
      sharesOwned,
      costBasis,
      underlyingPrice,
      profitPercent: profitPercent.toFixed(1),
      protectProfit
    },
    rationale: [
      `Regime ${regime}: Ziel-Delta ${deltaTarget.preferred}, Ziel-DTE ${dteTarget.preferred}`,
      protectProfit 
        ? `Profit +${profitPercent.toFixed(1)}% → ITM Call für Protection gewählt`
        : `Kein Profit → OTM Call für Upside-Partizipation`,
      `Strike $${best.strike} = ${((best.strike / underlyingPrice - 1) * 100).toFixed(1)}% über Spot`,
      `Yield: ${best.yieldPercent.toFixed(2)}% (${best.annualizedYield.toFixed(1)}% annualisiert)`,
      best.nearestResistance 
        ? `Nächste Resistance bei $${best.nearestResistance}`
        : 'Keine Resistance-Level verfügbar'
    ],
    alternatives: topPicks.slice(1, 3).map(c => ({
      strike: c.strike,
      expiry: c.expiry,
      premium: c.premium.toFixed(2),
      yieldPercent: c.yieldPercent.toFixed(2),
      approxDelta: c.approxDelta.toFixed(2)
    }))
  };
}

/**
 * Analyze when to roll a CC
 */
export function analyzeCCRoll(position, { underlyingPrice, optionsChain, regime }) {
  const daysToExpiry = position.daysToExpiry;
  const triggers = [];

  if (daysToExpiry <= 7) {
    triggers.push({ type: 'DTE', message: `Nur noch ${daysToExpiry} Tage bis Verfall`, severity: 'HIGH' });
  }

  if (position.optionType === 'CALL' && underlyingPrice > position.strike * 1.01) {
    triggers.push({ 
      type: 'ITM', 
      message: `Underlying $${underlyingPrice} > Strike $${position.strike} (+${((underlyingPrice/position.strike-1)*100).toFixed(1)}%)`, 
      severity: 'HIGH' 
    });
  }

  if (triggers.length === 0) {
    return {
      recommendation: 'HOLD',
      reason: 'Keine Roll-Trigger. Position halten.',
      daysToExpiry
    };
  }

  // Find roll target
  const isITM = underlyingPrice > position.strike;
  const targetStrike = isITM
    ? underlyingPrice * 1.03 // Roll up and out
    : position.strike;

  const rollCalls = optionsChain.filter(opt => {
    const dte = differenceInDays(new Date(opt.expiry), new Date());
    return dte >= 21 && dte <= 45;
  });

  const bestRoll = rollCalls.reduce((best, call) => {
    const strikeDiff = Math.abs(call.strike - targetStrike);
    const premium = (call.bid + call.ask) / 2;
    return strikeDiff < best.strikeDiff ? { call, strikeDiff, premium } : best;
  }, { strikeDiff: Infinity });

  return {
    recommendation: 'ROLL',
    triggers,
    current: {
      strike: position.strike,
      expiry: position.expiry,
      daysToExpiry
    },
    rollTarget: bestRoll.call ? {
      strike: bestRoll.call.strike,
      expiry: bestRoll.call.expiry,
      premium: bestRoll.premium.toFixed(2),
      netCredit: (bestRoll.premium * 100).toFixed(0)
    } : null,
    alternative: isITM ? 'Assignment akzeptieren (Shares verkauft)' : 'Option verfallen lassen'
  };
}
