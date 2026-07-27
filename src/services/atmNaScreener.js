// ═══════════════════════════════════════════════════════════════════════════
// ATM/NA SCREENER — At-The-Money Cash-Secured Put (No Assignment)
// Eric-Ludwig-Style: ATM für maximale Prämie, Roll-Strategie bei Bedrohung
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

export function filterAtmNaCandidates(tickers) {
  return tickers.filter(t => {
    const priceOk = t.price >= 20 && t.price <= 150; // ATM = teurere Margin
    const trendOk = t.price > t.ema50; // Bullish-Trend
    const rsiOk = t.rsi14 >= 40 && t.rsi14 <= 60; // Neutral
    const hvpOk = t.hvp >= 25 && t.hvp <= 55; // Genug Vola
    const ivRankOk = t.ivRank >= 35; // Hohe IV = reiche Prämien
    const scoreOk = (t.compositeScore >= 60) || (t.scoreCsp >= 60);
    const liquidityOk = t.marketCap > 1000000000; // > 1B Market Cap = liquid
    return priceOk && trendOk && rsiOk && hvpOk && ivRankOk && scoreOk && liquidityOk;
  });
}

// ─── ENRICHMENT ───────────────────────────────────────────────────────────

export async function screenAtmNaCandidates(uiq = null) {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterAtmNaCandidates(koData);

  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);

    if (!options || !options.data?.length) {
      return mockAtmNaEnrich(t, uiq);
    }

    // Nächste Wochen- oder Monats-Expiration (14-30 DTE für ATM/NA)
    const targetExp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 14 && dte <= 30;
    });

    if (!targetExp) return { ...t, strategy: 'ATM_NA', eligible: false, reason: 'No 14-30 DTE expiration' };

    const strikes = targetExp.options?.map(o => o.strike).sort((a, b) => a - b) || [];
    if (strikes.length === 0) return { ...t, strategy: 'ATM_NA', eligible: false, reason: 'No strikes' };

    // ATM-Strike (möglichst nah am Kurs)
    const atmStrike = strikes.reduce((prev, curr) =>
      Math.abs(curr - t.price) < Math.abs(prev - t.price) ? curr : prev
    );

    const dte = Math.floor((new Date(targetExp.expirationDate) - new Date()) / 86400000);
    const iv = (t.ivAtm || t.hvp || 30) / 100;

    // ATM-Premium (höher als OTM)
    const premium = t.price * iv * Math.sqrt(dte / 365);

    // ITM-Wahrscheinlichkeit bei ATM ≈ 50%
    const itmProb = estimateItmProbability(t.price, atmStrike, iv, dte);

    // Roll-Kosten schätzen (21 DTE Roll zu nächstem Monat)
    const rollCost = premium * 0.15; // ~15% der Prämie

    // POP (Probability of Profit) für ATM
    const pop = 50 + (ivRankToPopBonus(t.ivRank || 0)); // Basis 50% + IV-Bonus

    // Kelly Criterion (optimale Positionsgröße)
    const winProb = pop / 100;
    const winAmount = premium;
    const lossAmount = atmStrike - premium;
    const kelly = (winProb * winAmount - (1 - winProb) * lossAmount) / winAmount;

    const result = {
      ...t,
      strategy: 'ATM_NA',
      eligible: true,
      expiration: targetExp.expirationDate,
      dte,
      atmStrike,
      premium: parseFloat(premium.toFixed(2)),
      itmProbability: parseFloat(itmProb.toFixed(1)),
      pop: parseFloat(pop.toFixed(1)),
      annualizedReturn: parseFloat(((premium / atmStrike) * (365 / dte) * 100).toFixed(1)),
      rollCost: parseFloat(rollCost.toFixed(2)),
      kelly: parseFloat(Math.max(0, kelly).toFixed(2)),
      maxLoss: parseFloat((atmStrike - premium).toFixed(2)),
      be: parseFloat((atmStrike - premium).toFixed(2)),
      marginRequired: parseFloat((atmStrike * 100).toFixed(2)),
      assignmentRisk: itmProb > 40 ? 'HIGH' : itmProb > 25 ? 'MEDIUM' : 'LOW',
      source: 'Finnhub'
    };

    if (uiq) {
      result.finalScore = scoreWithUiq(t, 'csp', uiq) + (pop > 60 ? 5 : 0);
    }

    return result;
  }));

  return enriched
    .filter(e => e.eligible !== false)
    .sort((a, b) => (b.finalScore || b.compositeScore) - (a.finalScore || a.compositeScore));
}

// ─── MOCK ─────────────────────────────────────────────────────────────────

function mockAtmNaEnrich(t, uiq) {
  const iv = (t.hvp || 30) / 100;
  const dte = 21;
  const atmStrike = parseFloat(t.price.toFixed(2));
  const premium = t.price * iv * Math.sqrt(dte / 365);
  const itmProb = 50;
  const pop = 55;
  const rollCost = premium * 0.15;
  const kelly = 0.15;

  const result = {
    ...t,
    strategy: 'ATM_NA',
    eligible: true,
    expiration: new Date(Date.now() + dte * 86400000).toISOString().split('T')[0],
    dte,
    atmStrike,
    premium: parseFloat(premium.toFixed(2)),
    itmProbability: itmProb,
    pop,
    annualizedReturn: parseFloat(((premium / atmStrike) * (365 / dte) * 100).toFixed(1)),
    rollCost: parseFloat(rollCost.toFixed(2)),
    kelly,
    maxLoss: parseFloat((atmStrike - premium).toFixed(2)),
    be: parseFloat((atmStrike - premium).toFixed(2)),
    marginRequired: parseFloat((atmStrike * 100).toFixed(2)),
    assignmentRisk: 'MEDIUM',
    source: 'Mock'
  };

  if (uiq) result.finalScore = scoreWithUiq(t, 'csp', uiq) + 5;
  return result;
}

// ─── HILFSFUNKTIONEN ──────────────────────────────────────────────────────

function estimateItmProbability(price, strike, iv, dte) {
  const t = dte / 365;
  const d1 = (Math.log(price / strike) + (0.5 * iv * iv) * t) / (iv * Math.sqrt(t));
  const d2 = d1 - iv * Math.sqrt(t);
  return cdfNormal(d2) * 100;
}

function ivRankToPopBonus(ivRank) {
  if (ivRank >= 70) return 15;
  if (ivRank >= 50) return 10;
  if (ivRank >= 30) return 5;
  return 0;
}

function cdfNormal(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}
