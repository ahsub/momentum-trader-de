import React, { useState, useEffect } from 'react'
import { fetchGapData, filterGaps, getMockGaps, DEFAULT_GAP_FILTER } from '../services/gapApiService.jsx'
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Activity, Filter } from 'lucide-react'

const DEFAULT_TICKERS = ['AAPL', 'TSLA', 'NVDA', 'AMD', 'META', 'PLTR', 'INTC', 'BA', 'MSFT', 'GOOGL']

export default function GapScanner() {
  const [gaps, setGaps] = useState([])
  const [filter, setFilter] = useState(DEFAULT_GAP_FILTER)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastScan, setLastScan] = useState('')
  const [usingMock, setUsingMock] = useState(false)

  const scan = async () => {
    setLoading(true)
    setError(null)
    setUsingMock(false)

    try {
      console.log('Starting API scan...')
      const results = []
      let apiErrors = 0

      for (const ticker of DEFAULT_TICKERS) {
        const result = await fetchGapData(ticker)
        if (result) {
          results.push(result)
        } else {
          apiErrors++
        }
      }

      // Wenn alle APIs failen → Mock-Daten als Fallback
      if (results.length === 0) {
        console.warn('All APIs failed, using mock data')
        results.push(...getMockGaps())
        setUsingMock(true)
      }

      // Filter anwenden
      const filtered = filterGaps(results, filter)
      setGaps(filtered)
      setLastScan(new Date().toLocaleTimeString('de-DE'))

      if (apiErrors > 0 && !usingMock) {
        setError(`${apiErrors}/${DEFAULT_TICKERS.length} Tickers konnten nicht geladen werden.`)
      }

    } catch (err) {
      console.error('Scan error:', err)
      setError('Fehler beim Scannen. Fallback auf Mock-Daten.')
      setGaps(getMockGaps())
      setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  const getAlertColors = (level) => {
    switch (level) {
      case 'BREAKOUT': return 'bg-red-500/10 border-red-500/30 text-red-400'
      case 'ALERT':    return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      case 'WATCH':    return 'bg-blue-500/10 border-blue-500/30 text-blue-400'
      case 'INFO':     return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    }
  }

  const getBadgeColor = (level) => {
    switch (level) {
      case 'BREAKOUT': return 'bg-red-500 text-white'
      case 'ALERT':    return 'bg-amber-500 text-white'
      case 'WATCH':    return 'bg-blue-500 text-white'
      case 'INFO':     return 'bg-emerald-500 text-white'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Pre-Market Gap Scanner
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {lastScan ? `Letzter Scan: ${lastScan}` : 'Scan wird durchgeführt...'}
            {usingMock && <span className="ml-2 text-amber-400">⚠️ Mock-Daten</span>}
          </p>
        </div>
        <button
          onClick={scan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-slate-950 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning...' : 'Neu scannen'}
        </button>
      </div>

      {/* Error / Info */}
      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {/* Filter Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-400">Filter</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Min. Gap %</label>
            <input
              type="number" step="0.5" value={filter.minGapPct}
              onChange={e => setFilter({...filter, minGapPct: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max. Gap %</label>
            <input
              type="number" step="0.5" value={filter.maxGapPct}
              onChange={e => setFilter({...filter, maxGapPct: parseFloat(e.target.value) || 100})}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Min. Avg Volume</label>
            <select
              value={filter.minAvgVolume}
              onChange={e => setFilter({...filter, minAvgVolume: parseInt(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm"
            >
              <option value={0}>Alle</option>
              <option value={100000}>100K</option>
              <option value={500000}>500K</option>
              <option value={1000000}>1M</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.onlyLong}
                onChange={e => setFilter({...filter, onlyLong: e.target.checked})}
                className="rounded border-slate-700 bg-slate-950"
              />
              Nur Long
            </label>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Lade echte Daten von APIs...</p>
          <p className="text-xs mt-2">Twelvedata → Finnhub → Mock Fallback</p>
        </div>
      )}

      {/* Results */}
      {!loading && gaps.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          Keine Gap-Setups gefunden. Passe die Filter an.
        </div>
      )}

      <div className="grid gap-3">
        {gaps.map(gap => {
          const openPrice = gap.prevClose * (1 + (gap.gapDirection === 'UP' ? gap.gapPct / 100 : -gap.gapPct / 100))

          return (
            <div key={gap.ticker} className={`rounded-2xl border p-4 ${getAlertColors(gap.alertLevel)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getBadgeColor(gap.alertLevel)}`}>
                    {gap.alertLevel}
                  </span>
                  <div>
                    <div className="text-lg font-bold">{gap.ticker}</div>
                    <div className="text-xs opacity-70">
                      Prev: ${gap.prevClose.toFixed(2)} → Open: ${openPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold flex items-center gap-1 ${gap.gapDirection === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {gap.gapDirection === 'UP' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    {gap.gapDirection === 'UP' ? '+' : ''}{gap.gapPct.toFixed(1)}%
                  </div>
                  <div className="text-xs opacity-70">Score: {gap.setupScore}/100</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-current/20">
                <div>
                  <div className="text-xs opacity-50">Volumen</div>
                  <div className="text-sm font-semibold">{(gap.avgVolume20d / 1000000).toFixed(1)}M</div>
                </div>
                <div>
                  <div className="text-xs opacity-50">ATR(14)</div>
                  <div className="text-sm font-semibold">${gap.atr14.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs opacity-50">Vol-Ratio</div>
                  <div className="text-sm font-semibold">{gap.volumeRatio.toFixed(1)}x</div>
                </div>
                <div>
                  <div className="text-xs opacity-50">Quelle</div>
                  <div className="text-sm font-semibold">{gap.source}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
