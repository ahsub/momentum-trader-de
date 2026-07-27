// ═══════════════════════════════════════════════════════════════════════════
// PROTECTIVE COLLAR SCREENER — Portfolio-Absicherung
// Long Put + Short Call = Downside-Schutz bei geringem/keinem Kostenaufwand
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

export function filterCollarCandidates(tickers, portfolio = []) {
  // Wenn Portfolio vorhanden: Nur Bestand-Ticker
  const targets = portfolio.length > 0
    ? tickers.filter(t => portfolio.some(p => p.symbol === t.symbol))
    : tickers;

  return targets.filter(t => {
    const priceOk = t.price >= 20;
    const trendOk = t.price > t.ema200; // Long-Term-Holding
    const scoreOk = t.compositeScore >= 50;
    const hvpOk = t.hvp >= 20; // Genug Vola für Prämie
    return priceOk && trendOk && scoreOk && hvpOk;
  });
}

// ─── ENRICHMENT ───────────────────────────────────────────────────────────

export async function screenProtectiveCollarCandidates(portfolio = [], uiq = null) {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterCollarCandidates(koData, portfolio);

  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);

    if (!options || !options.data?.length) {
      return mockCollarEnrich(t, uiq, portfolio);
    }

    // 30-60 DTE für Collar
    const targetExp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 30 && dte <= 60;
    });

    if (!targetExp) return { ...t, strategy: 'COLLAR', eligible: false, reason: 'No 30-60 DTE expiration' };

    const strikes = targetExp.options?.map(o => o.strike).sort((a, b) => a - b) || [];
    if (strikes.length === 0) return { ...t, strategy: 'COLLAR', eligible: false, reason: 'No strikes' };

    // Put: 5-10% OTM (Schutz)
    const putTarget = t.price * 0.92;
    const putStrike = strikes.filter(s => s <= putTarget).sort((a, b) => b - a)[0] || strikes[0];

    // Call: 5-10% OTM (Prämie)
    const callTarget = t.price * 1.08;
    const callStrike = strikes.filter(s => s >= callTarget).sort((a, b) => a - b)[0] || strikes[strikes.length - 1];

    const dte = Math.floor((new Date(targetExp.expirationDate) - new Date()) / 86400000);
    const iv = (t.ivAtm || t.hvp || 30) / 100;

    const putCost = t.price * iv * Math.sqrt(dte / 365) * 0.6;
    const callPremium = t.price * iv * Math.sqrt(dte / 365) * 0.4;
    const netCost = putCost - callPremium;

    const portfolioItem = portfolio.find(p => p.symbol === t.symbol);
    const costBasis = portfolioItem?.costBasis || t.price;

    const result = {
      ...t,
      strategy: 'COLLAR',
      eligible: true,
      expiration: targetExp.expirationDate,
      dte,
      putStrike,
      callStrike,
      putCost: parseFloat(putCost.toFixed(2)),
      callPremium: parseFloat(callPremium.toFixed(2)),
      netCost: parseFloat(netCost.toFixed(2)),
      protection: parseFloat(((t.price - putStrike) / t.price * 100).toFixed(1)),
      upsideCap: parseFloat(((callStrike - t.price) / t.price * 100).toFixed(1)),
      costBasis: parseFloat(costBasis.toFixed(2)),
      maxLoss: parseFloat((putStrike - costBasis).toFixed(2)),
      maxProfit: parseFloat((callStrike - costBasis - netCost).toFixed(2)),
      source: 'Finnhub'
    };

    if (uiq) result.finalScore = scoreWithUiq(t, 'protectiveCollar', uiq);
    return result;
  }));

  return enriched
    .filter(e => e.eligible !== false)
    .sort((a, b) => (b.finalScore || b.compositeScore) - (a.finalScore || a.compositeScore));
}

// ─── MOCK ─────────────────────────────────────────────────────────────────

function mockCollarEnrich(t, uiq, portfolio) {
  const dte = 45;
  const putStrike = parseFloat((t.price * 0.92).toFixed(2));
  const callStrike = parseFloat((t.price * 1.08).toFixed(2));
  const putCost = t.price * 0.03;
  const callPremium = t.price * 0.025;
  const netCost = putCost - callPremium;

  const portfolioItem = portfolio.find(p => p.symbol === t.symbol);
  const costBasis = portfolioItem?.costBasis || t.price;

  const result = {
    ...t,
    strategy: 'COLLAR',
    eligible: true,
    expiration: new Date(Date.now() + dte * 86400000).toISOString().split('T')[0],
    dte,
    putStrike,
    callStrike,
    putCost: parseFloat(putCost.toFixed(2)),
    callPremium: parseFloat(callPremium.toFixed(2)),
    netCost: parseFloat(netCost.toFixed(2)),
    protection: parseFloat(((t.price - putStrike) / t.price * 100).toFixed(1)),
    upsideCap: parseFloat(((callStrike - t.price) / t.price * 100).toFixed(1)),
    costBasis: parseFloat(costBasis.toFixed(2)),
    maxLoss: parseFloat((putStrike - costBasis).toFixed(2)),
    maxProfit: parseFloat((callStrike - costBasis - netCost).toFixed(2)),
    source: 'Mock'
  };

  if (uiq) result.finalScore = scoreWithUiq(t, 'protectiveCollar', uiq);
  return result;
}
