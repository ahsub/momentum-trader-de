import { useState, useEffect } from 'react';
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
import StrategyTrafficLight from '../components/StrategyTrafficLight';
import { screenCspCandidates } from '../services/cspScreener';
import { getCachedUiq } from '../services/uiqBridge';

const STRATEGIES = [
  { key: 'csp', label: 'CSP', color: 'emerald' },
  { key: 'leap', label: 'LEAP', color: 'emerald' },
  { key: 'pmcc', label: 'PMCC', color: 'blue' },
  { key: 'zebra', label: 'ZEBRA', color: 'violet' },
  { key: 'putDiagonal', label: 'Put Diagonal', color: 'amber' },
  { key: 'collaredLeap', label: 'Collared LEAP', color: 'rose' },
  { key: 'ironCondor', label: 'Iron Condor', color: 'cyan' },
];

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

export default function OptionsScanner() {
  const [activeStrategy, setActiveStrategy] = useState('leap');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('');
  const [meta, setMeta] = useState({ lastTradingDay: null, errors: null, schema: null });
  const [uiq, setUiq] = useState(null);

  const isStale = meta.lastTradingDay && meta.lastTradingDay !== new Date().toISOString().split('T')[0];

  // ── Meta laden ──
  useEffect(() => {
    const m = getMarketMeta();
    if (m) setMeta(m);
  }, []);

  // ── UIQ laden ──
  useEffect(() => {
    const checkUiq = () => {
      const cached = getCachedUiq();
      if (cached) {
        setUiq(cached);
      } else {
        setTimeout(checkUiq, 500);
      }
    };
    checkUiq();
  }, []);

  // ── FIX: Ergebnisse leeren beim Strategie-Wechsel ──
  useEffect(() => {
    setResults([]);
    setSelected(null);
    setError(null);
  }, [activeStrategy]);

  const handleRunScan = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);

    const screenerMap = {
      csp: () => screenCspCandidates(uiq),
      leap: screenLeapCandidates,
      pmcc: screenPmccCandidates,
      zebra: screenZebraCandidates,
      putDiagonal: screenPutDiagonalCandidates,
      collaredLeap: screenCollaredLeapCandidates,
      ironCondor: screenIronCondorCandidates,
    };

    try {
      const screener = screenerMap[activeStrategy];
      if (!screener) throw new Error('Unknown strategy: ' + activeStrategy);

      const data = await screener();
      setResults(data);
      setDataSource(data[0]?.source || 'Aggregator');

      if (activeStrategy === 'pmcc') {
        setResults(prev => prev.map(r => ({
          ...r,
          validation: validatePmccWidthRule(r)
        })));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header mit Meta-Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Options Scanner</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-slate-400">v2.5.1 — UIQ-Regime + CSP</span>
            {meta.schema && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">
                Schema {meta.schema?.version || JSON.stringify(meta.schema)}
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
          onClick={handleRunScan}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>

      {/* Stale-Data Warnung */}
      {isStale && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-400">
          Daten sind vom {meta.lastTradingDay} — heute ist kein Handelstag. Die Werte können veraltet sein.
        </div>
      )}

      {/* UIQ Regime & Strategie-Ampel */}
      <StrategyTrafficLight
        uiq={uiq}
        activeStrategy={activeStrategy}
        onSelect={setActiveStrategy}
      />

      {/* Strategy Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STRATEGIES.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveStrategy(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeStrategy === s.key
                ? `bg-${s.color}-500/20 text-${s.color}-400 ring-2 ring-${s.color}-500 ring-offset-2 ring-offset-slate-900`
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Symbol</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Price</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Score</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">CSP</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">CC</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">RSI</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">IV ATM</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">HVP</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Regime</th>
              {activeStrategy === 'csp' && (
                <>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">OTM Strike</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Premium</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">ITM Prob</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Ann. Ret</th>
                </>
              )}
              {activeStrategy === 'pmcc' && (
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Width Rule</th>
              )}
              {activeStrategy === 'ironCondor' && (
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Net Credit</th>
              )}
              {activeStrategy === 'putDiagonal' && (
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Net Credit</th>
              )}
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Src</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && !loading && (
              <tr>
                <td colSpan="14" className="px-4 py-8 text-center text-slate-500">
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
                <td className="px-4 py-2 font-medium text-white">{r.symbol}</td>
                <td className="px-4 py-2">${fmt(r.price)}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    r.compositeScore >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                    r.compositeScore >= 60 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {Math.round(r.compositeScore)}
                  </span>
                </td>
                <td className="px-4 py-2">{r.scoreCsp ? Math.round(r.scoreCsp) : '—'}</td>
                <td className="px-4 py-2">{r.scoreCc ? Math.round(r.scoreCc) : '—'}</td>
                <td className="px-4 py-2">{fmt(r.rsi14)}</td>
                <td className="px-4 py-2">{r.ivAtm ? fmt(r.ivAtm) : '—'}</td>
                <td className="px-4 py-2">{r.hvp ? Math.round(r.hvp) + '%' : '—'}</td>
                <td className="px-4 py-2">{r.regime}</td>
                {activeStrategy === 'csp' && (
                  <>
                    <td className="px-4 py-2">${fmt(r.otmStrike)}</td>
                    <td className="px-4 py-2">${fmt(r.otmPremium)}</td>
                    <td className="px-4 py-2">{r.itmProbability}%</td>
                    <td className="px-4 py-2">{r.annualizedReturn}%</td>
                  </>
                )}
                {activeStrategy === 'pmcc' && (
                  <td className="px-4 py-2">
                    {r.validation?.valid
                      ? <span className="text-emerald-400">${fmt(r.validation.widthRule)}</span>
                      : <span className="text-red-400">Fail</span>
                    }
                  </td>
                )}
                {activeStrategy === 'ironCondor' && (
                  <td className="px-4 py-2">${fmt(r.netCredit)}</td>
                )}
                {activeStrategy === 'putDiagonal' && (
                  <td className="px-4 py-2">${fmt(r.netCredit)}</td>
                )}
                <td className="px-4 py-2 text-xs">{r.source === 'Aggregator' ? 'Agg' : r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">{selected.symbol} — {STRATEGIES.find(s => s.key === activeStrategy)?.label}</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Price" value={`$${fmt(selected.price)}`} />
            <Metric label="Composite Score" value={selected.compositeScore} />
            <Metric label="RSI(14)" value={fmt(selected.rsi14)} />
            <Metric label="Regime" value={selected.regime} />
          </div>

          {/* Aggregator-Specific Metrics */}
          {(selected.source === 'Aggregator') && (
            <div className="pt-4 border-t border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Aggregator Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="CSP Score" value={selected.scoreCsp ? Math.round(selected.scoreCsp) : '—'} />
                <Metric label="CC Score" value={selected.scoreCc ? Math.round(selected.scoreCc) : '—'} />
                <Metric label="IV ATM" value={selected.ivAtm ? fmt(selected.ivAtm) : '—'} />
                <Metric label="IV Rank" value={selected.ivRank ? Math.round(selected.ivRank) : '—'} />
                <Metric label="HVP" value={selected.hvp ? Math.round(selected.hvp) + '%' : '—'} />
                <Metric label="ATR(14)" value={`$${fmt(selected.atr14)}`} />
                <Metric label="Z-Score" value={fmt(selected.zScore)} />
                <Metric label="Dist to POC" value={fmtPct(selected.distToPocPct)} />
                <Metric label="Channel High (3σ)" value={`$${fmt(selected.chanHigh3sd)}`} />
                <Metric label="Channel Low (3σ)" value={`$${fmt(selected.chanLow3sd)}`} />
                <Metric label="Nearest Sell Stop" value={fmtPct(selected.nearestSellStopPct)} />
                <Metric label="Squeeze Risk" value={fmt(selected.squeezeRisk)} />
                <Metric label="Overheat" value={fmt(selected.overheat)} />
                <Metric label="VCP Vol Contraction" value={fmt(selected.vcpVolContraction)} />
                <Metric label="Tightness %" value={fmtPct(selected.tightnessPct)} />
                <Metric label="Dist 200d" value={fmtPct(selected.dist200)} />
              </div>
            </div>
          )}

          {/* Strategy-specific details */}
          <div className="pt-4 border-t border-slate-700/50">
            {activeStrategy === 'csp' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="OTM Strike" value={`$${fmt(selected.otmStrike)}`} />
                <Metric label="Premium" value={`$${fmt(selected.otmPremium)}`} />
                <Metric label="ITM Probability" value={`${selected.itmProbability}%`} />
                <Metric label="Annualized Return" value={`${selected.annualizedReturn}%`} />
                <Metric label="Max Loss" value={`$${fmt(selected.maxLoss)}`} />
                <Metric label="B/E" value={`$${fmt(selected.be)}`} />
                <Metric label="DTE" value={selected.dte} />
                <Metric label="Margin" value={`$${fmt(selected.marginRequired)}`} />
              </div>
            )}
            {activeStrategy === 'pmcc' && selected.validation && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Width Rule" value={`$${fmt(selected.validation.widthRule)}`} />
                <Metric label="Max Profit" value={`$${fmt(selected.validation.maxProfit)}`} />
                <Metric label="Max Loss" value={`$${fmt(selected.validation.maxLoss)}`} />
                <Metric label="Annualized CoC" value={`${selected.annualizedCoc}%`} />
                <Metric label="Long Strike" value={`$${fmt(selected.longStrike)}`} />
                <Metric label="Short Strike" value={`$${fmt(selected.shortStrike)}`} />
                <Metric label="Long DTE" value={selected.longDte} />
                <Metric label="Short DTE" value={selected.shortDte} />
              </div>
            )}
            {activeStrategy === 'leap' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Delta (est.)" value={selected.delta} />
                <Metric label="DTE" value={selected.dte} />
                <Metric label="IV Rank" value={`${selected.ivRank}%`} />
                <Metric label="Extrinsic %" value={`${selected.extrinsicPct}%`} />
                {selected.expiration && (
                  <Metric label="Expiration" value={selected.expiration} />
                )}
              </div>
            )}
            {activeStrategy === 'zebra' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Long Strike" value={`$${fmt(selected.longStrike)}`} />
                <Metric label="Short Strikes" value={selected.shortStrikes?.map(s => '$'+fmt(s)).join(', ')} />
                <Metric label="Ratio" value={selected.ratio} />
                <Metric label="Net Debit" value={`$${fmt(selected.netDebit)}`} />
                <Metric label="Breakeven" value={`$${fmt(selected.breakeven)}`} />
                <Metric label="Max Profit" value={selected.maxProfit} />
                {selected.expiration && (
                  <Metric label="Expiration" value={selected.expiration} />
                )}
              </div>
            )}
            {activeStrategy === 'putDiagonal' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Long Strike" value={`$${fmt(selected.longStrike)}`} />
                <Metric label="Short Strike" value={`$${fmt(selected.shortStrike)}`} />
                <Metric label="Width" value={`$${fmt(selected.width)}`} />
                <Metric label="Net Credit" value={`$${fmt(selected.netCredit)}`} />
                <Metric label="Breakeven" value={`$${fmt(selected.be)}`} />
                <Metric label="Max Profit" value={`$${fmt(selected.maxProfit)}`} />
                <Metric label="Long DTE" value={selected.longDte} />
                <Metric label="Short DTE" value={selected.shortDte} />
              </div>
            )}
            {activeStrategy === 'collaredLeap' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="LEAP Strike" value={`$${fmt(selected.leapStrike)}`} />
                <Metric label="Call Strike" value={`$${fmt(selected.callStrike)}`} />
                <Metric label="Put Strike" value={`$${fmt(selected.putStrike)}`} />
                <Metric label="Net Cost" value={`$${fmt(selected.netCost)}`} />
                <Metric label="Protection" value={selected.protection} />
                <Metric label="Upside Cap" value={selected.upside} />
                <Metric label="LEAP DTE" value={selected.leapDte} />
                <Metric label="Short DTE" value={selected.shortDte} />
              </div>
            )}
            {activeStrategy === 'ironCondor' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Put Spread" value={`$${fmt(selected.putSpread?.[0])} / $${fmt(selected.putSpread?.[1])}`} />
                <Metric label="Call Spread" value={`$${fmt(selected.callSpread?.[0])} / $${fmt(selected.callSpread?.[1])}`} />
                <Metric label="Width" value={`$${fmt(selected.width)}`} />
                <Metric label="Net Credit" value={`$${fmt(selected.netCredit)}`} />
                <Metric label="B/E Range" value={selected.beRange} />
                <Metric label="Max Profit" value={`$${fmt(selected.maxProfit)}`} />
                <Metric label="Max Loss" value={`$${fmt(selected.maxLoss)}`} />
                <Metric label="DTE" value={selected.dte} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-white font-semibold">{value}</div>
    </div>
  );
}
