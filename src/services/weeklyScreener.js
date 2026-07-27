// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY SCREENER — 7-14 DTE Options (T.R. Lawrence Stil)
// Hohe Gamma-Risk, schnelle Prämien-Vereinnahmung
// ═══════════════════════════════════════════════════════════════════════════

import { fetchKoAggregatorData } from './koAggregatorBridge';
import { scoreWithUiq } from './uiqBridge';

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || '';

async function fetchFinnhubOptions(symbol) {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// ─── FILTER ───────────────────────────────────────────────────────────────

export function filterWeeklyCandidates(tickers) {
  return tickers.filter(t => {
    const priceOk = t.price >= 20 && t.price <= 200;
    const hvpOk = t.hvp >= 30 && t.hvp <= 70; // Hohe Vola für Weeklys
    const ivRankOk = t.ivRank >= 40; // IV muss hoch sein
    const scoreOk = t.compositeScore >= 55;
    const trendOk = t.rsi14 >= 35 && t.rsi14 <= 65; // Neutral
    return priceOk && hvpOk && ivRankOk && scoreOk && trendOk;
  });
}

// ─── ENRICHMENT ───────────────────────────────────────────────────────────

export async function screenWeeklyCandidates(uiq = null) {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterWeeklyCandidates(koData);

  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);

    if (!options || !options.data?.length) {
      return mockWeeklyEnrich(t, uiq);
    }

    // Wöchentliche Expiration (7-14 DTE)
    const targetExp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 7 && dte <= 14;
    });

    if (!targetExp) return { ...t, strategy: 'WEEKLY', eligible: false, reason: 'No 7-14 DTE expiration' };

    const strikes = targetExp.options?.map(o => o.strike).sort((a, b) => a - b) || [];
    if (strikes.length === 0) return { ...t, strategy: 'WEEKLY', eligible: false, reason: 'No strikes' };

    const atmStrike = strikes.reduce((prev, curr) =>
      Math.abs(curr - t.price) < Math.abs(prev - t.price) ? curr : prev
    );

    const otmPut = strikes.filter(s => s <= t.price * 0.97).sort((a, b) => b - a)[0] || atmStrike;
    const otmCall = strikes.filter(s => s >= t.price * 1.03).sort((a, b) => a - b)[0] || atmStrike;

    const dte = Math.floor((new Date(targetExp.expirationDate) - new Date()) / 86400000);
    const iv = (t.ivAtm || t.hvp || 30) / 100;

    // Premium (höher bei Weeklys wegen Gamma)
    const putPremium = t.price * iv * Math.sqrt(dte / 365) * 0.5;
    const callPremium = t.price * iv * Math.sqrt(dte / 365) * 0.5;

    // Gamma-Risk: Gamma steigt mit 1/√DTE
    const gammaRisk = (1 / Math.sqrt(dte)) * 100;

    const result = {
      ...t,
      strategy: 'WEEKLY',
      eligible: true,
      expiration: targetExp.expirationDate,
      dte,
      atmStrike,
      putStrike: otmPut,
      callStrike: otmCall,
      putPremium: parseFloat(putPremium.toFixed(2)),
      callPremium: parseFloat(callPremium.toFixed(2)),
      totalPremium: parseFloat((putPremium + callPremium).toFixed(2)),
      gammaRisk: parseFloat(gammaRisk.toFixed(1)),
      annualizedReturn: parseFloat(((putPremium + callPremium) / t.price * (365 / dte) * 100).toFixed(1)),
      beLower: parseFloat((otmPut - putPremium).toFixed(2)),
      beUpper: parseFloat((otmCall + callPremium).toFixed(2)),
      source: 'Finnhub'
    };

    if (uiq) result.finalScore = scoreWithUiq(t, 'ironCondor', uiq);
    return result;
  }));

  return enriched
    .filter(e => e.eligible !== false)
    .sort((a, b) => (b.finalScore || b.compositeScore) - (a.finalScore || a.compositeScore));
}

// ─── MOCK ─────────────────────────────────────────────────────────────────

function mockWeeklyEnrich(t, uiq) {
  const iv = (t.hvp || 30) / 100;
  const dte = 10;
  const atmStrike = parseFloat(t.price.toFixed(2));
  const putStrike = parseFloat((t.price * 0.97).toFixed(2));
  const callStrike = parseFloat((t.price * 1.03).toFixed(2));
  const putPremium = t.price * iv * Math.sqrt(dte / 365) * 0.5;
  const callPremium = t.price * iv * Math.sqrt(dte / 365) * 0.5;

  const result = {
    ...t,
    strategy: 'WEEKLY',
    eligible: true,
    expiration: new Date(Date.now() + dte * 86400000).toISOString().split('T')[0],
    dte,
    atmStrike,
    putStrike,
    callStrike,
    putPremium: parseFloat(putPremium.toFixed(2)),
    callPremium: parseFloat(callPremium.toFixed(2)),
    totalPremium: parseFloat((putPremium + callPremium).toFixed(2)),
    gammaRisk: 31.6,
    annualizedReturn: parseFloat(((putPremium + callPremium) / t.price * (365 / dte) * 100).toFixed(1)),
    beLower: parseFloat((putStrike - putPremium).toFixed(2)),
    beUpper: parseFloat((callStrike + callPremium).toFixed(2)),
    source: 'Mock'
  };

  if (uiq) result.finalScore = scoreWithUiq(t, 'ironCondor', uiq);
  return result;
}
