// ═══════════════════════════════════════════════════════════════════════════
// WATCHLIST BRIDGE — Liefert die 50 KI-priorisierten Kandidaten
// aus master_market_data.optionsWatchlist
// ═══════════════════════════════════════════════════════════════════════════

import { fetchKoAggregatorData } from './koAggregatorBridge';

let watchlistCache = null;
let watchlistCacheTime = 0;
const WATCHLIST_CACHE_TTL = 5 * 60 * 1000; // 5 Min

// ─── PUBLIC API ───────────────────────────────────────────────────────────

export async function fetchOptionsWatchlist(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && watchlistCache && now - watchlistCacheTime < WATCHLIST_CACHE_TTL) {
    return watchlistCache;
  }

  try {
    // Wir holen die RAW-Daten direkt vom Worker (nicht den gecachten Tickers)
    const res = await fetch('https://ko-sync.ahildebrand.workers.dev/public/master_market_data');
    if (!res.ok) throw new Error('Worker failed');

    const data = await res.json();
    const master = data.data || data;
    const rawList = master.optionsWatchlist || [];

    watchlistCache = rawList.map(item => normalizeWatchlistItem(item));
    watchlistCacheTime = now;

    console.log(`[Watchlist] ✅ ${watchlistCache.length} KI-Kandidaten geladen`);
    return watchlistCache;
  } catch (err) {
    console.warn('[Watchlist] Fehler:', err.message);
    return watchlistCache || []; // Fallback auf alten Cache
  }
}

export function getCachedWatchlist() {
  return watchlistCache;
}

export function invalidateWatchlistCache() {
  watchlistCache = null;
  watchlistCacheTime = 0;
}

// ─── NORMALIZER ───────────────────────────────────────────────────────────

function normalizeWatchlistItem(item) {
  return {
    symbol: item.sym || item.symbol,
    strategy: item.strategy || item.strat || 'csp',
    price: parseFloat(item.price || 0),
    score: parseFloat(item.score || 0),
    ki: item.ki || null,           // KI-Recommendation (Strike, DTE, etc.)
    atr: parseFloat(item.atr || 0),
    dte: item.dte || null,         // Days to Expiration
    strike: item.strike || null,   // KI-suggested strike
    expiration: item.expiration || item.ivExpiry || null,
    ivAtm: parseFloat(item.ivAtm || 0),
    ivRank: parseFloat(item.ivRank || 0),
    source: 'Aggregator'
  };
}

// ─── FILTER & SORT ────────────────────────────────────────────────────────

export function filterWatchlistByStrategy(watchlist, strategy) {
  return watchlist.filter(w => 
    w.strategy?.toLowerCase().includes(strategy.toLowerCase()) ||
    (strategy === 'csp' && w.strategy === 'csp_wheel')
  );
}

export function sortWatchlist(watchlist, sortBy = 'score') {
  return [...watchlist].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
}
