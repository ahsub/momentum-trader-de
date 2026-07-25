import React, { useState } from 'react';
import { useMcmStore } from '../hooks/useMcmStore.js';
import { REGIME_CONFIG } from '../store/McmStore.ts';

export default function McmStorePanel() {
  const { 
    regime, riskScore, vixLevel, spyTrend, allowNewTrades,
    updateRegime, updateRiskScore, updateMarketData, triggerCircuitBreaker 
  } = useMcmStore();
  
  const [localVix, setLocalVix] = useState(vixLevel);
  const [localScore, setLocalScore] = useState(riskScore);
  
  const regimes = Object.keys(REGIME_CONFIG);
  
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        McmStore Dev Controls
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Regime</label>
          <div className="flex flex-wrap gap-1.5">
            {regimes.map(r => (
              <button
                key={r}
                onClick={() => updateRegime(r, Math.floor(Math.random() * 30) + 70)}
                className={`
                  px-2 py-1 rounded text-[10px] font-bold transition-all
                  ${regime === r 
                    ? `${REGIME_CONFIG[r].bgColor} ${REGIME_CONFIG[r].color} border ${REGIME_CONFIG[r].borderColor}` 
                    : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-600'}
                `}
              >
                {REGIME_CONFIG[r].label}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            Risk Score: <span className="text-slate-300">{localScore}</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localScore}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setLocalScore(val);
              updateRiskScore(val);
            }}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
        
        <div>
          <label className="text-xs text-slate-500 mb-1 block">VIX Level</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={localVix}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLocalVix(val);
                updateMarketData(val, spyTrend, 1.5);
              }}
              className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sm text-slate-300"
              step="0.1"
            />
            <button
              onClick={() => updateMarketData(12, 'UP', 2.0)}
              className="px-2 py-1 rounded bg-emerald-900/30 text-emerald-400 text-xs border border-emerald-800"
            >
              Bull
            </button>
            <button
              onClick={() => updateMarketData(28, 'DOWN', 0.6)}
              className="px-2 py-1 rounded bg-red-900/30 text-red-400 text-xs border border-red-800"
            >
              Bear
            </button>
            <button
              onClick={() => updateMarketData(40, 'DOWN', 0.3)}
              className="px-2 py-1 rounded bg-red-950 text-red-500 text-xs border border-red-700 font-bold"
            >
              Crisis
            </button>
          </div>
        </div>
        
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Actions</label>
          <button
            onClick={() => triggerCircuitBreaker('Manueller Test: VIX Spike > 40')}
            className="w-full py-2 rounded bg-red-900/30 text-red-400 text-xs font-bold border border-red-800 hover:bg-red-900/50 transition-colors"
          >
            🚨 Circuit Breaker triggern
          </button>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-slate-500">Trades erlaubt</div>
          <div className={`text-sm font-bold ${allowNewTrades ? 'text-emerald-400' : 'text-red-400'}`}>
            {allowNewTrades ? 'JA' : 'NEIN'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">VIX</div>
          <div className="text-sm font-bold text-slate-300">{vixLevel}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">SPY Trend</div>
          <div className="text-sm font-bold text-slate-300">{spyTrend}</div>
        </div>
      </div>
    </div>
  );
}
