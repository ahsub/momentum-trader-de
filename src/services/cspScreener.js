// ═══════════════════════════════════════════════════════════════════════════
// CSP SCREENER — Cash-Secured Put (at-the-money / no-assignment)
// Eric-Ludwig-Style: ITM-Wahrscheinlichkeit minimieren, Prämie maximieren
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
  } catch (e) {
    console.warn(`[CSP] Finnhub options failed for ${symbol}:`, e);
    return null;
  }
}

// ─── FILTER ───────────────────────────────────────────────────────────────

export function filterCspCandidates(tickers) {
  return tickers.filter(t => {
    const priceOk = t.price >= 20 && t.price <= 200;
    const trendOk = t.price > t.ema50;
    const rsiOk = t.rsi14 >= 35 && t.rsi14 <= 55;
    const hvpOk = t.hvp >= 20 && t.hvp <= 55;
    const ivRankOk = t.ivRank >= 30;
    const scoreOk = (t.compositeScore >= 60) || (t.scoreCsp >= 60);
    const regimeOk = !t.regime?.toLowerCase().includes('bear');
    return priceOk && trendOk && rsiOk && hvpOk && ivRankOk && scoreOk && regimeOk;
  });
}

// ─── ENRICHMENT ───────────────────────────────────────────────────────────

export async function screenCspCandidates(uiq = null) {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterCspCandidates(koData);

  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);

    if (!options || !options.data?.length) {
      return mockCspEnrich(t, uiq);
    }

    const targetExp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 25 && dte <= 50;
    });

    if (!targetExp) return { ...t, strategy: 'CSP', eligible: false, reason: 'No 30-45 DTE expiration' };

    const strikes = targetExp.options?.map(o => o.strike).sort((a, b) => a - b) || [];
    if (strikes.length === 0) return { ...t, strategy: 'CSP', eligible: false, reason: 'No strikes' };

    const atmStrike = strikes.reduce((prev, curr) =>
      Math.abs(curr - t.price) < Math.abs(prev - t.price) ? curr : prev
    );

    const otmTarget = t.price * 0.95;
    const otmStrike = strikes.filter(s => s <= otmTarget).sort((a, b) => b - a)[0] || atmStrike;

    const dte = Math.floor((new Date(targetExp.expirationDate) - new Date()) / 86400000);
    const iv = (t.ivAtm || t.hvp || 30) / 100;
    const atmPremium = t.price * iv * Math.sqrt(dte / 365);
    const otmPremium = atmPremium * 0.6;
    const itmProb = estimateItmProbability(t.price, otmStrike, iv, dte);

    const result = {
      ...t,
      strategy: 'CSP',
      eligible: true,
      expiration: targetExp.expirationDate,
      dte,
      atmStrike,
      otmStrike,
      atmPremium: parseFloat(atmPremium.toFixed(2)),
      otmPremium: parseFloat(otmPremium.toFixed(2)),
      itmProbability: parseFloat(itmProb.toFixed(1)),
      annualizedReturn: parseFloat(((otmPremium / otmStrike) * (365 / dte) * 100).toFixed(1)),
      maxLoss: parseFloat((otmStrike - otmPremium).toFixed(2)),
      be: parseFloat((otmStrike - otmPremium).toFixed(2)),
      marginRequired: parseFloat((otmStrike * 100).toFixed(2)),
      source: 'Finnhub'
    };

    if (uiq) {
      result.finalScore = scoreWithUiq(t, 'csp', uiq);
    }

    return result;
  }));

  return enriched
    .filter(e => e.eligible !== false)
    .sort((a, b) => (b.finalScore || b.compositeScore) - (a.finalScore || a.compositeScore));
}

// ─── MOCK ─────────────────────────────────────────────────────────────────

function mockCspEnrich(t, uiq) {
  const iv = (t.hvp || 30) / 100;
  const dte = 35;
  const otmStrike = parseFloat((t.price * 0.95).toFixed(2));
  const premium = t.price * iv * Math.sqrt(dte / 365) * 0.6;

  const result = {
    ...t,
    strategy: 'CSP',
    eligible: true,
    expiration: new Date(Date.now() + dte * 86400000).toISOString().split('T')[0],
    dte,
    atmStrike: parseFloat(t.price.toFixed(2)),
    otmStrike,
    atmPremium: parseFloat((premium * 1.4).toFixed(2)),
    otmPremium: parseFloat(premium.toFixed(2)),
    itmProbability: parseFloat((Math.random() * 15 + 5).toFixed(1)),
    annualizedReturn: parseFloat(((premium / otmStrike) * (365 / dte) * 100).toFixed(1)),
    maxLoss: parseFloat((otmStrike - premium).toFixed(2)),
    be: parseFloat((otmStrike - premium).toFixed(2)),
    marginRequired: parseFloat((otmStrike * 100).toFixed(2)),
    source: 'Mock'
  };

  if (uiq) result.finalScore = scoreWithUiq(t, 'csp', uiq);
  return result;
}

// ─── HILFSFUNKTIONEN ──────────────────────────────────────────────────────

function estimateItmProbability(price, strike, iv, dte) {
  const t = dte / 365;
  const d1 = (Math.log(price / strike) + (0.5 * iv * iv) * t) / (iv * Math.sqrt(t));
  const d2 = d1 - iv * Math.sqrt(t);
  return cdfNormal(d2) * 100;
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
