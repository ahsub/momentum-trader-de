import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Briefcase,
  History,
  DollarSign,
  Loader2
} from 'lucide-react';
import { 
  parseCapTraderXml, 
  validateFlexQueryXml, 
  calculatePerformanceMetrics 
} from '../services/capTraderFlexService';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useTradeJournalStore } from '../stores/tradeJournalStore';

const TABS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'positions', label: 'Positionen', icon: Briefcase },
  { id: 'trades', label: 'Trades', icon: History },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
];

export default function CapTraderImport() {
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef(null);

  const { addLivePosition, setLivePositions } = usePortfolioStore();
  const { addEntry } = useTradeJournalStore();

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    if (!selected.name.endsWith('.xml')) {
      setError('Bitte eine XML-Datei hochladen (CapTrader Flex-Query)');
      return;
    }

    setFile(selected);
    setError(null);
    setResult(null);
    setImported(false);
  };

  const handleParse = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const text = await file.text();

      // Validierung
      const validation = validateFlexQueryXml(text);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Parsing
      const data = parseCapTraderXml(text);
      setResult(data);
      setActiveTab('positions');
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleImportPositions = () => {
    if (!result?.openPositions?.length) return;

    result.openPositions.forEach(pos => {
      addLivePosition(pos);
    });

    setImported(true);
  };

  const handleImportTrades = () => {
    if (!result?.trades?.length) return;

    result.trades.forEach(trade => {
      addEntry(trade);
    });

    setImported(true);
  };

  const handleImportAll = () => {
    handleImportPositions();
    handleImportTrades();
  };

  const metrics = result ? calculatePerformanceMetrics(result.trades) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">CapTrader Import</h2>
          <p className="text-sm text-slate-500">Flex-Query XML → Portfolio & Trade Journal</p>
        </div>
        <div className="flex items-center gap-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              disabled={t.id !== 'upload' && !result}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 disabled:opacity-30'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 p-12 text-center hover:border-emerald-500/50 hover:bg-slate-800/30 transition-all"
            >
              <Upload className="mx-auto h-10 w-10 text-slate-500 mb-4" />
              <p className="text-slate-300 font-medium">CapTrader Flex-Query XML hochladen</p>
              <p className="text-slate-500 text-sm mt-1">Klicke oder ziehe die XML-Datei hierher</p>
              {file && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400">
                  <FileText className="h-4 w-4" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleFileSelect}
              className="hidden"
            />

            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 flex items-center gap-3 text-rose-400">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {file && !error && (
              <button
                onClick={handleParse}
                disabled={parsing}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {parsing ? 'Parse XML...' : 'XML Parsen'}
              </button>
            )}

            {result && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                <div className="flex items-center gap-2 text-emerald-400 mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">XML erfolgreich geparst</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded bg-slate-900/50 p-3">
                    <p className="text-slate-500">Offene Positionen</p>
                    <p className="text-lg font-semibold text-slate-200">{result.openPositions?.length || 0}</p>
                  </div>
                  <div className="rounded bg-slate-900/50 p-3">
                    <p className="text-slate-500">Trades</p>
                    <p className="text-lg font-semibold text-slate-200">{result.trades?.length || 0}</p>
                  </div>
                  <div className="rounded bg-slate-900/50 p-3">
                    <p className="text-slate-500">Cash</p>
                    <p className="text-lg font-semibold text-slate-200">${result.cash?.totalCash?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={handleImportAll} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                    Alles importieren
                  </button>
                  <button onClick={() => setActiveTab('positions')} className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600">
                    Details ansehen
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* POSITIONS TAB */}
        {activeTab === 'positions' && result?.openPositions && (
          <motion.div
            key="positions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">Offene Positionen ({result.openPositions.length})</h3>
              <button onClick={handleImportPositions} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                In Portfolio importieren
              </button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Typ</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Marktpreis</th>
                    <th className="px-4 py-3">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {result.openPositions.map((pos, i) => (
                    <motion.tr 
                      key={pos.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-200">{pos.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          pos.assetType === 'OPTION' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {pos.assetType === 'OPTION' ? `${pos.optionType?.toUpperCase()} ${pos.strike}` : 'Stock'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{pos.quantity}</td>
                      <td className="px-4 py-3 text-slate-400">${pos.entryPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-400">${pos.currentPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${pos.marketValue >= pos.costBasis ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.marketValue >= pos.costBasis ? '+' : ''}${((pos.marketValue || 0) - (pos.costBasis || 0)).toFixed(2)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* TRADES TAB */}
        {activeTab === 'trades' && result?.trades && (
          <motion.div
            key="trades"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">Historische Trades ({result.trades.length})</h3>
              <button onClick={handleImportTrades} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                In Journal importieren
              </button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Typ</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Preis</th>
                    <th className="px-4 py-3">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {result.trades.slice(0, 50).map((trade, i) => (
                    <motion.tr 
                      key={trade.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 text-slate-400">{trade.tradeDate}</td>
                      <td className="px-4 py-3 font-semibold text-slate-200">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          trade.assetType === 'OPTION' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {trade.assetType === 'OPTION' ? `${trade.optionType?.toUpperCase()}` : 'Stock'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{trade.quantity}</td>
                      <td className="px-4 py-3 text-slate-400">${trade.entryPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {result.trades.length > 50 && (
                <p className="px-4 py-3 text-xs text-slate-500 text-center">... und {result.trades.length - 50} weitere Trades</p>
              )}
            </div>
          </motion.div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && metrics && (
          <motion.div
            key="performance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-semibold text-slate-200">Performance-Analyse (CapTrader Historie)</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-500">Gesamt-Trades</p>
                <p className="text-2xl font-bold text-slate-100">{metrics.totalTrades}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-500">Win Rate</p>
                <p className={`text-2xl font-bold ${metrics.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {metrics.winRate.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-500">Gesamt-PnL</p>
                <p className={`text-2xl font-bold ${metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {metrics.totalPnl >= 0 ? '+' : ''}${metrics.totalPnl.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-500">Ø PnL / Trade</p>
                <p className={`text-2xl font-bold ${metrics.avgPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {metrics.avgPnl >= 0 ? '+' : ''}${metrics.avgPnl.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium">Bester Trade</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">+${metrics.bestTrade.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <div className="flex items-center gap-2 text-rose-400 mb-2">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-medium">Schlechtester Trade</span>
                </div>
                <p className="text-2xl font-bold text-rose-400">${metrics.worstTrade.toFixed(2)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-500 mb-3">Trade-Verteilung</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400">Winners ({metrics.winners})</span>
                    <span className="text-rose-400">Losers ({metrics.losers})</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${metrics.winRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
