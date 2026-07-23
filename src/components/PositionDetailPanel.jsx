import { useState } from 'react';

/**
 * Position Detail Panel
 * Shows detailed view of a single position with related trades
 */
export default function PositionDetailPanel({ position, onBack }) {
  const [activeView, setActiveView] = useState('overview');

  if (!position) return null;

  const views = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'trades', label: 'Trades' },
    { id: 'greeks', label: 'Greeks' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück
        </button>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white">{position.underlying || position.symbol}</span>
          {position.assetClass === 'OPTION' && (
            <span className="text-sm text-slate-400">
              {position.optionType} ${position.strike} • {position.expiry}
            </span>
          )}
        </div>

        <span className={`text-xs px-3 py-1 rounded-full font-medium
          ${position.isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
          {position.isOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {/* Views */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors
              ${activeView === v.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DetailCard label="Net Quantity" value={position.netQuantity} />
          <DetailCard label="Avg Cost" value={`$${position.avgCost}`} />
          <DetailCard label="Market Price" value={`$${position.marketPrice}`} />
          <DetailCard label="Market Value" value={`$${position.marketValue?.toLocaleString()}`} />
          <DetailCard 
            label="Unrealized P&L" 
            value={`$${position.unrealizedPnl?.toLocaleString()}`}
            positive={position.unrealizedPnl >= 0}
          />
          <DetailCard label="Realized P&L" value={`$${position.realizedPnl?.toLocaleString()}`} />
          {position.daysToExpiry !== null && (
            <DetailCard 
              label="Days to Expiry" 
              value={position.daysToExpiry}
              warning={position.daysToExpiry <= 7}
            />
          )}
          {position.assignmentRisk !== 'NONE' && (
            <DetailCard 
              label="Assignment Risk" 
              value={position.assignmentRisk}
              alert={position.assignmentRisk === 'HIGH'}
            />
          )}
        </div>
      )}

      {/* Trades */}
      {activeView === 'trades' && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Opening Trades</h4>
          {position.openingTrades?.map((trade, i) => (
            <TradeCard key={`open-${i}`} trade={trade} type="open" />
          ))}

          {position.closingTrades?.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mt-4">Closing Trades</h4>
              {position.closingTrades.map((trade, i) => (
                <TradeCard key={`close-${i}`} trade={trade} type="close" />
              ))}
            </>
          )}
        </div>
      )}

      {/* Greeks */}
      {activeView === 'greeks' && position.assetClass === 'OPTION' && (
        <div className="grid grid-cols-2 gap-4">
          <GreekCard label="Delta" value={position.delta} description="Preis-Sensitivität" />
          <GreekCard label="Gamma" value={position.gamma} description="Delta-Änderung" />
          <GreekCard label="Theta" value={position.theta} description="Zeitverfall/Tag" />
          <GreekCard label="Vega" value={position.vega} description="IV-Sensitivität" />
        </div>
      )}
    </div>
  );
}

function DetailCard({ label, value, positive, warning, alert }) {
  let valueClass = 'text-white';
  if (positive !== undefined) valueClass = positive ? 'text-emerald-400' : 'text-red-400';
  if (warning) valueClass = 'text-amber-400';
  if (alert) valueClass = 'text-red-400 font-bold';

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}

function TradeCard({ trade, type }) {
  return (
    <div className={`p-3 rounded-lg border ${type === 'open' ? 'border-emerald-700/30 bg-emerald-900/10' : 'border-red-700/30 bg-red-900/10'}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-white font-medium">{trade.side}</span>
          <span className="text-slate-400 text-sm ml-2">{trade.quantity} @ ${trade.price}</span>
        </div>
        <span className="text-slate-500 text-xs">{trade.date?.split(',')[0]}</span>
      </div>
      <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
        <span>Proceeds: ${trade.proceeds}</span>
        <span>Comm: ${trade.commission}</span>
        {trade.realizedPnl !== null && (
          <span className={trade.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            P&L: ${trade.realizedPnl}
          </span>
        )}
      </div>
    </div>
  );
}

function GreekCard({ label, value, description }) {
  const isPositive = value >= 0;
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        <span className="text-slate-500 text-xs">{description}</span>
      </div>
      <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{value?.toFixed(3)}
      </p>
    </div>
  );
}
