import React from 'react';
import { motion } from 'framer-motion';
import GreeksBar from './GreeksBar';

/**
 * PositionGreeksCard — Erweiterte Positionskarte mit Greeks
 * Phase 8.4 — momentum-trader-de
 * 
 * Zeigt eine einzelne Options-Position mit allen Greeks
 */

export default function PositionGreeksCard({ position, index = 0 }) {
  const {
    symbol,
    optionType,
    strike,
    expiration,
    quantity,
    entryPrice,
    currentPrice,
    underlyingPrice,
    greeks,
    pnl,
    pnlPercent,
  } = position;
  
  const isCall = optionType === 'call';
  const isLong = quantity > 0;
  const isProfit = pnl >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-100">{symbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
            isCall ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {isCall ? 'CALL' : 'PUT'}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
            isLong ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
        </div>
        <div className={`text-sm font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isProfit ? '+' : ''}{pnl?.toFixed(2)} ({pnlPercent?.toFixed(1)}%)
        </div>
      </div>
      
      {/* Position Details */}
      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div>
          <span className="text-slate-500 block">Strike</span>
          <span className="text-slate-200 font-mono">${strike}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Exp</span>
          <span className="text-slate-200 font-mono">{expiration}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Qty</span>
          <span className="text-slate-200 font-mono">{quantity > 0 ? '+' : ''}{quantity}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Underlying</span>
          <span className="text-slate-200 font-mono">${underlyingPrice?.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Greeks Bar */}
      {greeks && (
        <div className="border-t border-slate-700/30 pt-3">
          <GreeksBar greeks={greeks} showTitle={false} compact />
        </div>
      )}
      
      {/* Entry vs Current */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/30 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-500">Entry: <span className="text-slate-300 font-mono">${entryPrice?.toFixed(2)}</span></span>
          <span className="text-slate-500">Current: <span className="text-slate-300 font-mono">${currentPrice?.toFixed(2)}</span></span>
        </div>
        {greeks?.theoreticalPrice && (
          <span className="text-slate-500">Theo: <span className="text-violet-300 font-mono">${greeks.theoreticalPrice.toFixed(2)}</span></span>
        )}
      </div>
    </motion.div>
  );
}
