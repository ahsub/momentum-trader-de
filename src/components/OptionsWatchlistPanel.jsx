// ═══════════════════════════════════════════════════════════════════════════
// OPTIONS WATCHLIST PANEL — Zeigt die 50 KI-priorisierten Kandidaten
// aus dem Aggregator als "Top Picks" an
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { fetchOptionsWatchlist, filterWatchlistByStrategy, sortWatchlist } from '../services/watchlistBridge';

export default function OptionsWatchlistPanel({ strategy = 'all', onSelect }) {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('score');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOptionsWatchlist();
      setWatchlist(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = strategy === 'all' 
    ? watchlist 
    : filterWatchlistByStrategy(watchlist, strategy);

  const sorted = sortWatchlist(filtered, sortBy);

  if (loading) return <div className="text-slate-400 text-sm">Lade KI-Watchlist...</div>;
  if (error) return <div className="text-red-400 text-sm">⚠️ {error}</div>;
  if (watchlist.length === 0) return <div className="text-slate-500 text-sm">Keine Watchlist-Daten verfügbar</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          🎯 KI-Watchlist — {sorted.length} Kandidaten
          {strategy !== 'all' && <span className="text-slate-500 ml-1">({strategy})</span>}
        </h3>
        <div className="flex gap-2">
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
            className="text-xs bg-slate-800 text-slate-300 rounded px-2 py-1 border border-slate-700"
          >
            <option value="score">Score</option>
            <option value="price">Price</option>
            <option value="ivRank">IV Rank</option>
          </select>
          <button 
            onClick={loadWatchlist}
            className="text-xs bg-slate-800 text-slate-300 rounded px-2 py-1 hover:bg-slate-700"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-2 py-1 text-slate-500">#</th>
              <th className="text-left px-2 py-1 text-slate-500">Symbol</th>
              <th className="text-left px-2 py-1 text-slate-500">Strat</th>
              <th className="text-left px-2 py-1 text-slate-500">Score</th>
              <th className="text-left px-2 py-1 text-slate-500">Price</th>
              <th className="text-left px-2 py-1 text-slate-500">KI-Strike</th>
              <th className="text-left px-2 py-1 text-slate-500">DTE</th>
              <th className="text-left px-2 py-1 text-slate-500">IV Rank</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 20).map((item, i) => (
              <tr 
                key={item.symbol} 
                onClick={() => onSelect?.(item)}
                className="border-b border-slate-800/30 hover:bg-slate-800/50 cursor-pointer"
              >
                <td className="px-2 py-1 text-slate-500">{i + 1}</td>
                <td className="px-2 py-1 font-medium text-white">{item.symbol}</td>
                <td className="px-2 py-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    item.strategy === 'csp' || item.strategy === 'csp_wheel' 
                      ? 'bg-emerald-500/10 text-emerald-400' :
                    item.strategy === 'cc' 
                      ? 'bg-blue-500/10 text-blue-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {item.strategy}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <span className={`${
                    item.score >= 80 ? 'text-emerald-400' :
                    item.score >= 60 ? 'text-amber-400' :
                    'text-slate-400'
                  }`}>
                    {Math.round(item.score)}
                  </span>
                </td>
                <td className="px-2 py-1">${fmt(item.price)}</td>
                <td className="px-2 py-1 text-slate-300">{item.strike ? '$'+fmt(item.strike) : '—'}</td>
                <td className="px-2 py-1">{item.dte || '—'}</td>
                <td className="px-2 py-1">{item.ivRank ? Math.round(item.ivRank) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
