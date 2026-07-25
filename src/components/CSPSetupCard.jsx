/**
 * CSP Setup Card - Displays Cash Secured Put recommendation
 */
export default function CSPSetupCard({ result }) {
  if (result.recommendation === 'SKIP' || result.recommendation === 'AVOID') {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{result.recommendation === 'AVOID' ? '🚫' : '⏭️'}</span>
          <div>
            <h3 className="text-white font-semibold">{result.recommendation === 'AVOID' ? 'Nicht empfohlen' : 'Überspringen'}</h3>
            <p className="text-slate-400 text-sm">{result.reason}</p>
          </div>
        </div>

        {result.existingPosition && (
          <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
            <p className="text-slate-300 text-sm">Bestehende Position:</p>
            <p className="text-white font-mono text-sm mt-1">
              Strike ${result.existingPosition.strike} • DTE {result.existingPosition.daysToExpiry}
            </p>
          </div>
        )}
      </div>
    );
  }

  const { setup, rationale, riskNotes, alternatives } = result;

  return (
    <div className="space-y-4">
      {/* Main Setup */}
      <div className="bg-slate-800 rounded-xl p-6 border border-emerald-700/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h3 className="text-white font-bold text-lg">Cash Secured Put</h3>
              <p className="text-emerald-400 text-sm font-medium">{result.symbol} • Empfohlen</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-400">{setup.annualizedReturn}%</p>
            <p className="text-slate-500 text-xs">Annualisiert</p>
          </div>
        </div>

        {/* Setup Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SetupMetric label="Strike" value={`$${setup.strike}`} />
          <SetupMetric label="Premium" value={`$${setup.premium}`} />
          <SetupMetric label="DTE" value={setup.dte} />
          <SetupMetric label="Delta" value={setup.approxDelta} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <SetupMetric label="Contracts" value={setup.contracts} />
          <SetupMetric label="Total Premium" value={`$${setup.totalPremium}`} />
          <SetupMetric label="Cash Required" value={`$${setup.cashRequired}`} />
          <SetupMetric label="Break-Even" value={`$${setup.breakEven}`} />
          <SetupMetric label="Support Buffer" value={setup.supportBuffer} />
        </div>

        {/* Rationale */}
        <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
          <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Begründung</h4>
          <ul className="space-y-1">
            {rationale.map((r, i) => (
              <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Risk Notes */}
        {riskNotes && riskNotes.length > 0 && (
          <div className="bg-red-900/10 rounded-lg p-4 border border-red-700/20">
            <h4 className="text-red-400 text-xs uppercase tracking-wider mb-2">⚠️ Risiko-Hinweise</h4>
            <ul className="space-y-1">
              {riskNotes.map((note, i) => (
                <li key={i} className="text-red-300 text-sm">{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Alternatives */}
      {alternatives && alternatives.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-4">Alternative Setups</h4>
          <div className="space-y-3">
            {alternatives.map((alt, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 text-sm">#{i + 2}</span>
                  <div>
                    <p className="text-white font-medium">Strike ${alt.strike}</p>
                    <p className="text-slate-400 text-xs">{alt.expiry} • Delta {alt.approxDelta}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-medium">${alt.premium}</p>
                  <p className="text-slate-500 text-xs">{alt.annualizedReturn}% ann.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SetupMetric({ label, value }) {
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white font-bold font-mono mt-0.5">{value}</p>
    </div>
  );
}
