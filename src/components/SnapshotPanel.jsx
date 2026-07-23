import { useSnapshotReader } from '../hooks/useSnapshotReader';
import { getRegimeLabel, getRegimeColor } from '../utils/regimeCalculator';
import { getRiskLevel, getRiskColor } from '../utils/riskCalculator';
import RegimeAutoBadge from './RegimeAutoBadge';
import RiskScoreBar from './RiskScoreBar';
import CircuitBreakerAlert from './CircuitBreakerAlert';

export default function SnapshotPanel({ className = '' }) {
  const {
    snapshot,
    regime,
    riskScore,
    circuitBreaker,
    loading,
    error,
    lastUpdated,
    refresh
  } = useSnapshotReader();

  if (loading) {
    return (
      <div className={`p-6 rounded-xl bg-slate-900 border border-slate-700 animate-pulse ${className}`}>
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-700 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-slate-700 rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-xl bg-slate-900 border border-red-700 ${className}`}>
        <p className="text-red-400 text-sm">Snapshot Error: {error}</p>
        <button
          onClick={refresh}
          className="mt-3 px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl bg-slate-900 border border-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Market Snapshot</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {lastUpdated?.toLocaleTimeString() ?? '--:--:--'}
          </span>
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh snapshot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Regime & Risk */}
      <div className="flex items-center gap-4 mb-4">
        <RegimeAutoBadge regime={regime} />
        <div className="flex-1">
          <RiskScoreBar score={riskScore} />
        </div>
      </div>

      {/* Circuit Breaker */}
      {circuitBreaker && <CircuitBreakerAlert />}

      {/* Raw Data Grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <SnapshotMetric
          label="VIX"
          value={snapshot?.vix?.current}
          suffix=""
          delta={snapshot?.vix?.current && snapshot?.vix?.ma20
            ? ((snapshot.vix.current - snapshot.vix.ma20) / snapshot.vix.ma20 * 100).toFixed(1)
            : null}
        />
        <SnapshotMetric
          label="S&P 500"
          value={snapshot?.spx?.current}
          suffix=""
          delta={snapshot?.spx?.nyaChangePercent}
        />
        <SnapshotMetric
          label="10Y Treasury"
          value={snapshot?.treasury10y}
          suffix="%"
        />
        <SnapshotMetric
          label="DXY"
          value={snapshot?.dxy}
          suffix=""
        />
      </div>

      {/* Computed Summary */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Regime:</span>
          <span className={`font-medium ${getRiskColor(riskScore)}`}>
            {getRegimeLabel(regime)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-slate-400">Risk Level:</span>
          <span className={`font-medium ${getRiskColor(riskScore)}`}>
            {getRiskLevel(riskScore)} ({riskScore})
          </span>
        </div>
      </div>
    </div>
  );
}

function SnapshotMetric({ label, value, suffix = '', delta = null }) {
  const displayValue = value != null ? `${value}${suffix}` : '--';
  const deltaColor = delta != null
    ? (parseFloat(delta) >= 0 ? 'text-emerald-400' : 'text-red-400')
    : 'text-slate-400';

  return (
    <div className="p-3 rounded-lg bg-slate-800">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold text-white mt-1">{displayValue}</p>
      {delta != null && (
        <p className={`text-xs mt-0.5 ${deltaColor}`}>
          {parseFloat(delta) >= 0 ? '+' : ''}{delta}%
        </p>
      )}
    </div>
  );
}
