import { getRegimeLabel, getRegimeColor } from '../utils/regimeCalculator';

const REGIME_DESCRIPTIONS = {
  BULL_QUIET: 'Low volatility uptrend. Favorable for momentum strategies.',
  BULL_VOLATILE: 'Uptrend with elevated volatility. Tighten stops.',
  BEAR_QUIET: 'Downtrend, low volatility. Defensive positioning.',
  BEAR_VOLATILE: 'Downtrend with high volatility. Reduce exposure.',
  CRISIS: 'Extreme volatility. Circuit breaker active. No new trades.'
};

export default function RegimeAutoBadge({ regime, showTooltip = true }) {
  const colorClass = getRegimeColor(regime);
  const label = getRegimeLabel(regime);
  const description = REGIME_DESCRIPTIONS[regime] || '';

  return (
    <div className="relative group">
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white ${colorClass} shadow-lg`}
      >
        <span className="w-2 h-2 rounded-full bg-white/80 mr-2 animate-pulse"></span>
        {label}
      </span>

      {showTooltip && (
        <div className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg bg-slate-800 border border-slate-600 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <p className="text-xs text-slate-300">{description}</p>
          <p className="text-xs text-slate-500 mt-1">Auto-computed from market data</p>
        </div>
      )}
    </div>
  );
}
