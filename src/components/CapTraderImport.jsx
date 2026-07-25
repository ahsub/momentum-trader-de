import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { parseCapTraderXML, filterOptionTrades, calculateTradeMetrics } from '../services/capTraderParser';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useTradeJournalStore } from '../stores/tradeJournalStore';

export default function CapTraderImport() {
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);

  const addLivePosition = usePortfolioStore(s => s.addLivePosition);
  const addEntry = useTradeJournalStore(s => s.addEntry);

  const handleFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.xml')) {
      setResult({ success: false, error: 'Bitte eine .xml Datei hochladen' });
      return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setResult(parseCapTraderXML(e.target.result));
      setLoading(false);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const importPositions = () => {
    if (!result?.openPositions) return;
    result.openPositions.forEach(pos => addLivePosition(pos));
    setImported(true);
  };

  const importTrades = () => {
    if (!result?.trades) return;
    filterOptionTrades(result.trades).forEach(trade => {
      addEntry({
        symbol: trade.symbol,
        strategy: trade.optionType === 'CALL' ? 'Long Call' : trade.optionType === 'PUT' ? 'Short Put' : 'Option',
        entryPrice: trade.entryPrice,
        quantity: Math.abs(trade.quantity),
        pnl: trade.pnl,
        date: trade.tradeDate,
        notes: `CapTrader Import | ${trade.side}`,
        status: trade.side === 'SELL' && trade.pnl !== 0 ? 'closed' : 'open',
      });
    });
    setImported(true);
  };

  const metrics = result?.trades ? calculateTradeMetrics(result.trades) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">CapTrader Import</h2>
        <p className="text-sm text-slate-500">Flex-Query XML — Positionen & Trades</p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/30 hover:border-slate-600'
        }`}
      >
        <input type="file" accept=".xml" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <Upload className={`mx-auto h-8 w-8 mb-3 ${dragActive ? 'text-emerald-400' : 'text-slate-500'}`} />
        <p className="text-sm font-medium text-slate-300">Flex-Query XML hierher ziehen oder klicken</p>
        <p className="text-xs text-slate-500 mt-1">Nur .xml Dateien von CapTrader/IBKR</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-slate-400">Parst XML...</span>
        </div>
      )}

      {result && !result.success && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-400">Fehler beim Parsen</p>
            <p className="text-xs text-rose-300/70 mt-1">{result.error}</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {result?.success && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                <p className="text-xs text-slate-500">Offene Positionen</p>
                <p className="text-xl font-bold text-slate-100">{result.openPositions.length}</p>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                <p className="text-xs text-slate-500">Trades</p>
                <p className="text-xl font-bold text-slate-100">{result.trades.length}</p>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                <p className="text-xs text-slate-500">Optionstrades</p>
                <p className="text-xl font-bold text-emerald-400">{filterOptionTrades(result.trades).length}</p>
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                <p className="text-xs text-slate-500">NAV</p>
                <p className="text-xl font-bold text-slate-100">
                  {result.accountSummary.nav ? `€${result.accountSummary.nav.toLocaleString('de-DE')}` : '—'}
                </p>
              </div>
            </div>

            {metrics && metrics.totalTrades > 0 && (
              <div className="rounded-xl bg-slate-800/30 border border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Performance Historische Optionstrades
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-slate-500 text-xs">Gesamt PnL</p>
                    <p className={`font-semibold ${metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      €{metrics.totalPnl.toFixed(2)}
                    </p></div>
                  <div><p className="text-slate-500 text-xs">Win Rate</p>
                    <p className="font-semibold text-slate-200">{metrics.winRate.toFixed(1)}%</p></div>
                  <div><p className="text-slate-500 text-xs">Ø Gewinn</p>
                    <p className="font-semibold text-emerald-400">€{metrics.avgWin.toFixed(2)}</p></div>
                  <div><p className="text-slate-500 text-xs">Ø Verlust</p>
                    <p className="font-semibold text-rose-400">€{metrics.avgLoss.toFixed(2)}</p></div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400"><TrendingUp className="h-3 w-3" /> {metrics.winners} Wins</span>
                  <span className="flex items-center gap-1 text-rose-400"><TrendingDown className="h-3 w-3" /> {metrics.losers} Losses</span>
                  <span className="text-slate-500">PF: {metrics.profitFactor.toFixed(2)}</span>
                </div>
              </div>
            )}

            {result.openPositions.length > 0 && (
              <div className="rounded-xl bg-slate-800/30 border border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Offene Positionen</h3>
                  <button onClick={importPositions} disabled={imported}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md transition-colors">
                    {imported ? <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> OK</span> : 'In Portfolio'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/50 text-slate-400">
                      <tr><th className="px-4 py-2">Symbol</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Qty</th><th className="px-4 py-2">PnL</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {result.openPositions.slice(0, 10).map(pos => (
                        <tr key={pos.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2 font-medium text-slate-200">{pos.symbol}</td>
                          <td className="px-4 py-2 text-slate-400">{pos.assetClass}</td>
                          <td className="px-4 py-2 text-slate-300">{pos.quantity}</td>
                          <td className={`px-4 py-2 font-medium ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>€{pos.pnl?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.trades.length > 0 && (
              <div className="rounded-xl bg-slate-800/30 border border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Letzte Trades</h3>
                  <button onClick={importTrades} disabled={imported}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md transition-colors">
                    {imported ? <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> OK</span> : 'In Journal'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/50 text-slate-400">
                      <tr><th className="px-4 py-2">Datum</th><th className="px-4 py-2">Symbol</th><th className="px-4 py-2">Side</th><th className="px-4 py-2">PnL</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {result.trades.slice(0, 10).map(trade => (
                        <tr key={trade.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2 text-slate-400">{trade.tradeDate?.split('T')[0]}</td>
                          <td className="px-4 py-2 font-medium text-slate-200">{trade.symbol}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              trade.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>{trade.side}</span>
                          </td>
                          <td className={`px-4 py-2 font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>€{trade.pnl?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
