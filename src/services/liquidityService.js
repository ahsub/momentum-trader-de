/**
 * Liquidity Service – OI, Volume, Bid-Ask-Spread via Finnhub
 * Ampel-System: Grün (liquid) / Gelb (mittel) / Rot (illiquid)
 */

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || '';

const liquidityCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function getOptionLiquidity(symbol, strike, expiry, putCall) {
  const cacheKey = `${symbol}_${strike}_${expiry}_${putCall}`;
  const cached = liquidityCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  if (!FINNHUB_KEY) return getMockLiquidity(symbol);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) throw new Error('Finnhub option chain failed');

    const data = await res.json();
    const match = findOptionMatch(data.data || [], strike, expiry, putCall);
    if (!match) return getMockLiquidity(symbol);

    const oi = match.openInterest || 0;
    const volume = match.volume || 0;
    const bid = match.bid || 0;
    const ask = match.ask || 0;
    const last = match.lastPrice || ((bid + ask) / 2);
    const spread = ask - bid;
    const spreadPct = last > 0 ? (spread / last) * 100 : 0;

    const result = calculateLiquidityScore({ oi, volume, spread, spreadPct, last });
    liquidityCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    return getMockLiquidity(symbol);
  }
}

export async function getStockLiquidity(symbol) {
  const cacheKey = `stock_${symbol}`;
  const cached = liquidityCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  if (!FINNHUB_KEY) return getMockStockLiquidity(symbol);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) throw new Error('Finnhub quote failed');

    const quote = await res.json();
    const spread = (quote.a || 0) - (quote.b || 0);
    const last = quote.c || 0;
    const spreadPct = last > 0 ? (spread / last) * 100 : 0;

    const result = {
      symbol, bid: quote.b || 0, ask: quote.a || 0, spread,
      spreadPct: parseFloat(spreadPct.toFixed(2)), lastPrice: last,
      volume: 0, avgVolume: 0,
      status: spreadPct < 0.1 ? 'LIQUID' : spreadPct < 0.5 ? 'MODERATE' : 'ILLIQUID',
      score: calculateStockLiquidityScore({ spreadPct }),
      timestamp: new Date().toISOString(), source: 'Finnhub',
    };

    liquidityCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    return getMockStockLiquidity(symbol);
  }
}

function findOptionMatch(chainData, targetStrike, targetExpiry, putCall) {
  for (const entry of chainData) {
    if (entry.expirationDate !== targetExpiry) continue;
    for (const option of (entry.options || [])) {
      if (Math.abs(option.strike - targetStrike) < 0.01 && option.contractSymbol?.includes(putCall === 'PUT' ? 'P' : 'C')) {
        return option;
      }
    }
  }
  return null;
}

function calculateLiquidityScore({ oi, volume, spread, spreadPct, last }) {
  let oiScore = oi >= 1000 ? 40 : oi >= 500 ? 30 : oi >= 100 ? 20 : oi >= 50 ? 10 : 0;
  let volScore = volume >= 500 ? 30 : volume >= 200 ? 20 : volume >= 50 ? 10 : 0;
  let spreadScore = spreadPct <= 1 ? 30 : spreadPct <= 3 ? 20 : spreadPct <= 5 ? 10 : 0;
  const totalScore = oiScore + volScore + spreadScore;

  return {
    oi, volume, bidAskSpread: spread, spreadPct: parseFloat(spreadPct.toFixed(2)),
    lastPrice: last, score: totalScore,
    status: totalScore >= 70 ? 'LIQUID' : totalScore >= 40 ? 'MODERATE' : 'ILLIQUID',
    oiScore, volScore, spreadScore,
    timestamp: new Date().toISOString(), source: 'Finnhub',
  };
}

function calculateStockLiquidityScore({ spreadPct }) {
  if (spreadPct < 0.1) return 95;
  if (spreadPct < 0.3) return 85;
  if (spreadPct < 0.5) return 70;
  if (spreadPct < 1.0) return 50;
  return 30;
}

function getMockLiquidity(symbol) {
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const oi = [50, 120, 300, 600, 1200, 2500][hash % 6];
  const volume = [10, 30, 80, 150, 400, 800][hash % 6];
  const spreadPct = [0.5, 1.2, 2.5, 4.0, 6.5, 10.0][hash % 6];
  return calculateLiquidityScore({ oi, volume, spread: spreadPct * 2, spreadPct, last: 2.5 });
}

function getMockStockLiquidity(symbol) {
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const spreadPct = [0.02, 0.05, 0.1, 0.3, 0.8, 2.0][hash % 6];
  return {
    symbol, bid: 100 - spreadPct, ask: 100 + spreadPct, spread: spreadPct * 2,
    spreadPct: parseFloat(spreadPct.toFixed(2)), lastPrice: 100,
    volume: 0, avgVolume: 0,
    status: spreadPct < 0.1 ? 'LIQUID' : spreadPct < 0.5 ? 'MODERATE' : 'ILLIQUID',
    score: calculateStockLiquidityScore({ spreadPct }),
    timestamp: new Date().toISOString(), source: 'Mock',
  };
}

export function getLiquidityColor(status) {
  return { LIQUID: 'text-emerald-400', MODERATE: 'text-amber-400', ILLIQUID: 'text-red-400' }[status] || 'text-slate-400';
}

export function getLiquidityBg(status) {
  return { LIQUID: 'bg-emerald-500/10', MODERATE: 'bg-amber-500/10', ILLIQUID: 'bg-red-500/10' }[status] || 'bg-slate-800';
}

export function getLiquidityIcon(status) {
  return { LIQUID: '🟢', MODERATE: '🟡', ILLIQUID: '🔴' }[status] || '⚪';
}
