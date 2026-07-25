import React, { useEffect, useState } from 'react';
import { useMcmStore } from '../hooks/useMcmStore.js';

export default function CircuitBreakerAlert() {
  const { circuitBreakerTriggered, circuitBreakerReason, resetCircuitBreaker, riskScore } = useMcmStore();
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(30);
  
  useEffect(() => {
    if (circuitBreakerTriggered) {
      setIsOpen(true);
      setCountdown(30);
    }
  }, [circuitBreakerTriggered]);
  
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown]);
  
  const handleReset = () => {
    resetCircuitBreaker();
    setIsOpen(false);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-red-950/40 backdrop-blur-md animate-pulse"></div>
      
      <div className="relative max-w-md w-full mx-4 p-6 rounded-2xl bg-slate-900 border-2 border-red-500 shadow-2xl shadow-red-500/30">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600 rounded-t-2xl"></div>
        
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-30"></div>
            <div className="relative w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/50">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <h2 className="text-center text-2xl font-black text-red-400 mb-2 tracking-tight">
          CIRCUIT BREAKER
        </h2>
        
        <p className="text-center text-red-300/80 font-medium mb-4">
          {circuitBreakerReason || 'Kritisches Risiko-Level erreicht!'}
        </p>
        
        <div className="bg-slate-800/80 rounded-lg p-4 mb-4 border border-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Aktueller Risk Score</span>
            <span className="text-2xl font-bold text-red-400">{riskScore}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${riskScore}%` }}></div>
          </div>
        </div>
        
        <div className="text-center mb-4">
          <span className="text-sm text-slate-500">Auto-Reset in </span>
          <span className="text-lg font-mono font-bold text-red-400">{countdown}s</span>
        </div>
        
        <div className="space-y-2">
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-all hover:shadow-lg hover:shadow-red-500/30 active:scale-[0.98]"
          >
            Circuit Breaker manuell zurücksetzen
          </button>
          
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm transition-colors"
          >
            Nur schließen (nicht zurücksetzen)
          </button>
        </div>
        
        <p className="mt-4 text-center text-[10px] text-slate-600">
          Alle offenen Positionen sollten überprüft werden. Neue Trades sind blockiert.
        </p>
      </div>
    </div>
  );
}
