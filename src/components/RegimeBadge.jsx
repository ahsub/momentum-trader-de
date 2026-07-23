import React from 'react';
import { useMcmStore } from '../hooks/useMcmStore.js';

export default function RegimeBadge() {
  const { regime, regimeConfidence, regimeConfig } = useMcmStore();
  
  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border
      backdrop-blur-sm transition-all duration-500
      ${regimeConfig.bgColor} ${regimeConfig.borderColor}
    `}>
      <span className={`
        relative flex h-2.5 w-2.5
        ${regime === 'CRISIS' ? 'animate-pulse' : ''}
      `}>
        <span className={`
          animate-ping absolute inline-flex h-full w-full rounded-full opacity-75
          ${regime === 'CRISIS' ? 'bg-red-400' : 'bg-emerald-400'}
        `}></span>
        <span className={`
          relative inline-flex rounded-full h-2.5 w-2.5
          ${regime === 'CRISIS' ? 'bg-red-500' : 'bg-emerald-500'}
        `}></span>
      </span>
      
      <span className={`text-sm font-bold tracking-wider ${regimeConfig.color}`}>
        {regimeConfig.label}
      </span>
      
      <span className="text-xs text-slate-400 ml-1">
        {regimeConfidence}%
      </span>
      
      <div className="group relative">
        <svg className="w-4 h-4 text-slate-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          <p className="font-semibold text-slate-200 mb-1">{regimeConfig.label}</p>
          <p>{regimeConfig.description}</p>
          <div className="mt-2 pt-2 border-t border-slate-700">
            <p>VIX: <span className="text-slate-200">{regime === 'CRISIS' ? '>35' : regime === 'BULL_VOLATILE' ? '25-35' : '<25'}</span></p>
            <p>SPY Trend: <span className="text-slate-200">{regime === 'BEAR_QUIET' || regime === 'BEAR_VOLATILE' ? '↓' : '↑'}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
