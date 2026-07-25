import React from 'react';
import { useMcmStore } from '../hooks/useMcmStore.js';

export default function RiskScoreBar() {
  const { riskScore, riskLevel } = useMcmStore();
  
  const getBarColor = (score) => {
    if (score <= 30) return 'from-emerald-500 to-emerald-400';
    if (score <= 60) return 'from-amber-500 to-amber-400';
    if (score <= 85) return 'from-orange-500 to-orange-400';
    return 'from-red-600 to-red-400';
  };
  
  const getGlowColor = (score) => {
    if (score <= 30) return 'shadow-emerald-500/30';
    if (score <= 60) return 'shadow-amber-500/30';
    if (score <= 85) return 'shadow-orange-500/30';
    return 'shadow-red-500/40';
  };
  
  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm font-medium text-slate-300">Risk Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${riskLevel.color}`}>
            {riskScore}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-800 ${riskLevel.color} border border-slate-700`}>
            {riskLevel.label}
          </span>
        </div>
      </div>
      
      <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
        <div className="absolute inset-0 flex">
          <div className="w-1/3 border-r border-slate-700/50"></div>
          <div className="w-1/3 border-r border-slate-700/50"></div>
          <div className="w-1/3"></div>
        </div>
        
        <div 
          className={`
            absolute inset-y-0 left-0 rounded-full
            bg-gradient-to-r ${getBarColor(riskScore)}
            transition-all duration-700 ease-out
            shadow-lg ${getGlowColor(riskScore)}
          `}
          style={{ width: `${riskScore}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full"></div>
        </div>
      </div>
      
      <div className="flex justify-between mt-1 text-[10px] text-slate-500">
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>85</span>
        <span>100</span>
      </div>
      
      {riskScore > 85 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-semibold">Kritisches Risiko – Trading eingeschränkt!</span>
        </div>
      )}
    </div>
  );
}
