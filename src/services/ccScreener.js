// ═══════════════════════════════════════════════════════════════════════════
// CC SCREENER — Covered Call (für Bestand + neue Positionen)
// Nutzt scoreCc, chanHigh3sd, ivRank aus Aggregator
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
    return null;
  }
}

// ─── FILTER ───────────────────────────────────────────────────────────────

export function filterCcCandidates(tickers) {
  return tickers.filter(t => {
    const priceOk = t.price >= 15 && t.price <= 300;
    const trendOk = t.price > t.ema50; // Bullish-Trend
    const rsiOk = t.rsi14 >= 40 && t.rsi14 <= 70; // Nicht überkauft
    const hvpOk = t.hvp >= 15 && t.hvp <= 50; // Genug Vola für Prämie
    const ivRankOk = t.ivRank >= 25; // IV über historischem Durchschnitt
    const scoreOk = (t.compositeScore >= 55) || (t.scoreCc >= 55);
    return priceOk && trendOk && rsiOk && hvpOk && ivRankOk && scoreOk;
  });
}

// ─── ENRICHMENT ───────────────────────────────────────────────────────────

export async function screenCcCandidates(portfolio = [], uiq = null) {
  const koData = await fetchKoAggregatorData();

  // Wenn Portfolio vorhanden: Nur Bestand-Ticker
  const targetTickers = portfolio.length > 0
    ? koData.filter(t => portfolio.some(p => p.symbol === t.symbol))
    : koData;

  const preScreened = filterCcCandidates(targetTickers);

  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);

    if (!options || !options.data?.length) {
      return mockCcEnrich(t, uiq, portfolio);
    }

    // Nächste Monthly-Expiration (30-45 DTE)
    const targetExp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 25 && dte <= 50;
    });

    if (!targetExp) return { ...t, strategy: 'CC', eligible: false, reason: 'No 30-45 DTE expiration' };

    const strikes = targetExp.options?.map(o => o.strike).sort((a, b) => a - b) || [];
    if (strikes.length === 0) return { ...t, strategy: 'CC', eligible: false, reason: 'No strikes' };

    // OTM Call-Strike (5-10% über Kurs oder chanHigh3sd)
    const otmTarget = Math.max(t.price * 1.05, t.chanHigh3sd || t.price * 1.08);
    const callStrike = strikes.filter(s => s >= otmTarget).sort((a, b) => a - b)[0] || strikes[strikes.length - 1];

    const dte = Math.floor((new Date(targetExp.expirationDate) - new Date()) / 86400000);
    const iv = (t.ivAtm || t.hvp || 30) / 100;

    // Prämie schätzen
    const premium = t.price * iv * Math.sqrt(dte / 365) * 0.4; // OTM Call = ~40% der ATM-Prämie

    // Annualized Return
    const annualizedReturn = (premium / t.price) * (365 / dte) * 100;

    // Cost Basis (falls im Portfolio)
    const portfolioItem = portfolio.find(p => p.symbol === t.symbol);
    const costBasis = portfolioItem?.costBasis || t.price;
    const totalReturn = ((callStrike - costBasis + premium) / costBasis) * 100;

    const result = {
      ...t,
      strategy: 'CC',
      eligible: true,
      expiration: targetExp.expirationDate,
      dte,
      callStrike,
      premium: parseFloat(premium.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(1)),
      totalReturn: parseFloat(totalReturn.toFixed(1)),
      costBasis: parseFloat(costBasis.toFixed(2)),
      upsideCap: parseFloat(((callStrike - t.price) / t.price * 100).toFixed(1)),
      be: parseFloat((t.price - premium).toFixed(2)),
      source: 'Finnhub'
    };

    if (uiq) {
      result.finalScore = scoreWithUiq(t, 'cc', uiq);
    }

    return result;
  }));

  return enriched
    .filter(e => e.eligible !== false)
    .sort((a, b) => (b.finalScore || b.compositeScore) - (a.finalScore || a.compositeScore));
}

// ─── MOCK ─────────────────────────────────────────────────────────────────

function mockCcEnrich(t, uiq, portfolio) {
  const iv = (t.hvp || 30) / 100;
  const dte = 35;
  const callStrike = parseFloat((t.price * 1.08).toFixed(2));
  const premium = t.price * iv * Math.sqrt(dte / 365) * 0.4;

  const portfolioItem = portfolio.find(p => p.symbol === t.symbol);
  const costBasis = portfolioItem?.costBasis || t.price;

  const result = {
    ...t,
    strategy: 'CC',
    eligible: true,
    expiration: new Date(Date.now() + dte * 86400000).toISOString().split('T')[0],
    dte,
    callStrike,
    premium: parseFloat(premium.toFixed(2)),
    annualizedReturn: parseFloat(((premium / t.price) * (365 / dte) * 100).toFixed(1)),
    totalReturn: parseFloat(((callStrike - costBasis + premium) / costBasis * 100).toFixed(1)),
    costBasis: parseFloat(costBasis.toFixed(2)),
    upsideCap: parseFloat(((callStrike - t.price) / t.price * 100).toFixed(1)),
    be: parseFloat((t.price - premium).toFixed(2)),
    source: 'Mock'
  };

  if (uiq) result.finalScore = scoreWithUiq(t, 'cc', uiq);
  return result;
}
