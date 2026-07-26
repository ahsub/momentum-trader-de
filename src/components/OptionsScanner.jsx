import { useState, useCallback, useEffect } from 'react';
import {
  screenLeapCandidates,
  screenPmccCandidates,
  screenZebraCandidates,
  screenPutDiagonalCandidates,
  screenCollaredLeapCandidates,
  screenIronCondorCandidates,
  validatePmccWidthRule
} from '../services/optionsScreener';
import { getMarketMeta } from '../services/koAggregatorBridge';

const STRATEGIES = [
  { key: 'leap', label: 'LEAP', color: 'emerald' },
  { key: 'pmcc', label: 'PMCC', color: 'blue' },
  { key: 'zebra', label: 'ZEBRA', color: 'violet' },
  { key: 'putDiagonal', label: 'Put Diagonal', color: 'amber' },
  { key: 'collaredLeap', label: 'Collared LEAP', color: 'rose' },
  { key: 'ironCondor', label: 'Iron Condor', color: 'cyan' },
];

function fmt(n) {
  if (n === undefined || n === null || n === '') return '—';
  return typeof n === 'number' ? n.toFixed(2) : n;
}

function fmtPct(n) {
  if (n === undefined || n === null || n === '') return '—';
  return typeof n === 'number' ? n.toFixed(1) + '%' : n;
}

export default function OptionsScanner() {
  const [activeStrategy, setActiveStrategy] = useState('leap');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('');
  const [meta, setMeta] = useState({ lastTradingDay: null, errors: null, schema: null });

  useEffect(() => {
    setMeta(getMarketMeta());
  }, [results]);

  const runScan = useCallback(async () => {
    setLoading(true); setError(null); setSelected(null);
    try {
      let data;
      switch (activeStrategy) {
        case 'leap': data = await screenLeapCandidates(); break;
        case 'pmcc': data = await screenPmccCandidates(); break;
        case 'zebra': data = await screenZebraCandidates(); break;
        case 'putDiagonal': data = await screenPutDiagonalCandidates(); break;
        case 'collaredLeap': data = await screenCollaredLeapCandidates(); break;
        case 'ironCondor': data = await screenIronCondorCandidates(); break;
        default: data = [];
      }
      if (activeStrategy === 'pmcc') {
        data = data.map(d => ({ ...d, validation: validatePmccWidthRule(d) }));
      }
      setResults(data);
      setDataSource(data.length > 0 ? (data[0].source || 'Unknown') : '');
      setMeta(getMarketMeta());
    } catch (e) {
      setError(e.message); setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeStrategy]);

  const activeColor = STRATEGIES.find(s => s.key === activeStrategy)?.color || 'emerald';
  const isStale = meta.lastTradingDay && meta.lastTradingDay !== new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header mit Meta-Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Options Scanner</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-slate-400">v2.4.0 — Aggregator-first</span>
            {meta.schema && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">
                Schema {meta.schema}
              </span>
            )}
            {meta.lastTradingDay && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                isStale ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {isStale ? '⚠️ ' : ''}Handelstag: {meta.lastTradingDay}
              </span>
            )}
            {meta.errors !== null && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400">
                {meta.errors} Errors
              </span>
            )}
            {dataSource && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                dataSource === 'Aggregator' ? 'bg-blue-500/10 text-blue-400' :
                dataSource === 'Finnhub' ? 'bg-cyan-500/10 text-cyan-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>
                Source: {dataSource}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 self-start"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Scanning…
            </>
          ) : (
            'Run Scan'
          )}
        </button>
      </div>

      {/* Stale-Data Warnung */}
      {isStale && (
        <div className="p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-amber-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          Daten sind vom {meta.lastTradingDay} — heute ist kein Handelstag. Die Werte können veraltet sein.
        </div>
      )}

      {/* Strategy Tabs */}
      <div className="flex flex-wrap gap-2">
        {STRATEGIES.map(s => (
          <button
            key={s.key}
            onClick={() => { setActiveStrategy(s.key); setResults([]); setSelected(null); setError(null); }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeStrategy === s.key
                ? `bg-${s.color}-600 text-white shadow-lg shadow-${s.color}-900/30`
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Results Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left px-4 py-3 font-medium">Symbol</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-right px-4 py-3 font-medium">Score</th>
                <th className="text-right px-4 py-3 font-medium">CSP</th>
                <th className="text-right px-4 py-3 font-medium">CC</th>
                <th className="text-right px-4 py-3 font-medium">RSI</th>
                <th className="text-right px-4 py-3 font-medium">IV ATM</th>
                <th className="text-right px-4 py-3 font-medium">HVP</th>
                <th className="text-right px-4 py-3 font-medium">Regime</th>
                {activeStrategy === 'pmcc' && <th className="text-right px-4 py-3 font-medium">Width Rule</th>}
                {activeStrategy === 'ironCondor' && <th className="text-right px-4 py-3 font-medium">Net Credit</th>}
                {activeStrategy === 'putDiagonal' && <th className="text-right px-4 py-3 font-medium">Net Credit</th>}
                <th className="text-center px-4 py-3 font-medium">Src</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && !loading && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                    No results yet. Click <strong>Run Scan</strong> to fetch candidates.
                  </td>
                </tr>
              )}
              {results.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(r)}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer transition-colors ${
                    selected?.symbol === r.symbol ? 'bg-slate-800' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-white">{r.symbol}</td>
                  <td className="px-4 py-3 text-right text-slate-300">${fmt(r.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      r.compositeScore >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                      r.compositeScore >= 60 ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {Math.round(r.compositeScore)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">{r.scoreCsp ? Math.round(r.scoreCsp) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{r.scoreCc ? Math.round(r.scoreCc) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{fmt(r.rsi14)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{r.ivAtm ? fmt(r.ivAtm) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{r.hvp ? Math.round(r.hvp) + '%' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      r.regime?.includes('BULL') ? 'bg-emerald-500/10 text-emerald-400' :
                      r.regime?.includes('BEAR') ? 'bg-red-500/10 text-red-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {r.regime}
                    </span>
                  </td>
                  {activeStrategy === 'pmcc' && (
                    <td className="px-4 py-3 text-right">
                      {r.validation?.valid
                        ? <span className="text-emerald-400">${fmt(r.validation.widthRule)}</span>
                        : <span className="text-red-400 text-xs">Fail</span>
                      }
                    </td>
                  )}
                  {activeStrategy === 'ironCondor' && (
                    <td className="px-4 py-3 text-right text-emerald-400">${fmt(r.netCredit)}</td>
                  )}
                  {activeStrategy === 'putDiagonal' && (
                    <td className="px-4 py-3 text-right text-emerald-400">${fmt(r.netCredit)}</td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      r.source === 'Aggregator' ? 'bg-blue-500/10 text-blue-400' :
                      r.source === 'Finnhub' ? 'bg-cyan-500/10 text-cyan-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {r.source === 'Aggregator' ? 'Agg' : r.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className={`bg-slate-900 rounded-xl border border-${activeColor}-800/50 p-6 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">{selected.symbol} — {STRATEGIES.find(s => s.key === activeStrategy)?.label}</h3>
            <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Price</div>
              <div className="text-lg font-semibold text-white">${fmt(selected.price)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Composite Score</div>
              <div className="text-lg font-semibold text-white">{selected.compositeScore}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">RSI(14)</div>
              <div className="text-lg font-semibold text-white">{fmt(selected.rsi14)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Regime</div>
              <div className="text-lg font-semibold text-white">{selected.regime}</div>
            </div>
          </div>

          {/* Aggregator-Specific Metrics */}
          {(selected.source === 'Aggregator') && (
            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-sm font-medium text-slate-400 mb-3">Aggregator Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">CSP Score</div>
                  <div className="text-lg font-semibold text-emerald-400">{selected.scoreCsp ? Math.round(selected.scoreCsp) : '—'}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">CC Score</div>
                  <div className="text-lg font-semibold text-blue-400">{selected.scoreCc ? Math.round(selected.scoreCc) : '—'}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">IV ATM</div>
                  <div className="text-lg font-semibold text-white">{selected.ivAtm ? fmt(selected.ivAtm) : '—'}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">IV Rank</div>
                  <div className="text-lg font-semibold text-white">{selected.ivRank ? Math.round(selected.ivRank) : '—'}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">HVP</div>
                  <div className="text-lg font-semibold text-white">{selected.hvp ? Math.round(selected.hvp) + '%' : '—'}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">ATR(14)</div>
                  <div className="text-lg font-semibold text-white">${fmt(selected.atr14)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Z-Score</div>
                  <div className="text-lg font-semibold text-white">{fmt(selected.zScore)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Dist to POC</div>
                  <div className="text-lg font-semibold text-white">{fmtPct(selected.distToPocPct)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Channel High (3σ)</div>
                  <div className="text-lg font-semibold text-emerald-400">${fmt(selected.chanHigh3sd)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Channel Low (3σ)</div>
                  <div className="text-lg font-semibold text-red-400">${fmt(selected.chanLow3sd)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Nearest Sell Stop</div>
                  <div className="text-lg font-semibold text-amber-400">{fmtPct(selected.nearestSellStopPct)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Squeeze Risk</div>
                  <div className="text-lg font-semibold text-white">{fmt(selected.squeezeRisk)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Overheat</div>
                  <div className="text-lg font-semibold text-white">{fmt(selected.overheat)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">VCP Vol Contraction</div>
                  <div className="text-lg font-semibold text-white">{fmt(selected.vcpVolContraction)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Tightness %</div>
                  <div className="text-lg font-semibold text-white">{fmtPct(selected.tightnessPct)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Dist 200d</div>
                  <div className="text-lg font-semibold text-white">{fmtPct(selected.dist200)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Strategy-specific details */}
          <div className="border-t border-slate-800 pt-4">
            {activeStrategy === 'pmcc' && selected.validation && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Width Rule</div><div className="text-lg font-semibold text-emerald-400">${fmt(selected.validation.widthRule)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Max Profit</div><div className="text-lg font-semibold text-emerald-400">${fmt(selected.validation.maxProfit)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Max Loss</div><div className="text-lg font-semibold text-red-400">${fmt(selected.validation.maxLoss)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Annualized CoC</div><div className="text-lg font-semibold text-white">{selected.annualizedCoc}%</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Long Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.longStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Short Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.shortStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Long DTE</div><div className="text-lg font-semibold text-white">{selected.longDte}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Short DTE</div><div className="text-lg font-semibold text-white">{selected.shortDte}</div></div>
              </div>
            )}
            {activeStrategy === 'leap' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Delta (est.)</div><div className="text-lg font-semibold text-white">{selected.delta}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">DTE</div><div className="text-lg font-semibold text-white">{selected.dte}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">IV Rank</div><div className="text-lg font-semibold text-white">{selected.ivRank}%</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Extrinsic %</div><div className="text-lg font-semibold text-white">{selected.extrinsicPct}%</div></div>
                {selected.expiration && <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Expiration</div><div className="text-lg font-semibold text-white">{selected.expiration}</div></div>}
              </div>
            )}
            {activeStrategy === 'zebra' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Long Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.longStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Short Strikes</div><div className="text-lg font-semibold text-white">{selected.shortStrikes?.map(s => '$'+fmt(s)).join(', ')}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Ratio</div><div className="text-lg font-semibold text-white">{selected.ratio}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Net Debit</div><div className="text-lg font-semibold text-amber-400">${fmt(selected.netDebit)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Breakeven</div><div className="text-lg font-semibold text-emerald-400">${fmt(selected.breakeven)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Max Profit</div><div className="text-lg font-semibold text-emerald-400">{selected.maxProfit}</div></div>
                {selected.expiration && <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Expiration</div><div className="text-lg font-semibold text-white">{selected.expiration}</div></div>}
              </div>
            )}
            {activeStrategy === 'putDiagonal' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Long Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.longStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Short Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.shortStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Width</div><div className="text-lg font-semibold text-white">${fmt(selected.width)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Net Credit</div><div className="text-lg font-semibold text-emerald-400">${fmt(selected.netCredit)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Breakeven</div><div className="text-lg font-semibold text-white">${fmt(selected.be)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Max Profit</div><div className="text-lg font-semibold text-emerald-400">${fmt(selected.maxProfit)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Long DTE</div><div className="text-lg font-semibold text-white">{selected.longDte}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Short DTE</div><div className="text-lg font-semibold text-white">{selected.shortDte}</div></div>
              </div>
            )}
            {activeStrategy === 'collaredLeap' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">LEAP Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.leapStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Call Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.callStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Put Strike</div><div className="text-lg font-semibold text-white">${fmt(selected.putStrike)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Net Cost</div><div className="text-lg font-semibold text-amber-400">${fmt(selected.netCost)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Protection</div><div className="text-lg font-semibold text-emerald-400">{selected.protection}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Upside Cap</div><div className="text-lg font-semibold text-white">{selected.upside}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">LEAP DTE</div><div className="text-lg font-semibold text-white">{selected.leapDte}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Short DTE</div><div className="text-lg font-semibold text-white">{selected.shortDte}</div></div>
              </div>
            )}
            {activeStrategy === 'ironCondor' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Put Spread</div><div className="text-lg font-semibold text-white">${fmt(selected.putSpread?.[0])} / ${fmt(selected.putSpread?.[1])}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Call Spread</div><div className="text-lg font-semibold text-white">${fmt(selected.callSpread?.[0])} / ${fmt(selected.callSpread?.[1])}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Width</div><div className="text-lg font-semibold text-white">${fmt(selected.width)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Net Credit</div><div className="text-lg font-semibold text-emerald-400">${fmt(selected.netCredit)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">B/E Range</div><div className="text-lg font-semibold text-white">{selected.beRange}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Max Profit</div><div className="text-lg font-semibold text-emerald-400">${fmt(selected.maxProfit)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">Max Loss</div><div className="text-lg font-semibold text-red-400">${fmt(selected.maxLoss)}</div></div>
                <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-xs text-slate-500">DTE</div><div className="text-lg font-semibold text-white">{selected.dte}</div></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
