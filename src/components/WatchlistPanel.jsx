import { useState } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function WatchlistPanel() {
  const [watchlist, setWatchlist] = useState([
    { ticker: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: 5.2, gap: 8.1, rvol: 4.2, catalyst: 'Earnings Beat', type: 'momentum' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 875.30, change: 2.1, gap: 3.5, rvol: 2.8, catalyst: 'Analyst Upgrade', type: 'trend' },
    { ticker: 'PLTR', name: 'Palantir Tech', price: 34.20, change: -1.5, gap: -2.0, rvol: 1.5, catalyst: 'Keine', type: 'none' },
  ])
  const [newTicker, setNewTicker] = useState('')

  const addTicker = () => {
    if (!newTicker.trim()) return
    setWatchlist([...watchlist, {
      ticker: newTicker.toUpperCase(),
      name: newTicker.toUpperCase(),
      price: 0,
      change: 0,
      gap: 0,
      rvol: 0,
      catalyst: 'Manuell hinzugefügt',
      type: 'none'
    }])
    setNewTicker('')
  }

  const removeTicker = (ticker) => {
    setWatchlist(watchlist.filter(t => t.ticker !== ticker))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={newTicker}
          onChange={e => setNewTicker(e.target.value)}
          placeholder="Ticker eingeben (z.B. TSLA)..."
          className="flex-1 px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono text-sm"
          onKeyDown={e => e.key === 'Enter' && addTicker()}
        />
        <button
          onClick={addTicker}
          className="px-4 py-2 bg-accent text-slate-950 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Hinzufügen
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="text-left py-2 px-3 font-semibold">Ticker</th>
              <th className="text-left py-2 px-3 font-semibold">Kurs</th>
              <th className="text-left py-2 px-3 font-semibold">Change</th>
              <th className="text-left py-2 px-3 font-semibold">Gap %</th>
              <th className="text-left py-2 px-3 font-semibold">RVOL</th>
              <th className="text-left py-2 px-3 font-semibold">Catalyst</th>
              <th className="text-left py-2 px-3 font-semibold">Typ</th>
              <th className="text-right py-2 px-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((stock) => (
              <tr key={stock.ticker} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 px-3">
                  <div className="font-bold font-mono">{stock.ticker}</div>
                  <div className="text-xs text-slate-500">{stock.name}</div>
                </td>
                <td className="py-2.5 px-3 font-mono">{stock.price.toFixed(2)} €</td>
                <td className="py-2.5 px-3">
                  <span className={`flex items-center gap-1 font-mono ${stock.change > 0 ? 'text-accent' : stock.change < 0 ? 'text-danger' : 'text-slate-500'}`}>
                    {stock.change > 0 ? <TrendingUp className="w-3 h-3" /> : stock.change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {stock.change > 0 ? '+' : ''}{stock.change}%
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono">{stock.gap > 0 ? '+' : ''}{stock.gap}%</td>
                <td className="py-2.5 px-3 font-mono">{stock.rvol}x</td>
                <td className="py-2.5 px-3 text-slate-400">{stock.catalyst}</td>
                <td className="py-2.5 px-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    stock.type === 'momentum' ? 'bg-accent/20 text-accent' :
                    stock.type === 'trend' ? 'bg-accent-dark/20 text-accent-dark' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {stock.type === 'momentum' ? 'MOMENTUM' : stock.type === 'trend' ? 'TREND' : '—'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => removeTicker(stock.ticker)}
                    className="p-1.5 text-slate-600 hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}