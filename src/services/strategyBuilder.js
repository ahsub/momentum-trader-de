/**
 * strategyBuilder.js
 * 
 * Komplexe Options-Strategien Builder für momentum-trader-de
 * Phase 8.2: Iron Condor, Strangle, Butterfly
 * 
 * Nutzt Echtzeit-Options-Chain Daten für Strategie-Konstruktion
 */

import { fetchOptionsChain, getMidPrice } from './optionsChainService';

/**
 * Strategie-Typen
 */
export const STRATEGY_TYPES = {
  IRON_CONDOR: 'iron_condor',
  STRANGLE: 'strangle',
  BUTTERFLY: 'butterfly',
  IRON_BUTTERFLY: 'iron_butterfly'
};

/**
 * Baue eine Iron Condor Strategie
 * 
 * Struktur: Sell OTM Put + Buy further OTM Put + Sell OTM Call + Buy further OTM Call
 * 
 * @param {Object} params
 * @param {string} params.symbol - Aktien-Symbol
 * @param {number} params.underlyingPrice - Aktueller Kurs
 * @param {number} params.wingWidth - Breite der Wings in $ (z.B. 5)
 * @param {number} params.bodyWidth - Breite des Bodies in $ (z.B. 10)
 * @param {number} params.daysToExpiration - DTE
 * @param {Object} params.chain - Options-Chain Daten
 * @returns {Object} - Iron Condor Setup
 */
export function buildIronCondor({ symbol, underlyingPrice, wingWidth = 5, bodyWidth = 10, daysToExpiration = 30, chain }) {
  if (!chain || !chain.puts || !chain.calls) {
    return null;
  }

  const expiration = selectExpiration(chain, daysToExpiration);
  if (!expiration) return null;

  const puts = chain.puts.filter(p => p.expiration === expiration);
  const calls = chain.calls.filter(c => c.expiration === expiration);

  if (puts.length < 2 || calls.length < 2) return null;

  // Short Put (OTM): strike < underlyingPrice
  const shortPutStrike = findNearestStrike(puts, underlyingPrice - bodyWidth);
  const shortPut = puts.find(p => p.strike === shortPutStrike);

  // Long Put (further OTM): strike < shortPutStrike
  const longPutStrike = findNearestStrike(puts, shortPutStrike - wingWidth);
  const longPut = puts.find(p => p.strike === longPutStrike);

  // Short Call (OTM): strike > underlyingPrice
  const shortCallStrike = findNearestStrike(calls, underlyingPrice + bodyWidth);
  const shortCall = calls.find(c => c.strike === shortCallStrike);

  // Long Call (further OTM): strike > shortCallStrike
  const longCallStrike = findNearestStrike(calls, shortCallStrike + wingWidth);
  const longCall = calls.find(c => c.strike === longCallStrike);

  if (!shortPut || !longPut || !shortCall || !longCall) {
    return null;
  }

  // Berechne Netto-Prämie
  const shortPutPremium = getMidPrice(shortPut) * 100;
  const longPutPremium = getMidPrice(longPut) * 100;
  const shortCallPremium = getMidPrice(shortCall) * 100;
  const longCallPremium = getMidPrice(longCall) * 100;

  const netCredit = shortPutPremium + shortCallPremium - longPutPremium - longCallPremium;
  const maxRisk = wingWidth * 100 - netCredit;
  const breakEvenLower = shortPutStrike - (netCredit / 100);
  const breakEvenUpper = shortCallStrike + (netCredit / 100);
  const profitZone = breakEvenUpper - breakEvenLower;

  return {
    type: STRATEGY_TYPES.IRON_CONDOR,
    symbol,
    expiration,
    underlyingPrice,
    legs: [
      { side: 'SELL', type: 'PUT', strike: shortPutStrike, premium: shortPutPremium, delta: shortPut.delta, iv: shortPut.impliedVolatility, contract: shortPut },
      { side: 'BUY', type: 'PUT', strike: longPutStrike, premium: longPutPremium, delta: longPut.delta, iv: longPut.impliedVolatility, contract: longPut },
      { side: 'SELL', type: 'CALL', strike: shortCallStrike, premium: shortCallPremium, delta: shortCall.delta, iv: shortCall.impliedVolatility, contract: shortCall },
      { side: 'BUY', type: 'CALL', strike: longCallStrike, premium: longCallPremium, delta: longCall.delta, iv: longCall.impliedVolatility, contract: longCall }
    ],
    metrics: {
      netCredit: Math.round(netCredit * 100) / 100,
      maxProfit: Math.round(netCredit * 100) / 100,
      maxRisk: Math.round(maxRisk * 100) / 100,
      breakEvenLower: Math.round(breakEvenLower * 100) / 100,
      breakEvenUpper: Math.round(breakEvenUpper * 100) / 100,
      profitZone: Math.round(profitZone * 100) / 100,
      riskRewardRatio: Math.round((maxRisk / netCredit) * 100) / 100,
      probabilityOfProfit: estimatePOP(shortPutStrike, shortCallStrike, underlyingPrice, daysToExpiration),
      marginRequired: wingWidth * 100 // Simplified
    },
    greeks: {
      delta: Math.round((shortPut.delta + longPut.delta + shortCall.delta + longCall.delta) * 100) / 100,
      theta: Math.round((shortPut.theta + longPut.theta + shortCall.theta + longCall.theta) * 100) / 100,
      vega: Math.round((shortPut.vega + longPut.vega + shortCall.vega + longCall.vega) * 100) / 100
    }
  };
}

/**
 * Baue eine Short Strangle Strategie
 * 
 * Struktur: Sell OTM Put + Sell OTM Call
 * 
 * @param {Object} params
 * @param {string} params.symbol
 * @param {number} params.underlyingPrice
 * @param {number} params.putDelta - Ziel-Delta für Put (z.B. -0.16 für 1-SD)
 * @param {number} params.callDelta - Ziel-Delta für Call (z.B. 0.16 für 1-SD)
 * @param {number} params.daysToExpiration
 * @param {Object} params.chain
 * @returns {Object} - Strangle Setup
 */
export function buildStrangle({ symbol, underlyingPrice, putDelta = -0.16, callDelta = 0.16, daysToExpiration = 30, chain }) {
  if (!chain || !chain.puts || !chain.calls) return null;

  const expiration = selectExpiration(chain, daysToExpiration);
  if (!expiration) return null;

  const puts = chain.puts.filter(p => p.expiration === expiration);
  const calls = chain.calls.filter(c => c.expiration === expiration);

  // Finde Put mit Ziel-Delta
  const shortPut = puts.reduce((closest, p) => {
    return Math.abs(p.delta - putDelta) < Math.abs(closest.delta - putDelta) ? p : closest;
  }, puts[0]);

  // Finde Call mit Ziel-Delta
  const shortCall = calls.reduce((closest, c) => {
    return Math.abs(c.delta - callDelta) < Math.abs(closest.delta - callDelta) ? c : closest;
  }, calls[0]);

  if (!shortPut || !shortCall) return null;

  const putPremium = getMidPrice(shortPut) * 100;
  const callPremium = getMidPrice(shortCall) * 100;
  const netCredit = putPremium + callPremium;

  const breakEvenLower = shortPut.strike - (netCredit / 100);
  const breakEvenUpper = shortCall.strike + (netCredit / 100);

  return {
    type: STRATEGY_TYPES.STRANGLE,
    symbol,
    expiration,
    underlyingPrice,
    legs: [
      { side: 'SELL', type: 'PUT', strike: shortPut.strike, premium: putPremium, delta: shortPut.delta, iv: shortPut.impliedVolatility, contract: shortPut },
      { side: 'SELL', type: 'CALL', strike: shortCall.strike, premium: callPremium, delta: shortCall.delta, iv: shortCall.impliedVolatility, contract: shortCall }
    ],
    metrics: {
      netCredit: Math.round(netCredit * 100) / 100,
      maxProfit: Math.round(netCredit * 100) / 100,
      maxRisk: 'Unlimited',
      breakEvenLower: Math.round(breakEvenLower * 100) / 100,
      breakEvenUpper: Math.round(breakEvenUpper * 100) / 100,
      profitZone: Math.round((breakEvenUpper - breakEvenLower) * 100) / 100,
      probabilityOfProfit: estimatePOP(shortPut.strike, shortCall.strike, underlyingPrice, daysToExpiration),
      marginRequired: Math.round(Math.max(shortPut.strike, shortCall.strike) * 0.2 * 100) // 20% Rule of Thumb
    },
    greeks: {
      delta: Math.round((shortPut.delta + shortCall.delta) * 100) / 100,
      theta: Math.round((shortPut.theta + shortCall.theta) * 100) / 100,
      vega: Math.round((shortPut.vega + shortCall.vega) * 100) / 100
    }
  };
}

/**
 * Baue eine Call Butterfly Strategie
 * 
 * Struktur: Buy 1 ITM Call + Sell 2 ATM Calls + Buy 1 OTM Call
 * 
 * @param {Object} params
 * @param {string} params.symbol
 * @param {number} params.underlyingPrice
 * @param {number} params.wingWidth - Breite der Wings
 * @param {number} params.daysToExpiration
 * @param {Object} params.chain
 * @returns {Object} - Butterfly Setup
 */
export function buildButterfly({ symbol, underlyingPrice, wingWidth = 5, daysToExpiration = 30, chain }) {
  if (!chain || !chain.calls) return null;

  const expiration = selectExpiration(chain, daysToExpiration);
  if (!expiration) return null;

  const calls = chain.calls.filter(c => c.expiration === expiration);
  if (calls.length < 3) return null;

  // Lower Wing (ITM)
  const lowerStrike = findNearestStrike(calls, underlyingPrice - wingWidth);
  const lowerCall = calls.find(c => c.strike === lowerStrike);

  // Body (ATM)
  const bodyStrike = findNearestStrike(calls, underlyingPrice);
  const bodyCall = calls.find(c => c.strike === bodyStrike);

  // Upper Wing (OTM)
  const upperStrike = findNearestStrike(calls, underlyingPrice + wingWidth);
  const upperCall = calls.find(c => c.strike === upperStrike);

  if (!lowerCall || !bodyCall || !upperCall) return null;

  const lowerPremium = getMidPrice(lowerCall) * 100;
  const bodyPremium = getMidPrice(bodyCall) * 100;
  const upperPremium = getMidPrice(upperCall) * 100;

  const netDebit = lowerPremium + upperPremium - (2 * bodyPremium);
  const maxProfit = (wingWidth * 100) - netDebit;
  const maxRisk = netDebit;

  return {
    type: STRATEGY_TYPES.BUTTERFLY,
    symbol,
    expiration,
    underlyingPrice,
    legs: [
      { side: 'BUY', type: 'CALL', strike: lowerStrike, premium: lowerPremium, qty: 1, delta: lowerCall.delta, iv: lowerCall.impliedVolatility, contract: lowerCall },
      { side: 'SELL', type: 'CALL', strike: bodyStrike, premium: bodyPremium, qty: 2, delta: bodyCall.delta, iv: bodyCall.impliedVolatility, contract: bodyCall },
      { side: 'BUY', type: 'CALL', strike: upperStrike, premium: upperPremium, qty: 1, delta: upperCall.delta, iv: upperCall.impliedVolatility, contract: upperCall }
    ],
    metrics: {
      netDebit: Math.round(netDebit * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxRisk: Math.round(maxRisk * 100) / 100,
      breakEvenLower: Math.round((lowerStrike + (netDebit / 100)) * 100) / 100,
      breakEvenUpper: Math.round((upperStrike - (netDebit / 100)) * 100) / 100,
      riskRewardRatio: Math.round((maxProfit / maxRisk) * 100) / 100,
      probabilityOfProfit: 0.5 // Approximation for ATM butterfly
    },
    greeks: {
      delta: Math.round((lowerCall.delta - 2 * bodyCall.delta + upperCall.delta) * 100) / 100,
      theta: Math.round((lowerCall.theta - 2 * bodyCall.theta + upperCall.theta) * 100) / 100,
      vega: Math.round((lowerCall.vega - 2 * bodyCall.vega + upperCall.vega) * 100) / 100
    }
  };
}

/**
 * Baue eine Iron Butterfly Strategie
 * 
 * Struktur: Sell ATM Straddle + Buy OTM Strangle
 * 
 * @param {Object} params
 * @param {string} params.symbol
 * @param {number} params.underlyingPrice
 * @param {number} params.wingWidth
 * @param {number} params.daysToExpiration
 * @param {Object} params.chain
 * @returns {Object} - Iron Butterfly Setup
 */
export function buildIronButterfly({ symbol, underlyingPrice, wingWidth = 5, daysToExpiration = 30, chain }) {
  if (!chain || !chain.puts || !chain.calls) return null;

  const expiration = selectExpiration(chain, daysToExpiration);
  if (!expiration) return null;

  const puts = chain.puts.filter(p => p.expiration === expiration);
  const calls = chain.calls.filter(c => c.expiration === expiration);

  // ATM Short Straddle
  const atmStrike = findNearestStrike(calls, underlyingPrice);
  const shortPut = puts.find(p => p.strike === atmStrike);
  const shortCall = calls.find(c => c.strike === atmStrike);

  // OTM Long Strangle
  const longPutStrike = findNearestStrike(puts, atmStrike - wingWidth);
  const longCallStrike = findNearestStrike(calls, atmStrike + wingWidth);
  const longPut = puts.find(p => p.strike === longPutStrike);
  const longCall = calls.find(c => c.strike === longCallStrike);

  if (!shortPut || !shortCall || !longPut || !longCall) return null;

  const shortPutPremium = getMidPrice(shortPut) * 100;
  const shortCallPremium = getMidPrice(shortCall) * 100;
  const longPutPremium = getMidPrice(longPut) * 100;
  const longCallPremium = getMidPrice(longCall) * 100;

  const netCredit = shortPutPremium + shortCallPremium - longPutPremium - longCallPremium;
  const maxProfit = netCredit;
  const maxRisk = wingWidth * 100 - netCredit;

  return {
    type: STRATEGY_TYPES.IRON_BUTTERFLY,
    symbol,
    expiration,
    underlyingPrice,
    legs: [
      { side: 'SELL', type: 'PUT', strike: atmStrike, premium: shortPutPremium, delta: shortPut.delta, iv: shortPut.impliedVolatility, contract: shortPut },
      { side: 'SELL', type: 'CALL', strike: atmStrike, premium: shortCallPremium, delta: shortCall.delta, iv: shortCall.impliedVolatility, contract: shortCall },
      { side: 'BUY', type: 'PUT', strike: longPutStrike, premium: longPutPremium, delta: longPut.delta, iv: longPut.impliedVolatility, contract: longPut },
      { side: 'BUY', type: 'CALL', strike: longCallStrike, premium: longCallPremium, delta: longCall.delta, iv: longCall.impliedVolatility, contract: longCall }
    ],
    metrics: {
      netCredit: Math.round(netCredit * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxRisk: Math.round(maxRisk * 100) / 100,
      breakEvenLower: Math.round((atmStrike - (netCredit / 100)) * 100) / 100,
      breakEvenUpper: Math.round((atmStrike + (netCredit / 100)) * 100) / 100,
      riskRewardRatio: Math.round((maxRisk / netCredit) * 100) / 100,
      probabilityOfProfit: 0.5
    },
    greeks: {
      delta: Math.round((shortPut.delta + shortCall.delta + longPut.delta + longCall.delta) * 100) / 100,
      theta: Math.round((shortPut.theta + shortCall.theta + longPut.theta + longCall.theta) * 100) / 100,
      vega: Math.round((shortPut.vega + shortCall.vega + longPut.vega + longCall.vega) * 100) / 100
    }
  };
}

/**
 * Berechne P&L für eine Strategie bei verschiedenen Underlying-Preisen
 * @param {Object} strategy - Strategie-Objekt
 * @param {number[]} priceRange - Array von Underlying-Preisen
 * @returns {Object[]} - P&L Punkte
 */
export function calculateStrategyPnL(strategy, priceRange) {
  if (!strategy || !strategy.legs || !priceRange) return [];

  return priceRange.map(price => {
    let pnl = 0;

    strategy.legs.forEach(leg => {
      const qty = leg.qty || 1;
      const multiplier = leg.side === 'SELL' ? 1 : -1; // Sell = collect premium, Buy = pay premium

      // Initial premium flow
      pnl += multiplier * leg.premium * qty;

      // Intrinsic value at expiration
      let intrinsic = 0;
      if (leg.type === 'CALL') {
        intrinsic = Math.max(0, price - leg.strike);
      } else {
        intrinsic = Math.max(0, leg.strike - price);
      }

      // For sellers: lose intrinsic, for buyers: gain intrinsic
      pnl -= multiplier * intrinsic * 100 * qty;
    });

    return {
      price: Math.round(price * 100) / 100,
      pnl: Math.round(pnl * 100) / 100
    };
  });
}

/**
 * Finde die beste Strategie basierend auf Regime und IV-Rank
 * @param {string} regime - Aktuelles Marktregime
 * @param {number} ivRank - IV-Rank (0-100)
 * @returns {string[]} - Empfohlene Strategie-Typen
 */
export function recommendStrategy(regime, ivRank) {
  const recommendations = [];

  if (ivRank > 70) {
    // Hohe Volatilität: Verkaufsstrategien bevorzugen
    recommendations.push(STRATEGY_TYPES.IRON_CONDOR);
    recommendations.push(STRATEGY_TYPES.STRANGLE);
  } else if (ivRank < 30) {
    // Niedrige Volatilität: Kaufstrategien bevorzugen
    recommendations.push(STRATEGY_TYPES.BUTTERFLY);
    recommendations.push(STRATEGY_TYPES.IRON_BUTTERFLY);
  } else {
    // Moderate Volatilität: Balanced
    recommendations.push(STRATEGY_TYPES.IRON_CONDOR);
    recommendations.push(STRATEGY_TYPES.BUTTERFLY);
  }

  // Regime-Anpassungen
  if (regime === 'CRISIS') {
    return []; // Keine komplexen Strategien in Krisen
  }

  if (regime === 'BULL_VOLATILE' || regime === 'BEAR_VOLATILE') {
    // In volatilen Phasen: Iron Condor oder Strangle
    recommendations.unshift(STRATEGY_TYPES.IRON_CONDOR);
  }

  return [...new Set(recommendations)];
}

// ====== HILFSFUNKTIONEN ======

function findNearestStrike(options, target) {
  if (!options || options.length === 0) return null;
  return options.reduce((closest, opt) => {
    return Math.abs(opt.strike - target) < Math.abs(closest.strike - target) ? opt : closest;
  }).strike;
}

function selectExpiration(chain, targetDTE) {
  if (!chain.expirations || chain.expirations.length === 0) return null;

  const today = new Date();
  return chain.expirations.reduce((closest, exp) => {
    const expDate = new Date(exp);
    const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    const closestDTE = Math.ceil((new Date(closest) - today) / (1000 * 60 * 60 * 24));
    return Math.abs(dte - targetDTE) < Math.abs(closestDTE - targetDTE) ? exp : closest;
  });
}

function estimatePOP(lowerStrike, upperStrike, underlyingPrice, daysToExpiration) {
  // Vereinfachte POP-Schätzung basierend auf Standardabweichung
  const dailyVol = 0.016; // ~1.6% tägliche Volatilität (approx. 25% annual)
  const stdDev = underlyingPrice * dailyVol * Math.sqrt(daysToExpiration);
  const distance = Math.min(
    Math.abs(underlyingPrice - lowerStrike),
    Math.abs(upperStrike - underlyingPrice)
  );

  // Approximiere Wahrscheinlichkeit mit Normalverteilung
  const zScore = distance / stdDev;
  // Vereinfacht: 50% + zScore * 15% (sehr grobe Approximation)
  const pop = Math.min(0.95, Math.max(0.1, 0.5 + zScore * 0.15));

  return Math.round(pop * 100) / 100;
}

// Exportiere alle Funktionen
export default {
  STRATEGY_TYPES,
  buildIronCondor,
  buildStrangle,
  buildButterfly,
  buildIronButterfly,
  calculateStrategyPnL,
  recommendStrategy
};
