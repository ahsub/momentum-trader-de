import { usePortfolioStore } from '../stores/portfolioStore';
import { useSnapshotReader } from '../hooks/useSnapshotReader';
import { generateRecommendations, generateAlerts } from '../utils/kiEngine';
import { useMemo } from 'react';
import RiskScoreBar from './RiskScoreBar';
import RegimeAutoBadge from './RegimeAutoBadge';

export default function PortfolioDashboard({ onSelectPosition }) {
  const { portfolioSummary, positions, trades } = usePortfolioStore();
  const { regime, riskScore, snapshot } = useSnapshotReader();

  const recommendations = useMemo(() => 
    generateRecommendations(portfolioSummary, snapshot, positions),
    [portfolioSummary, snapshot, positions]
  );

  const alerts = useMemo(() => 
    generateAlerts(positions, snapshot),
    [positions, snapshot]
  );

  if (!portfolioSummary) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400 mb-4">Noch keine Portfolio-Daten vorhanden.</p>
        <p className="text-slate-500 text-sm">Importiere deine CapTrader Activity Statement CSV.</p>
      </div>
    );
  }

  const openPositions = positions.filter(p => p.isOpen);
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const highRecs = recommendations.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH');

  return (
    <div className="space-y-6">
      {/* Header: Portfolio + Regime */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Portfolio Übersicht</h2>
            <RegimeAutoBadge regime={regime} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Gesamtwert" value={`$${portfolioSummary.totalValue.toLocaleString()}`} />
            <MetricCard label="Cash" value={`$${portfolioSummary.cashBalance.toLocaleString()}`} 
              sub={`${portfolioSummary.cashPercent.toFixed(1)}%`} />
            <MetricCard label="Realisiert P&L" value={`$${portfolioSummary.realizedPnl.toLocaleString()}`}
              positive={portfolioSummary.realizedPnl >= 0} />
            <MetricCard label="Unrealisiert P&L" value={`$${portfolioSummary.unrealizedPnl.toLocaleString()}`}
              positive={portfolioSummary.unrealizedPnl >= 0} />
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Risk Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Portfolio Delta</span>
                <span className={`font-mono ${portfolioSummary.portfolioDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {portfolioSummary.portfolioDelta > 0 ? '+' : ''}{portfolioSummary.portfolioDelta}
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" 
                  style={{ width: `${Math.min(Math.abs(portfolioSummary.portfolioDelta) / 20, 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Theta / Tag</span>
                <span className={`font-mono ${portfolioSummary.portfolioTheta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {portfolioSummary.portfolioTheta >= 0 ? '+' : ''}{portfolioSummary.portfolioTheta}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Konzentration</span>
                <span className={`font-mono ${portfolioSummary.concentrationRisk > 25 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {portfolioSummary.concentrationRisk.toFixed(1)}%
                </span>
              </div>
            </div>

            <RiskScoreBar score={riskScore} />
          </div>
        </div>
      </div>

      {/* Alerts & Recommendations */}
      {(criticalAlerts.length > 0 || highRecs.length > 0) && (
        <div className="bg-slate-900 rounded-xl p-6 border border-red-700/50">
          <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <span className="animate-pulse">🔴</span> Aktive Alerts & Empfehlungen
          </h3>
          <div className="space-y-3">
            {criticalAlerts.map((alert, i) => (
              <div key={`alert-${i}`} className="flex items-start gap-3 p-3 bg-red-900/20 rounded-lg">
                <span className="text-red-400 mt-0.5">⚠️</span>
                <div>
                  <p className="text-white font-medium text-sm">{alert.message}</p>
                  <p className="text-red-300/70 text-xs mt-1">{alert.action}</p>
                </div>
              </div>
            ))}
            {highRecs.slice(0, 3).map((rec, i) => (
              <div key={`rec-${i}`} className="flex items-start gap-3 p-3 bg-amber-900/20 rounded-lg border border-amber-700/30">
                <span className="text-amber-400 mt-0.5">
                  {rec.priority === 'CRITICAL' ? '🔴' : '🟡'}
                </span>
                <div>
                  <p className="text-white font-medium text-sm">{rec.title}</p>
                  <p className="text-slate-300 text-xs mt-1">{rec.description}</p>
                  <p className="text-emerald-400 text-xs mt-1">→ {rec.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Allokation</h3>
          <div className="space-y-3">
            <AllocationBar label="Cash" percent={portfolioSummary.cashPercent} color="bg-slate-500" />
            <AllocationBar label="Aktien" percent={portfolioSummary.stockPercent} color="bg-blue-500" />
            <AllocationBar label="Optionen" percent={portfolioSummary.optionPercent} color="bg-purple-500" />
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Performance</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Win Rate</span>
              <span className="text-white font-mono">{portfolioSummary.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Offene Positionen</span>
              <span className="text-white font-mono">{portfolioSummary.openPositions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Geschlossene Trades</span>
              <span className="text-white font-mono">{portfolioSummary.closedPositions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Gesamtrendite</span>
              <span className={`font-mono ${portfolioSummary.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {portfolioSummary.totalReturn >= 0 ? '+' : ''}${portfolioSummary.totalReturn.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Greeks</h3>
          <div className="space-y-2">
            <GreekRow label="Delta" value={portfolioSummary.portfolioDelta} />
            <GreekRow label="Theta" value={portfolioSummary.portfolioTheta} />
            <GreekRow label="Vega" value={portfolioSummary.portfolioVega} />
          </div>
        </div>
      </div>

      {/* Open Positions Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Offene Positionen</h3>
          <span className="text-slate-400 text-sm">{openPositions.length} Positionen</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-700">
                <th className="p-3 font-medium">Symbol</th>
                <th className="p-3 font-medium">Strategie</th>
                <th className="p-3 font-medium">Net Qty</th>
                <th className="p-3 font-medium">Marktpreis</th>
                <th className="p-3 font-medium">Wert</th>
                <th className="p-3 font-medium">P&L</th>
                <th className="p-3 font-medium">DTE</th>
                <th className="p-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {openPositions.map((pos) => (
                <tr 
                  key={pos.symbol} 
                  onClick={() => onSelectPosition?.(pos)}
                  className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div>
                      <span className="text-white font-medium">{pos.underlying || pos.symbol}</span>
                      {pos.assetClass === 'OPTION' && (
                        <span className="text-slate-400 text-xs block">
                          {pos.optionType} ${pos.strike}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStrategyColor(pos.strategy)}`}>
                      {pos.strategy}
                    </span>
                  </td>
                  <td className="p-3 text-white font-mono">{pos.netQuantity}</td>
                  <td className="p-3 text-slate-300 font-mono">${pos.marketPrice?.toFixed(2) || '--'}</td>
                  <td className="p-3 text-white font-mono">${pos.marketValue?.toLocaleString() || '--'}</td>
                  <td className="p-3">
                    <span className={`font-mono ${pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl?.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-3">
                    {pos.daysToExpiry !== null ? (
                      <span className={`font-mono ${pos.daysToExpiry <= 7 ? 'text-red-400' : 'text-slate-300'}`}>
                        {pos.daysToExpiry}
                      </span>
                    ) : (
                      <span className="text-slate-500">--</span>
                    )}
                  </td>
                  <td className="p-3">
                    {pos.assignmentRisk !== 'NONE' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full 
                        ${pos.assignmentRisk === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {pos.assignmentRisk}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, positive }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <p className="text-slate-400 text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-1 ${positive !== undefined ? (positive ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-slate-500 text-xs">{sub}</p>}
    </div>
  );
}

function AllocationBar({ label, percent, color }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-mono">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function GreekRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

function getStrategyColor(strategy) {
  const colors = {
    BUY_AND_HOLD: 'bg-blue-500/20 text-blue-400',
    CASH_SECURED_PUT: 'bg-emerald-500/20 text-emerald-400',
    COVERED_CALL: 'bg-purple-500/20 text-purple-400',
    WHEEL: 'bg-amber-500/20 text-amber-400',
    NAKED_CALL: 'bg-red-500/20 text-red-400',
    LONG_CALL: 'bg-cyan-500/20 text-cyan-400',
    LONG_PUT: 'bg-pink-500/20 text-pink-400',
    SINGLE: 'bg-slate-500/20 text-slate-400'
  };
  return colors[strategy] || colors.SINGLE;
}
