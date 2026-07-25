/**
 * Wheel Tracker Panel - Shows active wheel cycles and their progress
 */
export default function WheelTrackerPanel({ positions, trades, onSelectSymbol }) {
  // Find symbols with wheel potential
  const wheelSymbols = [...new Set([
    ...positions.filter(p => p.assetClass === 'STOCK' && p.netQuantity >= 100).map(p => p.symbol),
    ...positions.filter(p => p.assetClass === 'OPTION').map(p => p.underlying)
  ])];

  if (wheelSymbols.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-3 block">♻️</span>
        <p className="text-slate-400">Keine Wheel-Cycles aktiv.</p>
        <p className="text-slate-500 text-sm mt-1">Starte mit einem CSP auf ein gewünschtes Underlying.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Aktive Wheel-Cycles</p>

      {wheelSymbols.map(symbol => {
        const stage = analyzeWheelStage(positions, symbol);
        const pnl = calculateWheelPnL(trades, symbol);

        return (
          <WheelCycleCard 
            key={symbol} 
            symbol={symbol} 
            stage={stage} 
            pnl={pnl}
            onClick={() => onSelectSymbol?.(symbol)}
          />
        );
      })}
    </div>
  );
}

function WheelCycleCard({ symbol, stage, pnl, onClick }) {
  const stageConfig = {
    READY: { color: 'border-slate-600', bg: 'bg-slate-800', icon: '⏳', progress: 0 },
    CSP_ACTIVE: { color: 'border-emerald-700/50', bg: 'bg-emerald-900/10', icon: '🛡️', progress: 25 },
    ASSIGNED: { color: 'border-blue-700/50', bg: 'bg-blue-900/10', icon: '📦', progress: 50 },
    CC_ACTIVE: { color: 'border-purple-700/50', bg: 'bg-purple-900/10', icon: '📞', progress: 75 },
    UNKNOWN: { color: 'border-slate-600', bg: 'bg-slate-800', icon: '❓', progress: 0 }
  };

  const config = stageConfig[stage.stage] || stageConfig.UNKNOWN;

  return (
    <div 
      onClick={onClick}
      className={`rounded-xl p-5 border ${config.color} ${config.bg} cursor-pointer hover:brightness-110 transition-all`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h4 className="text-white font-bold text-lg">{symbol}</h4>
            <p className="text-slate-400 text-sm">{stage.description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${parseFloat(pnl.totalPnL) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {parseFloat(pnl.totalPnL) >= 0 ? '+' : ''}${pnl.totalPnL}
          </p>
          <p className="text-slate-500 text-xs">Total P&L</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>CSP</span>
          <span>Assignment</span>
          <span>CC</span>
          <span>Called Away</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all"
            style={{ width: `${config.progress}%` }}
          />
        </div>
      </div>

      {/* Stage Details */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium
            ${stage.nextAction === 'CSP' ? 'bg-emerald-500/20 text-emerald-400' :
              stage.nextAction === 'CC' ? 'bg-purple-500/20 text-purple-400' :
              stage.nextAction === 'ROLL_OR_ASSIGN' ? 'bg-amber-500/20 text-amber-400' :
              'bg-slate-500/20 text-slate-400'}`}>
            {stage.nextAction}
          </span>
        </div>

        {stage.recommendation && (
          <p className="text-slate-300 text-sm">→ {stage.recommendation}</p>
        )}
      </div>

      {/* P&L Breakdown */}
      {pnl.cycleComplete && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-slate-500">CSP Premium</span>
            <p className="text-emerald-400 font-mono">+${pnl.cspPremium}</p>
          </div>
          <div>
            <span className="text-slate-500">CC Premium</span>
            <p className="text-emerald-400 font-mono">+${pnl.ccPremium}</p>
          </div>
          <div>
            <span className="text-slate-500">Stock P&L</span>
            <p className={`font-mono ${parseFloat(pnl.stockPnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {parseFloat(pnl.stockPnl) >= 0 ? '+' : ''}${pnl.stockPnl}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
