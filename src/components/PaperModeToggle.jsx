import React from 'react';
import { motion } from 'framer-motion';

/**
 * PaperModeToggle — Header-Toggle für Simulationsmodus
 * Phase 8.5 — momentum-trader-de
 * 
 * Schaltet zwischen Echt-Portfolio und Paper-Trading um
 */

export default function PaperModeToggle({ isPaperMode, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
        isPaperMode
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
      }`}
      title={isPaperMode ? 'Paper Trading Mode — Keine echten Trades' : 'Live Mode — Echte Positionen'}
    >
      <motion.div
        animate={{ rotate: isPaperMode ? 0 : 0 }}
        className="flex items-center gap-1.5"
      >
        {isPaperMode ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>PAPER</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>LIVE</span>
          </>
        )}
      </motion.div>

      <motion.span
        animate={{ 
          backgroundColor: isPaperMode ? '#f59e0b' : '#10b981',
          scale: [1, 1.2, 1],
        }}
        transition={{ scale: { repeat: Infinity, duration: 2 } }}
        className="w-1.5 h-1.5 rounded-full"
      />
    </button>
  );
}
