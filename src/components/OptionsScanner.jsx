import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, Activity, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { screenLeapCandidates, screenPmccCandidates, validatePmccWidthRule } from '../services/optionsScreener';

const STRATEGIES = [
  { id: 'leap', label: 'Long LEAP Call', icon: TrendingUp },
  { id: 'pmcc', label: 'PMCC', icon: Activity },
];

export default function OptionsScanner() {
  const [activeStrategy, setActiveStrategy] = useState('leap');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const runScan = async () => {
    setLoading(true); setResults([]); setSelected(null);
    try {
      const data = activeStrategy === 'leap' ? await screenLeapCandidates() : await screenPmccCandidates();
      if (activeStrategy === 'pmcc') {
        setResults(data.map(d => ({ ...d, validation: validatePmccWidthRule(d) })));
      } else setResults(data);
    } catch (e) { console.error('Scan failed:', e); }
    finally { setLoading(false); }
  };

  const fmt = (n) => n ? (typeof n === 'number' ? n.toFixed(2) : n) : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Options Scanner</h2>
          <p className="text-sm text-slate-500">v2.2.0 — KO-Aggregator + Finnhub Enrichment</p>
        </div>
        <div className="flex items-center gap-2">
          {STRATEGIES.map(s => (
            <button key={s.id} onClick={() => setActiveStrategy(s.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeStrategy === s.id ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
              <s.icon className="h-4 w-4" />{s.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={runScan} disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? 'Scanning...' : 'Run Scan'}
      </button>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">RSI</th>
                <th className="px-4 py-3 font-medium">IV Rank</th>
                {activeStrategy === 'pmcc' && <th className="px-4 py-3 font-medium">Width Rule</th>}
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {results.length === 0 && !loading && (
                <tr><td colSpan={activeStrategy === 'pmcc' ? 8 : 7} className="px-4 py-8 text-center text-slate-500">No results yet. Click <strong>Run Scan</strong> to fetch candidates.</td></tr>
              )}
              {results.map((r, i) => (
                <motion.tr key={r.symbol} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-slate-800/30 cursor-pointer" onClick={() => setSelected(r)}>
                  <td className="px-4 py-3 font-semibold text-slate-200">{r.symbol}</td>
                  <td className="px-4 py-3 text-slate-300">€{fmt(r.price)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.compositeScore >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{r.compositeScore}</span></td>
                  <td className="px-4 py-3 text-slate-400">{fmt(r.rsi14)}</td>
                  <td className="px-4 py-3 text-slate-400">{r.ivRank ?? r.hvp}%</td>
                  {activeStrategy === 'pmcc' && (
                    <td className="px-4 py-3">{r.validation?.valid
                      ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="h-3 w-3" /> €{r.validation.widthRule}</span>
                      : <span className="inline-flex items-center gap-1 text-rose-400 text-xs"><AlertTriangle className="h-3 w-3" /> Fail</span>}</td>
                  )}
                  <td className="px-4 py-3 text-xs text-slate-500">{r.source}</td>
                  <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-slate-600" /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-100">{selected.symbol} — {activeStrategy.toUpperCase()}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Price</p><p className="text-lg font-semibold text-slate-200">€{fmt(selected.price)}</p></div>
              <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Composite Score</p><p className="text-lg font-semibold text-emerald-400">{selected.compositeScore}</p></div>
              <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">RSI(14)</p><p className="text-lg font-semibold text-slate-200">{fmt(selected.rsi14)}</p></div>
              <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Regime</p><p className="text-lg font-semibold text-slate-200">{selected.regime}</p></div>
            </div>
            {activeStrategy === 'pmcc' && selected.validation && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="rounded-lg bg-slate-900/50 p-3 border border-emerald-500/20"><p className="text-slate-500">Width Rule</p><p className={`text-lg font-semibold ${selected.validation.valid ? 'text-emerald-400' : 'text-rose-400'}`}>€{selected.validation.widthRule}</p></div>
                <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Max Profit</p><p className="text-lg font-semibold text-emerald-400">€{selected.validation.maxProfit}</p></div>
                <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Max Loss</p><p className="text-lg font-semibold text-rose-400">€{selected.validation.maxLoss}</p></div>
                <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Annualized CoC</p><p className="text-lg font-semibold text-emerald-400">{selected.annualizedCoc}%</p></div>
              </div>
            )}
            {activeStrategy === 'leap' && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Delta (est.)</p><p className="text-lg font-semibold text-slate-200">{selected.delta}</p></div>
                <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">DTE</p><p className="text-lg font-semibold text-slate-200">{selected.dte}</p></div>
                <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">IV Rank</p><p className="text-lg font-semibold text-slate-200">{selected.ivRank}%</p></div>
                <div className="rounded-lg bg-slate-900/50 p-3"><p className="text-slate-500">Extrinsic %</p><p className="text-lg font-semibold text-slate-200">{selected.extrinsicPct}%</p></div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
