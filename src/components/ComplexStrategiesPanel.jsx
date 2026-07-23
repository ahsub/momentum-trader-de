import { useState } from 'react';
import { buildIronCondor, buildStrangle, buildButterfly } from '../services/complexStrategiesService';

/**
 * Complex Strategies Panel - Phase 8.2
 * Iron Condor, Strangle, Butterfly Builder mit P&L-Visualisierung
 */
export default function ComplexStrategiesPanel({ className = '' }) {
  const [activeStrategy, setActiveStrategy] = useState('ironcondor');
  const [symbol, setSymbol] = useState('');
  const [underlyingPrice, setUnderlyingPrice] = useState('');
  const [expiration, setExpiration] = useState('');
  const [spreadWidth, setSpreadWidth] = useState(5);
  const [otmDistance, setOtmDistance] = useState(10);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const strategies = [
    { id: 'ironcondor', label: 'Iron Condor', icon: '🦋', desc: 'Richtungsneutral, begrenztes Risiko' },
    { id: 'strangle', label: 'Short Strangle', icon: '⚡', desc: 'Volatilitätsverkauf, unbegrenztes Risiko' },
    { id: 'butterfly', label: 'Butterfly', icon: '🦋', desc: 'Kleiner Move erwartet, begrenztes Risiko' },
  ];

  const handleBuild = async () => {
    if (!symbol || !underlyingPrice) return;

    setLoading(true);
    setResult(null);

    try {
      let strategyResult;
      const price = parseFloat(underlyingPrice);

      switch (activeStrategy) {
        case 'ironcondor':
          strategyResult = await buildIronCondor(symbol.toUpperCase(), price, expiration || null, spreadWidth);
          break;
        case 'strangle':
          strategyResult = await buildStrangle(symbol.toUpperCase(), price, expiration || null, otmDistance / 100);
          break;
        case 'butterfly':
          strategyResult = await buildButterfly(symbol.toUpperCase(), price, expiration || null, spreadWidth);
          break;
        default:
          strategyResult = await buildIronCondor(symbol.toUpperCase(), price, expiration || null, spreadWidth);
      }

      setResult(strategyResult);
    } catch (err) {
      console.error('[ComplexStrategies] Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-slate-950 rounded-xl border border-slate-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧬</span>
          <div>
            <h2 className="text-lg font-bold text-white">Komplexe Strategien</h2>
            <p className="text-slate-500 text-xs">Iron Condor • Strangle • Butterfly Builder</p>
          </div>
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-800">
        {strategies.map(s => (
          <button
            key={s.id}
            onClick={() => { setActiveStrategy(s.id); setResult(null); }}
            className={`p-3 rounded-lg border transition-all text-left
              ${activeStrategy === s.id 
                ? 'bg-blue-500/20 border-blue-500/50 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
          >
            <span className="text-xl block mb-1">{s.icon}</span>
            <span className="text-sm font-medium">{s.label}</span>
            <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1.5">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white 
                placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1.5">Kurs ($)</label>
            <input
              type="number"
              value={underlyingPrice}
              onChange={(e) => setUnderlyingPrice(e.target.value)}
              placeholder="175.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white 
                placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1.5">Expiration</label>
            <input
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white 
                focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs uppercase mb-1.5">
              {activeStrategy === 'strangle' ? 'OTM Distanz (%)' : 'Spread Width ($)'}
            </label>
            {activeStrategy === 'strangle' ? (
              <input
                type="number"
                value={otmDistance}
                onChange={(e) => setOtmDistance(e.target.value)}
                placeholder="10"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white 
                  focus:outline-none focus:border-blue-500"
              />
            ) : (
              <input
                type="number"
                value={spreadWidth}
                onChange={(e) => setSpreadWidth(parseFloat(e.target.value))}
                placeholder="5"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white 
                  focus:outline-none focus:border-blue-500"
              />
            )}
          </div>
        </div>

        <button
          onClick={handleBuild}
          disabled={!symbol || !underlyingPrice || loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500
            text-white rounded-lg font-medium transition-colors mb-6"
        >
          {loading ? '⏳ Berechne...' : '🧬 Strategie Bauen'}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Strategy Header */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-white font-bold text-lg">{result.strategy}</h3>
                  <p className="text-slate-400 text-sm">{result.symbol} @ ${result.underlyingPrice.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-bold text-xl">+${result.netCredit.toFixed(0)}</div>
                  <div className="text-slate-500 text-xs">Net Credit</div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                <MetricBox label="Max Profit" value={`$${result.maxProfit.toFixed(0)}`} color="emerald" />
                <MetricBox label="Max Risk" value={typeof result.maxRisk === 'number' ? `$${result.maxRisk.toFixed(0)}` : result.maxRisk} color="red" />
                <MetricBox label="POP" value={`${(result.probabilityOfProfit * 100).toFixed(0)}%`} color="blue" />
                <MetricBox label="R/R" value={result.riskRewardRatio} color="amber" />
              </div>
            </div>

            {/* Legs Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-700/50 border-b border-slate-700">
                <span className="text-white text-sm font-medium">Legs</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="px-4 py-2 text-left">Side</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-right">Strike</th>
                    <th className="px-4 py-2 text-right">Premium</th>
                    <th className="px-4 py-2 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {result.legs.map((leg, i) => (
                    <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          leg.side === 'short' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {leg.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-300 capitalize">{leg.type}</td>
                      <td className="px-4 py-2 text-right text-white font-mono">${leg.strike.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-white font-mono">${leg.premium.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-slate-400 font-mono">{leg.delta?.toFixed(2) || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* P&L Visualisierung */}
            <PnLVisualizer result={result} />

            {/* Break-Even & Profit Zone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="text-slate-400 text-xs mb-1">Profit Zone</div>
                <div className="text-white font-mono text-sm">{result.profitZone}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="text-slate-400 text-xs mb-1">Margin Required</div>
                <div className="text-white font-mono text-sm">${result.marginRequired?.toLocaleString() || '--'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBox({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400'
  };

  return (
    <div className="bg-slate-700/50 rounded-lg p-2 text-center">
      <div className={`text-lg font-bold ${colors[color]}`}>{value}</div>
      <div className="text-slate-500 text-xs">{label}</div>
    </div>
  );
}

/**
 * P&L Visualisierung als einfaches SVG-Diagramm
 */
function PnLVisualizer({ result }) {
  if (!result) return null;

  const { legs, underlyingPrice, netCredit, maxRisk, strategy } = result;

  // Berechne P&L für verschiedene Underlying-Preise
  const minPrice = underlyingPrice * 0.75;
  const maxPrice = underlyingPrice * 1.25;
  const steps = 50;
  const stepSize = (maxPrice - minPrice) / steps;

  const dataPoints = [];
  for (let i = 0; i <= steps; i++) {
    const price = minPrice + i * stepSize;
    let pnl = 0;

    legs.forEach(leg => {
      const qty = leg.qty || 1;
      const multiplier = leg.side === 'short' ? -1 : 1;

      if (leg.type === 'put') {
        const intrinsic = Math.max(0, leg.strike - price);
        pnl += multiplier * qty * (leg.premium - intrinsic) * 100;
      } else {
        const intrinsic = Math.max(0, price - leg.strike);
        pnl += multiplier * qty * (leg.premium - intrinsic) * 100;
      }
    });

    dataPoints.push({ price, pnl });
  }

  // SVG Dimensions
  const width = 600;
  const height = 200;
  const padding = 40;

  const minPnL = Math.min(...dataPoints.map(d => d.pnl));
  const maxPnL = Math.max(...dataPoints.map(d => d.pnl));
  const pnlRange = maxPnL - minPnL || 1;

  const xScale = (price) => padding + ((price - minPrice) / (maxPrice - minPrice)) * (width - 2 * padding);
  const yScale = (pnl) => height - padding - ((pnl - minPnL) / pnlRange) * (height - 2 * padding);

  // Generate path
  const pathData = dataPoints.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(d.price)} ${yScale(d.pnl)}`
  ).join(' ');

  // Zero line
  const zeroY = yScale(0);

  // Current price line
  const currentX = xScale(underlyingPrice);

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-medium">P&L Profil</span>
        <span className="text-slate-500 text-xs">{strategy}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(ratio => (
          <line
            key={ratio}
            x1={padding}
            y1={padding + ratio * (height - 2 * padding)}
            x2={width - padding}
            y2={padding + ratio * (height - 2 * padding)}
            stroke="#334155"
            strokeWidth="0.5"
            strokeDasharray="4"
          />
        ))}

        {/* Zero line */}
        <line
          x1={padding}
          y1={zeroY}
          x2={width - padding}
          y2={zeroY}
          stroke="#64748b"
          strokeWidth="1"
        />

        {/* P&L Line */}
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />

        {/* Profit area (above zero) */}
        <path
          d={`${pathData} L ${xScale(maxPrice)} ${zeroY} L ${xScale(minPrice)} ${zeroY} Z`}
          fill="rgba(16, 185, 129, 0.1)"
        />

        {/* Loss area (below zero) */}
        <path
          d={`${pathData} L ${xScale(maxPrice)} ${zeroY} L ${xScale(minPrice)} ${zeroY} Z`}
          fill="rgba(239, 68, 68, 0.1)"
        />

        {/* Current price marker */}
        <line
          x1={currentX}
          y1={padding}
          x2={currentX}
          y2={height - padding}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="4"
        />
        <text x={currentX + 5} y={padding + 15} fill="#f59e0b" fontSize="10">
          Current
        </text>

        {/* X-Axis Labels */}
        <text x={padding} y={height - 10} fill="#64748b" fontSize="10" textAnchor="middle">
          ${minPrice.toFixed(0)}
        </text>
        <text x={width / 2} y={height - 10} fill="#64748b" fontSize="10" textAnchor="middle">
          ${underlyingPrice.toFixed(0)}
        </text>
        <text x={width - padding} y={height - 10} fill="#64748b" fontSize="10" textAnchor="middle">
          ${maxPrice.toFixed(0)}
        </text>

        {/* Y-Axis Labels */}
        <text x={10} y={yScale(maxPnL) + 4} fill="#10b981" fontSize="10">
          +${maxPnL.toFixed(0)}
        </text>
        <text x={10} y={yScale(minPnL) + 4} fill="#ef4444" fontSize="10">
          ${minPnL.toFixed(0)}
        </text>
      </svg>

      <div className="flex items-center justify-center gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-emerald-500"></span>
          <span className="text-slate-400">Profit</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-red-500"></span>
          <span className="text-slate-400">Loss</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500 border-dashed"></span>
          <span className="text-slate-400">Current Price</span>
        </span>
      </div>
    </div>
  );
}
