import { usePortfolioStore } from '../stores/portfolioStore';
import { useSnapshotReader } from '../hooks/useSnapshotReader';
import { generateRecommendations } from '../utils/kiEngine';
import { useMemo } from 'react';

export default function KIAdvisorPanel() {
  const { portfolioSummary, positions } = usePortfolioStore();
  const { snapshot } = useSnapshotReader();

  const recommendations = useMemo(() => 
    portfolioSummary && snapshot 
      ? generateRecommendations(portfolioSummary, snapshot, positions)
      : [],
    [portfolioSummary, snapshot, positions]
  );

  if (!portfolioSummary) {
    return (
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-700">
        <p className="text-slate-400 text-center">Importiere zuerst dein Portfolio für KI-Empfehlungen.</p>
      </div>
    );
  }

  const grouped = {
    CRITICAL: recommendations.filter(r => r.priority === 'CRITICAL'),
    HIGH: recommendations.filter(r => r.priority === 'HIGH'),
    MEDIUM: recommendations.filter(r => r.priority === 'MEDIUM'),
    LOW: recommendations.filter(r => r.priority === 'LOW')
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🤖</span> KI-Advisor
          </h3>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
            {recommendations.length} Empfehlungen
          </span>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          Basierend auf Markt-Regime, Portfolio-State und Options-Logik
        </p>
      </div>

      <div className="divide-y divide-slate-800">
        {recommendations.length === 0 && (
          <div className="p-8 text-center">
            <span className="text-4xl mb-2 block">✅</span>
            <p className="text-slate-400">Keine aktiven Empfehlungen.</p>
            <p className="text-slate-500 text-sm">Dein Portfolio ist optimal aligniert!</p>
          </div>
        )}

        {Object.entries(grouped).map(([priority, recs]) => 
          recs.length > 0 ? (
            <div key={priority} className="p-4">
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 
                ${priority === 'CRITICAL' ? 'text-red-400' : 
                  priority === 'HIGH' ? 'text-amber-400' : 
                  priority === 'MEDIUM' ? 'text-blue-400' : 'text-slate-400'}`}>
                {priority} ({recs.length})
              </h4>
              <div className="space-y-3">
                {recs.map((rec, i) => (
                  <RecommendationCard key={`${priority}-${i}`} recommendation={rec} />
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }) {
  const { priority, category, title, description, action, impact, symbol } = recommendation;

  const borderColor = priority === 'CRITICAL' ? 'border-red-700/50' :
    priority === 'HIGH' ? 'border-amber-700/50' :
    priority === 'MEDIUM' ? 'border-blue-700/50' : 'border-slate-700';

  const bgColor = priority === 'CRITICAL' ? 'bg-red-900/10' :
    priority === 'HIGH' ? 'bg-amber-900/10' :
    priority === 'MEDIUM' ? 'bg-blue-900/10' : 'bg-slate-800/50';

  return (
    <div className={`p-4 rounded-lg border ${borderColor} ${bgColor} transition-all hover:brightness-110`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {priority === 'CRITICAL' ? '🔴' : priority === 'HIGH' ? '🟡' : priority === 'MEDIUM' ? '🔵' : '⚪'}
          </span>
          <h5 className="text-white font-medium text-sm">{title}</h5>
        </div>
        {symbol && (
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
            {symbol}
          </span>
        )}
      </div>

      <p className="text-slate-300 text-sm mb-2">{description}</p>

      <div className="bg-slate-800/80 rounded p-3 mb-2">
        <p className="text-emerald-400 text-sm font-medium">→ {action}</p>
      </div>

      {impact && (
        <p className="text-slate-500 text-xs">💡 {impact}</p>
      )}

      <div className="flex gap-2 mt-3">
        <span className={`text-xs px-2 py-0.5 rounded-full
          ${category === 'RISK' ? 'bg-red-500/20 text-red-400' :
            category === 'OPPORTUNITY' ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-blue-500/20 text-blue-400'}`}>
          {category}
        </span>
      </div>
    </div>
  );
}
