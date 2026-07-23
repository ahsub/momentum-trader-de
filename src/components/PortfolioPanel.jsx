import { useState } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import ImportWizard from './ImportWizard';
import PortfolioDashboard from './PortfolioDashboard';
import KIAdvisorPanel from './KIAdvisorPanel';
import PositionDetailPanel from './PositionDetailPanel';
import OptionsAdvisorPanel from './OptionsAdvisorPanel';

/**
 * PortfolioPanel - Main integration component
 * Combines Import, Dashboard, KI-Advisor, Options-Advisor, and Position Detail
 */
export default function PortfolioPanel({ className = '' }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPosition, setSelectedPosition] = useState(null);

  const { portfolioSummary, positions, trades } = usePortfolioStore();
  const hasData = portfolioSummary !== null;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'advisor', label: 'KI-Advisor', icon: '🤖' },
    { id: 'options', label: 'Options Advisor', icon: '🎯' },
    { id: 'history', label: 'Trade-Historie', icon: '📜' },
  ];

  return (
    <div className={`bg-slate-950 rounded-xl border border-slate-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💼</span>
          <div>
            <h2 className="text-lg font-bold text-white">Portfolio Hub</h2>
            <p className="text-slate-500 text-xs">
              {hasData 
                ? `${positions.filter(p => p.isOpen).length} offene Positionen • $${portfolioSummary.totalValue.toLocaleString()}`
                : 'Noch keine Daten importiert'}
            </p>
          </div>
        </div>

        {hasData && (
          <button
            onClick={() => usePortfolioStore.getState().clearTrades()}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Daten löschen
          </button>
        )}
      </div>

      {/* Import Wizard (shown when no data) */}
      {!hasData && (
        <div className="p-8">
          <ImportWizard onComplete={() => setActiveTab('dashboard')} />
        </div>
      )}

      {/* Tabs */}
      {hasData && (
        <>
          <div className="flex border-b border-slate-800">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedPosition(null); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2
                  ${activeTab === tab.id 
                    ? 'text-white border-blue-500 bg-slate-800/50' 
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'}`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'dashboard' && (
              <PortfolioDashboard onSelectPosition={(pos) => { setSelectedPosition(pos); setActiveTab('detail'); }} />
            )}

            {activeTab === 'advisor' && (
              <KIAdvisorPanel />
            )}

            {activeTab === 'options' && (
              <OptionsAdvisorPanel />
            )}

            {activeTab === 'history' && (
              <TradeHistoryPanel trades={trades} />
            )}

            {activeTab === 'detail' && selectedPosition && (
              <PositionDetailPanel 
                position={selectedPosition} 
                onBack={() => setActiveTab('dashboard')}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TradeHistoryPanel({ trades }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">Trade-Historie</h3>
        <p className="text-slate-400 text-sm">{trades.length} Trades seit Import</p>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800">
            <tr className="text-slate-400 text-left">
              <th className="p-3 font-medium">Datum</th>
              <th className="p-3 font-medium">Symbol</th>
              <th className="p-3 font-medium">Side</th>
              <th className="p-3 font-medium">Qty</th>
              <th className="p-3 font-medium">Preis</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">P&L</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice().reverse().map((trade, i) => (
              <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="p-3 text-slate-300">{trade.date?.split(',')[0]}</td>
                <td className="p-3 text-white font-medium">{trade.underlying || trade.symbol}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full
                    ${trade.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {trade.side}
                  </span>
                </td>
                <td className="p-3 text-white font-mono">{trade.quantity}</td>
                <td className="p-3 text-slate-300 font-mono">${trade.price}</td>
                <td className="p-3">
                  <StatusBadge status={trade.status} />
                </td>
                <td className="p-3">
                  {trade.realizedPnl !== null && trade.realizedPnl !== undefined ? (
                    <span className={`font-mono ${trade.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.realizedPnl >= 0 ? '+' : ''}${trade.realizedPnl}
                    </span>
                  ) : (
                    <span className="text-slate-500">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    OPEN: 'bg-blue-500/20 text-blue-400',
    CLOSED: 'bg-slate-500/20 text-slate-400',
    EXPIRED: 'bg-amber-500/20 text-amber-400',
    ASSIGNED: 'bg-purple-500/20 text-purple-400',
    EXERCISED: 'bg-red-500/20 text-red-400',
    ROLLED: 'bg-cyan-500/20 text-cyan-400'
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || colors.CLOSED}`}>
      {status}
    </span>
  );
}
