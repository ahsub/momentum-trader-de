/**
 * complexStrategiesService.js
 * 
 * Builder für komplexe Optionsstrategien
 * Iron Condor, Strangle, Butterfly
 * 
 * Phase 8.2: Komplexe Strategien
 */

import { fetchOptionsChain, getMidPrice } from './optionsChainService';

/**
 * Baue einen Iron Condor
 * @param {string} symbol - Aktien-Symbol
 * @param {number} underlyingPrice - Aktueller Kurs
 * @param {string} expiration - Expirationsdatum
 * @param {number} spreadWidth - Breite der Spreads (z.B. 5 für $5 Spreads)
 * @returns {Promise<Object>} - Iron Condor Setup
 */
export async function buildIronCondor(symbol, underlyingPrice, expiration, spreadWidth = 5) {
  try {
    const chain = await fetchOptionsChain(symbol, expiration);

    // Finde Strikes für den Iron Condor
    // Put Spread: OTM Put (Short) + weiter OTM Put (Long)
    // Call Spread: OTM Call (Short) + weiter OTM Call (Long)

    const putStrikes = chain.puts.map(p => p.strike).sort((a, b) => a - b);
    const callStrikes = chain.calls.map(c => c.strike).sort((a, b) => a - b);

    // Short Put: ca. 10-15% OTM (Delta ~0.15-0.20)
    const shortPutStrike = findNearestStrike(putStrikes, underlyingPrice * 0.88);
    const longPutStrike = findNearestStrike(putStrikes, shortPutStrike - spreadWidth);

    // Short Call: ca. 10-15% OTM (Delta ~0.15-0.20)
    const shortCallStrike = findNearestStrike(callStrikes, underlyingPrice * 1.12);
    const longCallStrike = findNearestStrike(callStrikes, shortCallStrike + spreadWidth);

    const shortPut = chain.puts.find(p => p.strike === shortPutStrike);
    const longPut = chain.puts.find(p => p.strike === longPutStrike);
    const shortCall = chain.calls.find(c => c.strike === shortCallStrike);
    const longCall = chain.calls.find(c => c.strike === longCallStrike);

    if (!shortPut || !longPut || !shortCall || !longCall) {
      throw new Error('Nicht alle benötigten Strikes verfügbar');
    }

    // Berechne Prämien und Risiken
    const shortPutCredit = getMidPrice(shortPut);
    const longPutDebit = getMidPrice(longPut);
    const shortCallCredit = getMidPrice(shortCall);
    const longCallDebit = getMidPrice(longCall);

    const netCredit = (shortPutCredit + shortCallCredit - longPutDebit - longCallDebit) * 100;
    const maxRisk = (spreadWidth - (netCredit / 100)) * 100;
    const breakEvenPut = shortPutStrike - (netCredit / 100);
    const breakEvenCall = shortCallStrike + (netCredit / 100);
    const profitZone = `${breakEvenPut.toFixed(2)} - ${breakEvenCall.toFixed(2)}`;

    return {
      strategy: 'Iron Condor',
      symbol,
      expiration,
      underlyingPrice,
      legs: [
        { type: 'put', side: 'short', strike: shortPutStrike, premium: shortPutCredit, delta: shortPut.delta },
        { type: 'put', side: 'long', strike: longPutStrike, premium: longPutDebit, delta: longPut.delta },
        { type: 'call', side: 'short', strike: shortCallStrike, premium: shortCallCredit, delta: shortCall.delta },
        { type: 'call', side: 'long', strike: longCallStrike, premium: longCallDebit, delta: longCall.delta }
      ],
      netCredit,
      maxProfit: netCredit,
      maxRisk,
      breakEvenPut,
      breakEvenCall,
      profitZone,
      probabilityOfProfit: calculatePOP(netCredit, spreadWidth),
      riskRewardRatio: (maxRisk / netCredit).toFixed(2),
      marginRequired: spreadWidth * 100 // Simplifiziert
    };
  } catch (error) {
    console.error('[ComplexStrategies] Iron Condor Fehler:', error);
    return generateMockIronCondor(symbol, underlyingPrice, expiration, spreadWidth);
  }
}

/**
 * Baue einen Strangle
 * @param {string} symbol - Aktien-Symbol
 * @param {number} underlyingPrice - Aktueller Kurs
 * @param {string} expiration - Expirationsdatum
 * @param {number} otmDistance - OTM-Distanz in % (z.B. 0.10 für 10%)
 * @returns {Promise<Object>} - Strangle Setup
 */
export async function buildStrangle(symbol, underlyingPrice, expiration, otmDistance = 0.10) {
  try {
    const chain = await fetchOptionsChain(symbol, expiration);

    const putStrikes = chain.puts.map(p => p.strike).sort((a, b) => a - b);
    const callStrikes = chain.calls.map(c => c.strike).sort((a, b) => a - b);

    // OTM Put und OTM Call
    const putStrike = findNearestStrike(putStrikes, underlyingPrice * (1 - otmDistance));
    const callStrike = findNearestStrike(callStrikes, underlyingPrice * (1 + otmDistance));

    const put = chain.puts.find(p => p.strike === putStrike);
    const call = chain.calls.find(c => c.strike === callStrike);

    if (!put || !call) {
      throw new Error('Strikes nicht verfügbar');
    }

    const putPremium = getMidPrice(put);
    const callPremium = getMidPrice(call);
    const totalCredit = (putPremium + callPremium) * 100;

    return {
      strategy: 'Short Strangle',
      symbol,
      expiration,
      underlyingPrice,
      legs: [
        { type: 'put', side: 'short', strike: putStrike, premium: putPremium, delta: put.delta },
        { type: 'call', side: 'short', strike: callStrike, premium: callPremium, delta: call.delta }
      ],
      netCredit: totalCredit,
      maxProfit: totalCredit,
      maxRisk: 'Unbegrenzt (theoretisch)',
      breakEvenPut: putStrike - (totalCredit / 100),
      breakEvenCall: callStrike + (totalCredit / 100),
      profitZone: `${(putStrike - totalCredit / 100).toFixed(2)} - ${(callStrike + totalCredit / 100).toFixed(2)}`,
      probabilityOfProfit: calculatePOPStrangle(totalCredit, putStrike, callStrike, underlyingPrice),
      marginRequired: Math.max(putStrike * 0.20, callStrike * 0.20) * 100 // Simplifiziert
    };
  } catch (error) {
    console.error('[ComplexStrategies] Strangle Fehler:', error);
    return generateMockStrangle(symbol, underlyingPrice, expiration, otmDistance);
  }
}

/**
 * Baue einen Butterfly
 * @param {string} symbol - Aktien-Symbol
 * @param {number} underlyingPrice - Aktueller Kurs
 * @param {string} expiration - Expirationsdatum
 * @param {number} wingWidth - Breite der Flügel
 * @returns {Promise<Object>} - Butterfly Setup
 */
export async function buildButterfly(symbol, underlyingPrice, expiration, wingWidth = 5) {
  try {
    const chain = await fetchOptionsChain(symbol, expiration);

    const strikes = chain.calls.map(c => c.strike).sort((a, b) => a - b);

    // ATM als Center Strike
    const centerStrike = findNearestStrike(strikes, underlyingPrice);
    const lowerStrike = findNearestStrike(strikes, centerStrike - wingWidth);
    const upperStrike = findNearestStrike(strikes, centerStrike + wingWidth);

    const lowerCall = chain.calls.find(c => c.strike === lowerStrike);
    const centerCall1 = chain.calls.find(c => c.strike === centerStrike);
    const centerCall2 = chain.calls.find(c => c.strike === centerStrike);
    const upperCall = chain.calls.find(c => c.strike === upperStrike);

    if (!lowerCall || !centerCall1 || !upperCall) {
      throw new Error('Strikes nicht verfügbar');
    }

    const lowerPremium = getMidPrice(lowerCall);
    const centerPremium = getMidPrice(centerCall1);
    const upperPremium = getMidPrice(upperCall);

    // Long Butterfly: Buy 1 Lower, Sell 2 Center, Buy 1 Upper
    const netDebit = (lowerPremium + upperPremium - 2 * centerPremium) * 100;
    const maxProfit = (wingWidth - (netDebit / 100)) * 100;

    return {
      strategy: 'Long Call Butterfly',
      symbol,
      expiration,
      underlyingPrice,
      legs: [
        { type: 'call', side: 'long', strike: lowerStrike, premium: lowerPremium, qty: 1 },
        { type: 'call', side: 'short', strike: centerStrike, premium: centerPremium, qty: 2 },
        { type: 'call', side: 'long', strike: upperStrike, premium: upperPremium, qty: 1 }
      ],
      netDebit: Math.abs(netDebit),
      maxProfit,
      maxRisk: Math.abs(netDebit),
      breakEvenLower: lowerStrike + (Math.abs(netDebit) / 100),
      breakEvenUpper: upperStrike - (Math.abs(netDebit) / 100),
      profitZone: `${(lowerStrike + Math.abs(netDebit) / 100).toFixed(2)} - ${(upperStrike - Math.abs(netDebit) / 100).toFixed(2)}`,
      probabilityOfProfit: 0.30, // Approximation
      riskRewardRatio: (maxProfit / Math.abs(netDebit)).toFixed(2)
    };
  } catch (error) {
    console.error('[ComplexStrategies] Butterfly Fehler:', error);
    return generateMockButterfly(symbol, underlyingPrice, expiration, wingWidth);
  }
}

// Hilfsfunktionen
function findNearestStrike(strikes, target) {
  return strikes.reduce((closest, strike) => 
    Math.abs(strike - target) < Math.abs(closest - target) ? strike : closest
  );
}

function calculatePOP(netCredit, spreadWidth) {
  // Vereinfachte POP-Berechnung
  const creditRatio = netCredit / (spreadWidth * 100);
  return Math.min(0.80, Math.max(0.30, 0.50 + creditRatio * 0.5));
}

function calculatePOPStrangle(totalCredit, putStrike, callStrike, underlyingPrice) {
  const range = callStrike - putStrike;
  const creditRatio = totalCredit / (range * 100);
  return Math.min(0.85, Math.max(0.40, 0.55 + creditRatio * 0.4));
}

// Mock Generatoren
function generateMockIronCondor(symbol, price, expiration, spreadWidth) {
  const shortPut = price * 0.88;
  const longPut = shortPut - spreadWidth;
  const shortCall = price * 1.12;
  const longCall = shortCall + spreadWidth;
  const netCredit = 1.50;

  return {
    strategy: 'Iron Condor (Mock)',
    symbol, expiration, underlyingPrice: price,
    legs: [
      { type: 'put', side: 'short', strike: shortPut, premium: 0.85, delta: -0.18 },
      { type: 'put', side: 'long', strike: longPut, premium: 0.35, delta: -0.08 },
      { type: 'call', side: 'short', strike: shortCall, premium: 0.90, delta: 0.20 },
      { type: 'call', side: 'long', strike: longCall, premium: 0.40, delta: 0.10 }
    ],
    netCredit: netCredit * 100,
    maxProfit: netCredit * 100,
    maxRisk: (spreadWidth - netCredit) * 100,
    breakEvenPut: shortPut - netCredit,
    breakEvenCall: shortCall + netCredit,
    profitZone: `${(shortPut - netCredit).toFixed(2)} - ${(shortCall + netCredit).toFixed(2)}`,
    probabilityOfProfit: 0.65,
    riskRewardRatio: '2.33',
    marginRequired: spreadWidth * 100
  };
}

function generateMockStrangle(symbol, price, expiration, otmDistance) {
  const putStrike = price * (1 - otmDistance);
  const callStrike = price * (1 + otmDistance);
  const putPremium = 1.20;
  const callPremium = 1.30;
  const totalCredit = (putPremium + callPremium) * 100;

  return {
    strategy: 'Short Strangle (Mock)',
    symbol, expiration, underlyingPrice: price,
    legs: [
      { type: 'put', side: 'short', strike: putStrike, premium: putPremium, delta: -0.15 },
      { type: 'call', side: 'short', strike: callStrike, premium: callPremium, delta: 0.18 }
    ],
    netCredit: totalCredit,
    maxProfit: totalCredit,
    maxRisk: 'Unbegrenzt',
    breakEvenPut: putStrike - (totalCredit / 100),
    breakEvenCall: callStrike + (totalCredit / 100),
    profitZone: `${(putStrike - totalCredit / 100).toFixed(2)} - ${(callStrike + totalCredit / 100).toFixed(2)}`,
    probabilityOfProfit: 0.60,
    marginRequired: Math.max(putStrike, callStrike) * 0.20 * 100
  };
}

function generateMockButterfly(symbol, price, expiration, wingWidth) {
  const centerStrike = price;
  const lowerStrike = centerStrike - wingWidth;
  const upperStrike = centerStrike + wingWidth;
  const netDebit = 1.25;

  return {
    strategy: 'Long Call Butterfly (Mock)',
    symbol, expiration, underlyingPrice: price,
    legs: [
      { type: 'call', side: 'long', strike: lowerStrike, premium: 5.50, qty: 1 },
      { type: 'call', side: 'short', strike: centerStrike, premium: 2.50, qty: 2 },
      { type: 'call', side: 'long', strike: upperStrike, premium: 0.75, qty: 1 }
    ],
    netDebit: netDebit * 100,
    maxProfit: (wingWidth - netDebit) * 100,
    maxRisk: netDebit * 100,
    breakEvenLower: lowerStrike + netDebit,
    breakEvenUpper: upperStrike - netDebit,
    profitZone: `${(lowerStrike + netDebit).toFixed(2)} - ${(upperStrike - netDebit).toFixed(2)}`,
    probabilityOfProfit: 0.30,
    riskRewardRatio: '3.00'
  };
}

export default {
  buildIronCondor,
  buildStrangle,
  buildButterfly
};
