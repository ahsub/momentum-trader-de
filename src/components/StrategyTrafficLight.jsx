// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY TRAFFIC LIGHT v2 — Mit CSP-Timing-Engine & Makro-Context
// ═══════════════════════════════════════════════════════════════════════════

const STRATEGY_CONFIG = [
  { key: 'csp', name: 'CSP' },
  { key: 'cc', name: 'Covered Call' },
  { key: 'pmcc', name: 'PMCC' },
  { key: 'leap', name: 'LEAP' },
  { key: 'zebra', name: 'ZEBRA' },
  { key: 'putDiagonal', name: 'Put Diagonal' },
  { key: 'collaredLeap', name: 'Collared LEAP' },
  { key: 'ironCondor', name: 'Iron Condor' },
  { key: 'protectiveCollar', name: 'Protective Collar' },
];

export default function StrategyTrafficLight({ uiq, activeStrategy, onSelect }) {
  if (!uiq) return null;

  const { regime, vix, vvix, skew, tailRisk, trafficLight, cspTiming, creditStress, liquidityTrend } = uiq;

  return (
    <div className="mb-4 space-y-2">
      {/* Regime-Banner */}
      <div className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm border ${
        regime === 'BULL_QUIET' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
        regime === 'BULL' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
        regime === 'CAUTIOUS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
        regime === 'STRESS' || regime === 'BEAR' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
        'bg-slate-800 text-slate-300 border-slate-700'
      }`}>
        <span className="font-semibold">Regime:</span>
        <span className="uppercase tracking-wide">{regime}</span>
        <span className="text-slate-500">·</span>
        <span>VIX {vix}</span>
        <span className="text-slate-500">·</span>
        <span>VVIX {vvix}</span>
        <span className="text-slate-500">·</span>
        <span>HY-Z {uiq.hyZ?.toFixed(1) || '—'}</span>
        {tailRisk === 'EXTREME' && (
          <span className="ml-auto text-red-400 font-bold animate-pulse">⚠️ TAIL RISK</span>
        )}
        {creditStress === 'HIGH' && (
          <span className="ml-auto text-red-400 font-bold">💳 CREDIT STRESS</span>
        )}
      </div>

      {/* CSP-Timing-Badge (nur wenn CSP aktiv oder hover) */}
      {cspTiming && (
        <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs ${
          cspTiming.signal === 'EXCELLENT' ? 'bg-emerald-500/10 text-emerald-400' :
          cspTiming.signal === 'GOOD' ? 'bg-emerald-500/10 text-emerald-400' :
          cspTiming.signal === 'FAIR' ? 'bg-amber-500/10 text-amber-400' :
          cspTiming.signal === 'POOR' ? 'bg-orange-500/10 text-orange-400' :
          'bg-red-500/10 text-red-400'
        }`}>
          <span className="font-semibold">CSP Timing:</span>
          <span>{cspTiming.signal}</span>
          <span className="text-slate-500">({cspTiming.score}/100)</span>
          {cspTiming.rationale?.length > 0 && (
            <span className="text-slate-500 ml-1">— {cspTiming.rationale[0]}</span>
          )}
        </div>
      )}

      {/* Strategie-Ampel */}
      <div className="flex flex-wrap gap-2">
        {STRATEGY_CONFIG.map(s => {
          const light = trafficLight[s.key] || 'red';
          const isActive = activeStrategy === s.key;
          const isDisabled = light === 'red';

          const baseClasses = 'px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5';
          const activeClasses = isActive ? 'ring-2 ring-offset-1 ring-offset-slate-900 ' : '';
          const colorClasses = isActive
            ? light === 'green' ? 'ring-emerald-500 bg-emerald-500/20 text-emerald-400' :
              light === 'yellow' ? 'ring-amber-500 bg-amber-500/20 text-amber-400' :
              'ring-red-500 bg-red-500/20 text-red-400'
            : light === 'green' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' :
              light === 'yellow' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' :
              'bg-slate-800 text-slate-600 cursor-not-allowed';

          return (
            <button
              key={s.key}
              onClick={() => !isDisabled && onSelect(s.key)}
              disabled={isDisabled}
              className={`${baseClasses} ${activeClasses}${colorClasses}`}
              title={isDisabled ? 'Nicht empfohlen im aktuellen Regime' : s.name}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${
                light === 'green' ? 'bg-emerald-400' :
                light === 'yellow' ? 'bg-amber-400' :
                'bg-red-400'
              }`} />
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
