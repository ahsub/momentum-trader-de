import { fetchKoAggregatorData, filterLeapCandidates, filterPmccCandidates } from './koAggregatorBridge';

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || '';

async function fetchFinnhubOptions(symbol) {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`[Screener] Finnhub options failed for ${symbol}:`, e);
    return null;
  }
}

function mockEnrich(symbol, price) {
  const ivRank = Math.floor(Math.random() * 35);
  const delta = 0.80 + Math.random() * 0.10;
  const dte = 300 + Math.floor(Math.random() * 240);
  return { symbol, price, ivRank, delta: parseFloat(delta.toFixed(2)), dte, extrinsicPct: Math.floor(Math.random() * 18), source: 'Mock' };
}

export async function screenLeapCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterLeapCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      return { ...mockEnrich(t.symbol, t.price), ...t, strategy: 'LEAP', eligible: true };
    }
    const validExp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 300;
    });
    if (!validExp) return { ...t, strategy: 'LEAP', eligible: false, reason: 'No LEAP expiration found' };
    const strikes = validExp.options?.map(o => o.strike) || [];
    const itmStrike = strikes.filter(s => s < t.price).sort((a, b) => b - a)[0];
    const intrinsic = Math.max(0, t.price - (itmStrike || t.price * 0.85));
    const mockPrice = intrinsic * 1.15;
    return { ...t, strategy: 'LEAP', eligible: true, expiration: validExp.expirationDate, dte: Math.floor((new Date(validExp.expirationDate) - new Date()) / 86400000), delta: 0.85, ivRank: Math.floor(t.hvp), extrinsicPct: parseFloat((((mockPrice - intrinsic) / mockPrice) * 100).toFixed(1)), source: 'Finnhub' };
  }));
  return enriched.filter(e => e.eligible !== false);
}

export async function screenPmccCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterPmccCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      const mock = mockEnrich(t.symbol, t.price);
      return { ...t, ...mock, strategy: 'PMCC', eligible: true, shortDte: 35, shortDelta: 0.25, width: 20, netDebit: 15, source: 'Mock' };
    }
    const leapExp = options.data.find(exp => Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000) >= 180);
    const shortExp = options.data.find(exp => { const d = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000); return d >= 25 && d <= 50; });
    if (!leapExp || !shortExp) return { ...t, strategy: 'PMCC', eligible: false, reason: 'Missing expirations' };
    const longStrike = t.price * 0.85, shortStrike = t.price * 1.05, width = shortStrike - longStrike;
    const longPremium = (t.price - longStrike) * 1.2, shortPremium = (shortStrike - t.price) * 0.4, netDebit = longPremium - shortPremium;
    return { ...t, strategy: 'PMCC', eligible: true, longStrike: parseFloat(longStrike.toFixed(2)), shortStrike: parseFloat(shortStrike.toFixed(2)), width: parseFloat(width.toFixed(2)), netDebit: parseFloat(netDebit.toFixed(2)), longDte: Math.floor((new Date(leapExp.expirationDate) - new Date()) / 86400000), shortDte: Math.floor((new Date(shortExp.expirationDate) - new Date()) / 86400000), longDelta: 0.85, shortDelta: 0.25, annualizedCoc: parseFloat(((shortPremium / netDebit) * (365 / 35) * 100).toFixed(1)), source: 'Finnhub' };
  }));
  return enriched.filter(e => e.eligible !== false);
}

export function validatePmccWidthRule(pmcc) {
  if (!pmcc.width || !pmcc.netDebit) return { valid: false, reason: 'Missing data' };
  const widthRule = pmcc.width - pmcc.netDebit;
  return { valid: widthRule > 0, widthRule: parseFloat(widthRule.toFixed(2)), maxProfit: parseFloat((widthRule * 100).toFixed(2)), maxLoss: parseFloat((pmcc.netDebit * 100).toFixed(2)) };
}
