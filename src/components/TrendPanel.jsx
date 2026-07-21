import { useState, useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown, Target, Scissors, ArrowUpRight, ArrowDownRight } from 'lucide-react'

export default function TrendPanel() {
  const [price, setPrice] = useState(120)
  const [atr, setAtr] = useState(3.2)
  const [sma50, setSma50] = useState(115)
  const [sma200, setSma200] = useState(98)
  const [position, setPosition] = useState(5000)
  const [tp1Pct, setTp1Pct] = useState(12)
  const [tp2Pct, setTp2Pct] = useState(25)
  const [trailMult, setTrailMult] = useState(2)
  const [checks, setChecks] = useState({ sma200: false, golden: false, higher: false })

  const stopLoss = price - (2 * atr)
  const stopPct = ((price - stopLoss) / price * 100).toFixed(1)
  const trailStop = price - (trailMult * atr)
  const trailPct = ((price - trailStop) / price * 100).toFixed(1)

  const tp1Price = price * (1 + tp1Pct / 100)
  const tp2Price = price * (1 + tp2Pct / 100)
  const tp1Amount = position * 0.5
  const tp2Amount = position * 0.3
  const remaining = position * 0.2

  const rrr = (tp1Pct / parseFloat(stopPct)).toFixed(1)
  const isBull = price > sma200
  const isGolden = sma50 > sma200

  const toggleCheck = (key) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Setup */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Trendfolge-Setup
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Aktienkurs (€)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  ATR (14 Tage) €
                </label>
                <input
                  type="number"
                  value={atr}
                  onChange={e => setAtr(Number(e.target.value))}
                  step="0.1"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  SMA 50 (€)
                </label>
                <input
                  type="number"
                  value={sma50}
                  onChange={e => setSma50(Number(e.target.value))}
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  SMA 200 (€)
                </label>
                <input
                  type="number"
                  value={sma200}
                  onChange={e => setSma200(Number(e.target.value))}
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Positionsgröße (€)
              </label>
              <input
                type="number"
                value={position}
                onChange={e => setPosition(Number(e.target.value))}
                step="100"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Ergebnisse */}
          <div className="mt-6 bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Trend-Status</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isBull ? 'bg-accent/20 text-accent' : 'bg-danger/20 text-danger'}`}>
                {isBull ? 'BULLEN' : 'BÄREN'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">SMA 50 vs 200</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isGolden ? 'bg-accent/20 text-accent' : 'bg-warn/20 text-warn'}`}>
                {isGolden ? 'GOLDEN CROSS' : 'KEIN CROSS'}
              </span>
            </div>
            <ResultRow label="ATR-Stop-Loss" value={`${stopLoss.toFixed(2)} € (${stopPct}%)`} danger />
            <ResultRow label="Trailing-Stop" value={`${trailStop.toFixed(2)} € (${trailPct}%)`} warn />
            <ResultRow label="Risk-Reward (TP1)" value={`1:${rrr}`} accent />
          </div>
        </div>

        {/* Gewinn-Planer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            Gewinn-Realisierungs-Plan
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Teilgewinn 1 bei: <span className="text-accent font-bold">{tp1Pct}%</span>
              </label>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={tp1Pct}
                onChange={e => setTp1Pct(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>5%</span>
                <span>30%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Teilgewinn 2 bei: <span className="text-accent font-bold">{tp2Pct}%</span>
              </label>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={tp2Pct}
                onChange={e => setTp2Pct(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>15%</span>
                <span>50%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Trailing Stop (x ATR)
              </label>
              <select
                value={trailMult}
                onChange={e => setTrailMult(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none"
              >
                <option value={1.5}>1.5x ATR — eng</option>
                <option value={2}>2x ATR — Standard</option>
                <option value={2.5}>2.5x ATR — weit</option>
                <option value={3}>3x ATR — Trend-Rider</option>
              </select>
            </div>
          </div>

          {/* Gewinn-Matrix */}
          <div className="mt-6 bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-warn" />
                Teilgewinn 1 ({tp1Pct}%)
              </span>
              <span className="font-mono font-bold text-accent">{tp1Price.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">→ Verkauf 50%</span>
              <span className="font-mono text-slate-300">{tp1Amount.toFixed(0)} €</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-accent" />
                Teilgewinn 2 ({tp2Pct}%)
              </span>
              <span className="font-mono font-bold text-accent">{tp2Price.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">→ Verkauf 30%</span>
              <span className="font-mono text-slate-300">{tp2Amount.toFixed(0)} €</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-400">Rest mit Trailing</span>
              <span className="font-mono font-bold text-warn">{remaining.toFixed(0)} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trailing-Stop Visualisierung */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <ArrowUpRight className="w-5 h-5 text-accent" />
          Trailing-Stop Simulation (30 Tage)
        </h2>
        <TrailingChart price={price} atr={atr} trailMult={trailMult} tp1={tp1Price} tp2={tp2Price} />
        <div className="mt-4 p-4 bg-slate-950 rounded-xl border-l-4 border-accent">
          <p className="text-sm text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-200">Regel:</strong> Der Trailing-Stop folgt dem Kurs mit einem Abstand von {trailMult}x ATR. Er wird nur nach oben angepasst, nie nach unten. So bleibst du im Trend, bis er eindeutig bricht.
          </p>
        </div>
      </div>

      {/* Trend-Filter Checkliste */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          Trend-Filter Checkliste
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CheckItem
            icon={<ArrowUpRight className="w-6 h-6" />}
            title="Kurs > SMA 200"
            desc="Bullenmarkt"
            checked={checks.sma200}
            onToggle={() => toggleCheck('sma200')}
            autoCheck={isBull}
          />
          <CheckItem
            icon={<TrendingUp className="w-6 h-6" />}
            title="SMA 50 > SMA 200"
            desc="Golden Cross"
            checked={checks.golden}
            onToggle={() => toggleCheck('golden')}
            autoCheck={isGolden}
          />
          <CheckItem
            icon={<Target className="w-6 h-6" />}
            title="Higher Highs"
            desc="Trend intakt"
            checked={checks.higher}
            onToggle={() => toggleCheck('higher')}
          />
        </div>
      </div>
    </div>
  )
}

function TrailingChart({ price, atr, trailMult, tp1, tp2 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const days = 30

    // Generate simulated price path
    const prices = []
    const stops = []
    let current = price
    let maxStop = price - (trailMult * atr)

    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.35) * atr * 1.5
      current = Math.max(current + change, price * 0.85)
      const newStop = current - (trailMult * atr)
      maxStop = Math.max(maxStop, newStop)
      prices.push(current)
      stops.push(maxStop)
    }

    const maxP = Math.max(...prices, tp2 * 1.1)
    const minP = Math.min(...stops, price * 0.9)
    const range = maxP - minP

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = h - (i / 5) * h
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Price line
    ctx.strokeStyle = '#00d4aa'
    ctx.lineWidth = 2
    ctx.beginPath()
    prices.forEach((p, i) => {
      const x = (i / (days - 1)) * (w - 40) + 20
      const y = h - 20 - ((p - minP) / range) * (h - 40)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Trailing stop line
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    stops.forEach((s, i) => {
      const x = (i / (days - 1)) * (w - 40) + 20
      const y = h - 20 - ((s - minP) / range) * (h - 40)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.setLineDash([])

    // TP1 line
    const tp1y = h - 20 - ((tp1 - minP) / range) * (h - 40)
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(20, tp1y)
    ctx.lineTo(w - 20, tp1y)
    ctx.stroke()
    ctx.fillStyle = '#f59e0b'
    ctx.font = '10px Inter'
    ctx.fillText(`TP1 ${tp1.toFixed(0)}€`, 25, tp1y - 5)

    // TP2 line
    const tp2y = h - 20 - ((tp2 - minP) / range) * (h - 40)
    ctx.strokeStyle = '#00d4aa'
    ctx.beginPath()
    ctx.moveTo(20, tp2y)
    ctx.lineTo(w - 20, tp2y)
    ctx.stroke()
    ctx.fillStyle = '#00d4aa'
    ctx.fillText(`TP2 ${tp2.toFixed(0)}€`, 25, tp2y - 5)

    // Legend
    ctx.fillStyle = '#00d4aa'
    ctx.fillRect(w - 100, 15, 12, 2)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('Kurs', w - 80, 20)

    ctx.fillStyle = '#ef4444'
    ctx.fillRect(w - 100, 30, 12, 2)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('Trailing Stop', w - 80, 35)

  }, [price, atr, trailMult, tp1, tp2])

  return (
    <div className="h-64 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

function ResultRow({ label, value, danger, warn, accent }) {
  const colorClass = danger ? 'text-danger' : warn ? 'text-warn' : accent ? 'text-accent' : 'text-slate-200'
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-mono font-bold ${colorClass}`}>{value}</span>
    </div>
  )
}

function CheckItem({ icon, title, desc, checked, onToggle, autoCheck }) {
  const isChecked = autoCheck !== undefined ? autoCheck : checked
  return (
    <div
      onClick={onToggle}
      className={`p-5 rounded-xl border-2 cursor-pointer transition-all text-center ${
        isChecked
          ? 'border-accent bg-accent/10'
          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
      }`}
    >
      <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
        isChecked ? 'bg-accent/20 text-accent' : 'bg-slate-800 text-slate-500'
      }`}>
        {icon}
      </div>
      <div className="font-bold text-sm mb-1">{title}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </div>
  )
}