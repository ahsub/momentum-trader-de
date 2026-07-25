import React from 'react';
import { motion } from 'framer-motion';

const GREEK_CONFIG = {
  delta: { label: 'Delta', color: 'bg-emerald-500', negColor: 'bg-rose-500', maxAbs: 500 },
  gamma: { label: 'Gamma', color: 'bg-amber-500', negColor: 'bg-rose-500', maxAbs: 50 },
  theta: { label: 'Theta', color: 'bg-sky-500', negColor: 'bg-rose-500', maxAbs: 200 },
  vega: { label: 'Vega', color: 'bg-violet-500', negColor: 'bg-rose-500', maxAbs: 100 },
};

function GreekBarItem({ label, value, maxAbs, color, negColor }) {
  const isPositive = value >= 0;
  const percentage = Math.min((Math.abs(value) / maxAbs) * 100, 100);
  const displayValue = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
  
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-14 text-xs font-medium text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-5 bg-slate-800/60 rounded-full overflow-hidden relative">
        <motion.div
          className={`h-full rounded-full ${isPositive ? color : negColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <span className={`absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-mono font-bold ${
          isPositive ? 'text-emerald-100' : 'text-rose-100'
        }`}>
          {displayValue}
        </span>
      </div>
    </div>
  );
}

export default function GreeksBar({ greeks, showTitle = true, compact = false }) {
  if (!greeks) return null;
  
  const { delta, gamma, theta, vega } = greeks;
  
  const items = [
    { key: 'delta', value: delta },
    { key: 'gamma', value: gamma },
    { key: 'theta', value: theta },
    { key: 'vega', value: vega },
  ];
  
  return (
    <div className={`${compact ? '' : 'bg-slate-900/50 border border-slate-700/40 rounded-xl p-4'}`}>
      {showTitle && (
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Greeks
        </h4>
      )}
      <div className="space-y-1">
        {items.map(({ key, value }) => (
          <GreekBarItem
            key={key}
            label={GREEK_CONFIG[key].label}
            value={value}
            maxAbs={GREEK_CONFIG[key].maxAbs}
            color={GREEK_CONFIG[key].color}
            negColor={GREEK_CONFIG[key].negColor}
          />
        ))}
      </div>
    </div>
  );
}
