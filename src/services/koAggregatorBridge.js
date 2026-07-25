const KV_ENDPOINT = 'https://ko-sync.ahildebrand.workers.dev/public/master_market_data';
const GITHUB_FALLBACK = 'https://raw.githubusercontent.com/ahsub/ko-aggregator/main/backups/tr_backup_latest.json';

const CACHE_TTL = 5 * 60 * 1000;
let cache = null;
let cacheTime = 0;

export async function fetchKoAggregatorData() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  try {
    const res = await fetch(KV_ENDPOINT);
    if (!res.ok) throw new Error('KV fetch failed');
    const data = await res.json();
    cache = normalizeKoData(data);
    cacheTime = Date.now();
    return cache;
  } catch (err) {
    console.warn('[KO-Bridge] KV failed, trying GitHub fallback:', err);
    try {
      const res = await fetch(GITHUB_FALLBACK);
      const data = await res.json();
      cache = normalizeKoData(data);
      cacheTime = Date.now();
      return cache;
    } catch (err2) {
      console.error('[KO-Bridge] Fallback failed:', err2);
      return [];
    }
  }
}

function normalizeKoData(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.data || raw?.tickers || [];
  return arr.map(t => ({
    symbol: t.symbol || t.ticker || t.name,
    price: parseFloat(t.price || t.close || 0),
    compositeScore: parseFloat(t.compositeScore || t.score || t.trendScore || 0),
    ema20: parseFloat(t.ema20 || t.EMA20 || 0),
    ema50: parseFloat(t.ema50 || t.EMA50 || 0),
    ema200: parseFloat(t.ema200 || t.EMA200 || 0),
    rsi14: parseFloat(t.rsi14 || t.RSI || t.rsi || 50),
    hvp: parseFloat(t.hvp || t.HVP || t.volatility || 30),
    regime: t.regime || t.markovRegime || t.trend || 'UNKNOWN',
    sma50: parseFloat(t.sma50 || t.SMA50 || 0),
    sma200: parseFloat(t.sma200 || t.SMA200 || 0),
    atr14: parseFloat(t.atr14 || t.ATR14 || 0),
    timestamp: t.timestamp || new Date().toISOString(),
  })).filter(t => t.symbol && t.price > 0);
}

export function filterLeapCandidates(tickers) {
  return tickers.filter(t => {
    const trendOk = t.price > t.ema200 && t.sma50 > t.sma200;
    const scoreOk = t.compositeScore >= 70;
    const rsiOk = t.rsi14 >= 45 && t.rsi14 <= 62;
    const hvpOk = t.hvp < 40;
    const regimeOk = t.regime?.toLowerCase().includes('bull') || t.regime === 'BULL_QUIET';
    return trendOk && scoreOk && rsiOk && hvpOk && regimeOk;
  });
}

export function filterPmccCandidates(tickers) {
  return tickers.filter(t => {
    const trendOk = t.price > t.ema200 && t.sma50 > t.sma200;
    const scoreOk = t.compositeScore >= 65;
    const rsiOk = t.rsi14 >= 40 && t.rsi14 <= 65;
    const hvpOk = t.hvp < 45;
    return trendOk && scoreOk && rsiOk && hvpOk;
  });
}
