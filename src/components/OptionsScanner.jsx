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
import { screenCcCandidates } from '../services/ccScreener';
import { getCachedUiq } from '../services/uiqBridge';
import OptionsWatchlistPanel from '../components/OptionsWatchlistPanel';
import { loadPortfolioData, getCCScreenerInput, calculatePortfolioMetrics } from '../services/portfolioBridge';
import CapTraderImport from './CapTraderImport';
import LiquidityPanel, { LiquidityBadge } from './LiquidityPanel';

const STRATEGIES = [
  { key: 'csp', label: 'CSP', color: 'emerald' },
  { key: 'cc', label: 'CC', color: 'blue' },
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

  // ── Portfolio State ──
  const [portfolioData, setPortfolioData] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

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

  // ── Portfolio laden ──
  useEffect(() => {
    const saved = loadPortfolioData();
    if (saved) {
      setPortfolioData({
        portfolio: saved,
        ccInput: getCCScreenerInput(saved),
        metrics: calculatePortfolioMetrics(saved),
      });
    }
  }, []);

  // ── Ergebnisse leeren beim Strategie-Wechsel ──
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
      cc: () => screenCcCandidates([], uiq),
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
            <span className="text-sm text-slate-400">v2.8.1 — Liquidity</span>
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
          disabled={loading || activeStrategy === 'portfolio'}
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

      {/* KI-Watchlist Panel */}
      {activeStrategy !== 'portfolio' && (
        <OptionsWatchlistPanel 
          strategy={activeStrategy === 'all' ? 'all' : activeStrategy} 
          onSelect={(item) => {
            const ticker = results.find(r => r.symbol === item.symbol);
            if (ticker) setSelected(ticker);
          }}
        />
      )}

      {/* Strategy Tabs + Portfolio */}
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
        <button
          onClick={() => setActiveStrategy('portfolio')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            activeStrategy === 'portfolio'
              ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-900'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          📁 Portfolio
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* ── PORTFOLIO PANEL ── */}
      {activeStrategy === 'portfolio' && (
        <div className="space-y-6">
          {!portfolioData ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">Kein Portfolio importiert</h3>
              <p className="text-slate-400 text-sm mb-4">
                Lade deine CapTrader Flex-Query XML hoch, um echte Positionen zu sehen.
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                CapTrader XML importieren
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Portfolio Header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Depotwert</div>
                  <div className="text-lg font-mono font-semibold text-emerald-400">
                    €{portfolioData.metrics.totalValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-500">Cash: €{portfolioData.metrics.totalCash.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Unrealisiert</div>
                  <div className={`text-lg font-mono font-semibold ${portfolioData.metrics.totalUnrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {portfolioData.metrics.totalUnrealized >= 0 ? '+' : ''}€{portfolioData.metrics.totalUnrealized.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">CC-fähig</div>
                  <div className="text-lg font-mono font-semibold text-purple-400">{portfolioData.ccInput.length}</div>
                  <div className="text-xs text-slate-500">≥100 Shares</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Konzentration</div>
                  <div className={`text-lg font-mono font-semibold ${portfolioData.metrics.maxConcentration > 25 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {portfolioData.metrics.maxConcentration.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* CC-Ready Positions */}
              {portfolioData.ccInput.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="text-purple-400">📈</span> Covered Call Kandidaten
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-left py-2 px-3">Symbol</th>
                          <th className="text-right py-2 px-3">Shares</th>
                          <th className="text-right py-2 px-3">Marktpreis</th>
                          <th className="text-right py-2 px-3">Ø Kosten</th>
                          <th className="text-right py-2 px-3">P&L</th>
                          <th className="text-center py-2 px-3">Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioData.ccInput.map(pos => (
                          <tr key={pos.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-mono font-semibold text-slate-200">{pos.symbol}</td>
                            <td className="py-2 px-3 text-right text-slate-300">{pos.shares}</td>
                            <td className="py-2 px-3 text-right text-slate-300">€{pos.marketPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-slate-400">€{pos.avgCost.toFixed(2)}</td>
                            <td className={`py-2 px-3 text-right font-medium ${pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnlPct.toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => {
                                  setActiveStrategy('cc');
                                }}
                                className="bg-purple-600/80 hover:bg-purple-500 text-white text-xs px-3 py-1 rounded transition-colors"
                              >
                                CC scannen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* All Positions */}
              <div className="bg-slate-800/50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-200 mb-3">Alle Positionen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {portfolioData.metrics.positions?.map(pos => (
                    <div key={pos.symbol} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-semibold text-slate-200">{pos.symbol}</span>
                        <span className="text-xs text-slate-500">{pos.subCategory}</span>
                      </div>
                      <div className="text-2xl font-mono text-slate-100">
                        {pos.quantity} <span className="text-sm text-slate-500">Shares</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm">
                        <span className="text-slate-400">€{pos.marketPrice.toFixed(2)}</span>
                        <span className={`${pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnlPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  🔄 Neu importieren
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('captrader_portfolio_data');
                    setPortfolioData(null);
                  }}
                  className="bg-red-900/30 hover:bg-red-900/50 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  🗑️ Löschen
                </button>
              </div>
            </div>
          )}

          {/* Import Modal */}
          {showImportModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-200">CapTrader Import</h2>
                  <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
                </div>
                <CapTraderImport
                  onImport={(data) => {
                    setPortfolioData(data);
                    setShowImportModal(false);
                  }}
                  onClose={() => setShowImportModal(false)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STANDARD STRATEGY PANELS ── */}
      {activeStrategy !== 'portfolio' && (
        <>
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
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Liq</th>
                  {activeStrategy === 'csp' && (
                    <>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">OTM Strike</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Premium</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">ITM Prob</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Ann. Ret</th>
                    </>
                  )}
                  {activeStrategy === 'cc' && (
                    <>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Call Strike</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Premium</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Ann. Ret</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Upside Cap</th>
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
                    <td colSpan="15" className="px-4 py-8 text-center text-slate-500">
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
                    <td className="px-4 py-2"><LiquidityBadge symbol={r.symbol} /></td>
                    {activeStrategy === 'csp' && (
                      <>
                        <td className="px-4 py-2">${fmt(r.otmStrike)}</td>
                        <td className="px-4 py-2">${fmt(r.otmPremium)}</td>
                        <td className="px-4 py-2">{r.itmProbability}%</td>
                        <td className="px-4 py-2">{r.annualizedReturn}%</td>
                      </>
                    )}
                    {activeStrategy === 'cc' && (
                      <>
                        <td className="px-4 py-2">${fmt(r.callStrike)}</td>
                        <td className="px-4 py-2">${fmt(r.premium)}</td>
                        <td className="px-4 py-2">{r.annualizedReturn}%</td>
                        <td className="px-4 py-2">{r.upsideCap}%</td>
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
                    <Metric label="IV Percentile" value={selected.ivPercentile ? Math.round(selected.ivPercentile) : '—'} />
                    <Metric label="ATR(20)" value={selected.atr20 ? fmt(selected.atr20) : '—'} />
                    <Metric label="ATR %" value={selected.atrPct ? fmt(selected.atrPct) + '%' : '—'} />
                  </div>
                </div>
              )}

              {/* Strategy-Specific Detail */}
              {activeStrategy === 'csp' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Metric label="OTM Strike" value={`$${fmt(selected.otmStrike)}`} />
                  <Metric label="Premium" value={`$${fmt(selected.otmPremium)}`} />
                  <Metric label="ITM Probability" value={`${selected.itmProbability}%`} />
                  <Metric label="Annualized Return" value={`${selected.annualizedReturn}%`} />
                  <Metric label="Distance" value={`${selected.distance}%`} />
                  <Metric label="DTE" value={selected.dte} />
                </div>
              )}
              {activeStrategy === 'cc' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Metric label="Call Strike" value={`$${fmt(selected.callStrike)}`} />
                  <Metric label="Premium" value={`$${fmt(selected.premium)}`} />
                  <Metric label="Annualized Return" value={`${selected.annualizedReturn}%`} />
                  <Metric label="Upside Cap" value={`${selected.upsideCap}%`} />
                  <Metric label="Distance" value={`${selected.distance}%`} />
                  <Metric label="DTE" value={selected.dte} />
                </div>
              )}
              {activeStrategy === 'pmcc' && selected.validation && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Metric label="LEAP Strike" value={`$${fmt(selected.leapStrike)}`} />
                  <Metric label="Short Strike" value={`$${fmt(selected.shortStrike)}`} />
                  <Metric label="Width Rule" value={`$${fmt(selected.validation.widthRule)}`} />
                  <Metric label="Width OK" value={selected.validation.valid ? '✅ Yes' : '❌ No'} />
                  <Metric label="Net Debit" value={`$${fmt(selected.netDebit)}`} />
                  <Metric label="Max Profit" value={`$${fmt(selected.maxProfit)}`} />
                  <Metric label="Max Loss" value={`$${fmt(selected.maxLoss)}`} />
                  <Metric label="Breakeven" value={`$${fmt(selected.breakeven)}`} />
                  <Metric label="LEAP DTE" value={selected.leapDte} />
                  <Metric label="Short DTE" value={selected.shortDte} />
                </div>
              )}
              {activeStrategy === 'leap' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Metric label="LEAP Strike" value={`$${fmt(selected.leapStrike)}`} />
                  <Metric label="Premium" value={`$${fmt(selected.premium)}`} />
                  <Metric label="Delta" value={selected.delta} />
                  <Metric label="IV" value={`${selected.iv}%`} />
                  <Metric label="DTE" value={selected.dte} />
                  <Metric label="Breakeven" value={`$${fmt(selected.breakeven)}`} />
                  {selected.expiration && (
                    <Metric label="Expiration" value={selected.expiration} />
                  )}
                </div>
              )}
              {activeStrategy === 'zebra' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Metric label="ATM Strike" value={`$${fmt(selected.atmStrike)}`} />
                  <Metric label="OTM Strikes" value={selected.otmStrikes?.map(s => '$'+fmt(s)).join(', ')} />
                  <Metric label="Net Debit" value={`$${fmt(selected.netDebit)}`} />
                  <Metric label="Max Profit" value={`$${fmt(selected.maxProfit)}`} />
                  <Metric label="Breakeven" value={`$${fmt(selected.breakeven)}`} />
                  <Metric label="DTE" value={selected.dte} />
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

              {/* Liquidity Metrics */}
              <div className="pt-4 border-t border-slate-700/50">
                <LiquidityPanel 
                  symbol={selected.symbol}
                  strike={selected.otmStrike || selected.callStrike || selected.leapStrike || selected.shortStrike || selected.atmStrike}
                  expiry={selected.expiration}
                  putCall={activeStrategy === 'csp' || activeStrategy === 'putDiagonal' ? 'PUT' : 'CALL'}
                />
              </div>
            </div>
          )}
        </>
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
