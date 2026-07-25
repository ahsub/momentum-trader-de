import React, { useEffect, useState } from 'react';
import { useMcmStore } from '../hooks/useMcmStore.js';

export default function PositionGate() {
  const { allowNewTrades, gateReason, regime, regimeConfig } = useMcmStore();
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (!allowNewTrades) {
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [allowNewTrades]);
  
  if (allowNewTrades) return null;
  
  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center
      transition-all duration-500
      ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
    `}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      
      <div className={`
        relative max-w-lg w-full mx-4 p-6 rounded-2xl border-2
        bg-slate-900/95 shadow-2xl
        transform transition-all duration-500
        ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
        ${regime === 'CRISIS' ? 'border-red-500/50 shadow-red-500/20' : 'border-amber-500/50 shadow-amber-500/20'}
      `}>
        <div className={`
          mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4
          ${regime === 'CRISIS' ? 'bg-red-500/20' : 'bg-amber-500/20'}
        `}>
          <svg className={`w-8 h-8 ${regime === 'CRISIS' ? 'text-red-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className={`
          text-center text-xl font-bold mb-2
          ${regime === 'CRISIS' ? 'text-red-400' : 'text-amber-400'}
        `}>
          {regime === 'CRISIS' ? '🚨 CRISIS: Trading Gesperrt!' : '⚠️ Position Gate Aktiv'}
        </h2>
        
        <div className="flex justify-center mb-4">
          <span className={`
            px-3 py-1 rounded-full text-sm font-bold
            ${regimeConfig.bgColor} ${regimeConfig.color} border ${regimeConfig.borderColor}
          `}>
            {regimeConfig.label}
          </span>
        </div>
        
        <p className="text-center text-slate-300 mb-2">
          {gateReason || 'Marktbedingungen erlauben keine neuen Positionen.'}
        </p>
        
        <p className="text-center text-sm text-slate-500 mb-6">
          {regimeConfig.description}
        </p>
        
        <div className="space-y-3">
          <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-400">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-slate-300">Erlaubte Aktionen:</span>
            </div>
            <ul className="ml-6 space-y-1 text-xs">
              <li>✓ Bestehende Positionen verwalten (Stops anpassen)</li>
              <li>✓ Watchlist & Scanner nutzen</li>
              <li>✓ Portfolio & P&L analysieren</li>
              <li className="text-red-400/80">✗ Keine neuen Trades eröffnen</li>
            </ul>
          </div>
          
          <button
            onClick={() => setIsVisible(false)}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors border border-slate-700"
          >
            Verstanden – Overlay schließen
          </button>
        </div>
        
        {regime === 'CRISIS' && (
          <div className="absolute -inset-1 rounded-2xl border-2 border-red-500/30 animate-ping pointer-events-none"></div>
        )}
      </div>
    </div>
  );
}
