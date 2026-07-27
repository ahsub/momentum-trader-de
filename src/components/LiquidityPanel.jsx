import React, { useState, useEffect } from 'react';
import { getOptionLiquidity, getStockLiquidity, getLiquidityColor, getLiquidityBg, getLiquidityIcon } from '../services/liquidityService';

export default function LiquidityPanel({ symbol, strike, expiry, putCall, showStock = true }) {
  const [optionLiq, setOptionLiq] = useState(null);
  const [stockLiq, setStockLiq] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    const fetchData = async () => {
      try {
        if (strike && expiry && putCall) {
          const opt = await getOptionLiquidity(symbol, strike, expiry, putCall);
          setOptionLiq(opt);
        }
        if (showStock) {
          const stock = await getStockLiquidity(symbol);
          setStockLiq(stock);
        }
      } catch (err) {
        console.error('[LiquidityPanel] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [symbol, strike, expiry, putCall, showStock]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-3"></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-8 bg-slate-700 rounded"></div>
          <div className="h-8 bg-slate-700 rounded"></div>
          <div className="h-8 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {optionLiq && (
        <div className={`rounded-xl p-4 ${getLiquidityBg(optionLiq.status)} border border-slate-700/50`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-200">
              {getLiquidityIcon(optionLiq.status)} Option Liquidity
            </h4>
            <span className={`text-xs font-mono ${getLiquidityColor(optionLiq.status)}`}>
              Score: {optionLiq.score}/100
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <LiquidityMetric label="Open Interest" value={optionLiq.oi.toLocaleString()} alert={optionLiq.oi < 100} alertText="OI < 100" />
            <LiquidityMetric label="Volume" value={optionLiq.volume.toLocaleString()} alert={optionLiq.volume < 50} alertText="Vol < 50" />
            <LiquidityMetric label="Bid-Ask Spread" value={`${optionLiq.spreadPct.toFixed(1)}%`} alert={optionLiq.spreadPct > 5} alertText="Spread > 5%" />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/30">
            <div className="flex gap-4 text-xs text-slate-500">
              <span>OI: {optionLiq.oiScore}/40</span>
              <span>Vol: {optionLiq.volScore}/30</span>
              <span>Spread: {optionLiq.spreadScore}/30</span>
            </div>
          </div>
        </div>
      )}

      {stockLiq && (
        <div className="bg-slate-900/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-300">Underlying Liquidity ({symbol})</h4>
            <span className={`text-xs font-mono ${getLiquidityColor(stockLiq.status)}`}>Score: {stockLiq.score}/100</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-xs text-slate-500">Bid</div><div className="text-slate-200 font-mono">${stockLiq.bid.toFixed(2)}</div></div>
            <div><div className="text-xs text-slate-500">Ask</div><div className="text-slate-200 font-mono">${stockLiq.ask.toFixed(2)}</div></div>
            <div><div className="text-xs text-slate-500">Spread</div><div className={`font-mono ${stockLiq.spreadPct > 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>{stockLiq.spreadPct.toFixed(2)}%</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiquidityMetric({ label, value, alert, alertText }) {
  return (
    <div className={`rounded-lg p-2 ${alert ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-900/30'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono font-semibold ${alert ? 'text-red-400' : 'text-slate-200'}`}>{value}</div>
      {alert && <div className="text-[10px] text-red-400 mt-0.5">⚠️ {alertText}</div>}
    </div>
  );
}

export function LiquidityBadge({ symbol }) {
  const [liq, setLiq] = useState(null);
  useEffect(() => { if (!symbol) return; getStockLiquidity(symbol).then(setLiq); }, [symbol]);
  if (!liq) return <span className="text-slate-600">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${getLiquidityColor(liq.status)}`}>
      {getLiquidityIcon(liq.status)}<span className="font-mono">{liq.score}</span>
    </span>
  );
}
