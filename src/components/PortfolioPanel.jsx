import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart,
  Activity,
  BookOpen,
  ChevronRight,
  AlertTriangle,
  Shield
} from 'lucide-react';

// ─── Stores ───
import { usePortfolioStore } from '../stores/portfolioStore';
import { useTradeJournalStore } from '../stores/tradeJournalStore';

// ─── Services ───
import { calculatePositionGreeks, calculatePortfolioGreeks } from '../services/greeksCalculator';

// ─── Components ───
import GreeksBar from './GreeksBar';
import PositionGreeksCard from './PositionGreeksCard';
import TradeJournalPanel from './TradeJournalPanel';

const TABS = [
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'greeks', label: 'Greeks', icon: Activity },
  { id: 'journal', label: 'Trade Journal', icon: BookOpen },
];

// ─── Helper: Format currency ───
const fmt = (n) => new Intl.NumberFormat('de-DE', { 
  style: 'currency', 
  currency: 'EUR',
  minimumFractionDigits: 2 
}).format(n);

const fmtPct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export default function PortfolioPanel() {
  const [activeTab, setActiveTab] = useState('portfolio');

  // ─── Portfolio Store ───
  const { 
    positions, 
    isPaperMode, 
    totalValue, 
    totalPnl, 
    totalPnlPercent,
    cashBalance,
    buyingPower
  } = usePortfolioStore();

  // ─── Trade Journal Store ───
  const { trades, getPerformanceMetrics } = useTradeJournalStore();

  // ─── Calculate Portfolio Greeks ───
  const portfolioGreeks = useMemo(() => {
    if (!positions || positions.length === 0) return null;
    return calculatePortfolioGreeks(positions);
  }, [positions]);

  // ─── Calculate Position Greeks ───
  const positionsWithGreeks = useMemo(() => {
    if (!positions) return [];
    return positions.map(pos => ({
      ...pos,
      greeks: calculatePositionGreeks(pos)
    }));
  }, [positions]);

  // ─── Summary Cards ───
  const SummaryCards = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Value */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Portfolio Value</p>
          <Briefcase className="h-4 w-4 text-slate-600" />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-100">{fmt(totalValue || 0)}</p>
        <div className={`mt-1 flex items-center gap-1 text-sm ${(totalPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {(totalPnl || 0) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          <span>{fmt(totalPnl || 0)} ({fmtPct(totalPnlPercent || 0)})</span>
        </div>
      </motion.div>

      {/* Cash */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Cash Balance</p>
          <DollarSign className="h-4 w-4 text-slate-600" />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-100">{fmt(cashBalance || 0)}</p>
        <p className="mt-1 text-sm text-slate-500">Available for trading</p>
      </motion.div>

      {/* Buying Power */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Buying Power</p>
          <Shield className="h-4 w-4 text-slate-600" />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-100">{fmt(buyingPower || 0)}</p>
        <p className="mt-1 text-sm text-slate-500">Total purchasing power</p>
      </motion.div>

      {/* Positions Count */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Open Positions</p>
          <PieChart className="h-4 w-4 text-slate-600" />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-100">{positions?.length || 0}</p>
        <p className="mt-1 text-sm text-slate-500">
          {trades?.filter(t => t.status === 'open')?.length || 0} active trades
        </p>
      </motion.div>
    </div>
  );

  // ─── Positions Table ───
  const PositionsTable = () => (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <div className="border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-300">Open Positions</h3>
      </div>

      {(!positions || positions.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-600">
          <Briefcase className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">No open positions</p>
          <p className="text-xs mt-1">Start trading to see your positions here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Avg Price</th>
                <th className="px-4 py-3 font-medium text-right">Current</th>
                <th className="px-4 py-3 font-medium text-right">Market Value</th>
                <th className="px-4 py-3 font-medium text-right">P&L</th>
                <th className="px-4 py-3 font-medium text-right">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, idx) => (
                <motion.tr 
                  key={pos.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-200">{pos.symbol}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{pos.qty}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{fmt(pos.avgPrice)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{fmt(pos.currentPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-200">{fmt(pos.marketValue)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmt(pos.unrealizedPnl)}
                  </td>
                  <td className={`px-4 py-3 text-right ${pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtPct(((pos.currentPrice - pos.avgPrice) / pos.avgPrice) * 100)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ─── Greeks Tab Content ───
  const GreeksTab = () => (
    <div className="space-y-6">
      {/* Portfolio-Level Greeks Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">Portfolio Greeks</h3>
          <span className="text-xs text-slate-500">Aggregated across all positions</span>
        </div>
        {portfolioGreeks ? (
          <GreeksBar greeks={portfolioGreeks} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <AlertTriangle className="h-4 w-4" />
            No positions available for Greeks calculation
          </div>
        )}
      </div>

      {/* Position-Level Greeks Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Position Greeks</h3>
        {positionsWithGreeks.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center text-slate-500">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No positions to display Greeks</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {positionsWithGreeks.map((pos) => (
              <PositionGreeksCard 
                key={pos.symbol} 
                position={pos} 
                greeks={pos.greeks}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── Journal Tab Content ───
  const JournalTab = () => (
    <TradeJournalPanel />
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Portfolio</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your positions, analyze Greeks, and track your trading journal
            {isPaperMode && <span className="ml-2 text-amber-400">· Paper Mode</span>}
          </p>
        </div>
      </div>

      {/* Summary Cards (always visible) */}
      <SummaryCards />

      {/* Tab Navigation */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'text-emerald-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="portfolioTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'portfolio' && (
            <div className="space-y-6">
              <PositionsTable />

              {/* Quick Greeks Preview in Portfolio Tab */}
              {portfolioGreeks && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-300">Quick Greeks Overview</h3>
                    <button 
                      onClick={() => setActiveTab('greeks')}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View Details <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <GreeksBar greeks={portfolioGreeks} compact />
                </div>
              )}
            </div>
          )}

          {activeTab === 'greeks' && <GreeksTab />}
          {activeTab === 'journal' && <JournalTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
