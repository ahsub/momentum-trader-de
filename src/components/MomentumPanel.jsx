import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, TrendingUp, Volume2, Newspaper, Shield } from 'lucide-react'

export default function MomentumPanel() {
  const [price, setPrice] = useState(55)
  const [gap, setGap] = useState(10)
  const [leverage, setLeverage] = useState(3)
  const [risk, setRisk] = useState(2)
  const [atr, setAtr] = useState(2.5)
  const [checks, setChecks] = useState({ catalyst: false, volume: false, kosafe: false })

  const entry = price
  const koDistance = (risk / 100) / leverage
  const koLevel = entry * (1 - koDistance)
  const koPct = (koDistance * 100).toFixed(2)
  const priceDropToKO = (koDistance * 100).toFixed(1)
  const atrBuffer = (2 * atr / entry * 100).toFixed(1)
  const isSafe = parseFloat(priceDropToKO) >= parseFloat(atrBuffer)

  const volNormal = `${(3 * leverage).toFixed(0)}-${(5 * leverage).toFixed(0)}`
  const volPullback = (8 * leverage).toFixed(0)

  const allChecked = checks.catalyst && checks.volume && checks.kosafe

  const toggleCheck = (key) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KO Rechner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            KO-Zertifikat Rechner
          </h2>

          <div className="space-y-4">
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
                Gap % (Pre-Market)
              </label>
              <input
                type="number"
                value={gap}
                onChange={e => setGap(Number(e.target.value))}
                step="0.1"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Hebel
              </label>
              <select
                value={leverage}
                onChange={e => setLeverage(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none"
              >
                <option value={2}>2x — konservativ</option>
                <option value={3}>3x — Standard</option>
                <option value={4}>4x — aggressiv</option>
                <option value={5}>5x — nur DAX</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Max. Risiko % deines Kapitals: <span className="text-accent font-bold">{risk}%</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={risk}
                onChange={e => setRisk(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>0.5%</span>
                <span>5%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                ATR (14 Tage) in €
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

          {/* Ergebnisse */}
          <div className="mt-6 bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
            <ResultRow label="Einstieg (nach Gap)" value={`${entry.toFixed(2)} €`} />
            <ResultRow label="KO-Schwelle" value={`${koLevel.toFixed(2)} €`} danger />
            <ResultRow label="KO-Abstand zum Einstieg" value={`${koPct}%`} warn />
            <ResultRow label="Aktienkurs-Rückgang bis KO" value={`${priceDropToKO}%`} warn />
            <ResultRow label="2x ATR Puffer" value={`${atrBuffer}%`} accent />
            <ResultRow label="Max. Verlust bei KO" value={`${risk}% Kapital`} danger />
          </div>
        </div>

        {/* Volatilitäts-Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warn" />
            Volatilitäts-Matrix
          </h2>

          <div className="space-y-4">
            <ScenarioCard
              title="Intraday-Schwankung (normal)"
              badge="Häufig"
              badgeColor="yellow"
              desc={`±3-5% Aktienkurs = ±${volNormal}% KO-Preis`}
              barWidth={45}
              barColor="bg-warn"
            />
            <ScenarioCard
              title="Rücksetzer (Pullback)"
              badge="Erträglich"
              badgeColor="yellow"
              desc={`-8% Aktienkurs = -${volPullback}% KO-Preis`}
              barWidth={70}
              barColor="bg-danger"
            />
            <ScenarioCard
              title="KO-Schwelle (Totalverlust)"
              badge="Kritisch"
              badgeColor="red"
              desc={`Bei -${priceDropToKO}% Aktienkurs = Totalverlust`}
              barWidth={100}
              barColor="bg-danger"
            />
          </div>

          <div className={`mt-5 p-4 rounded-xl border-l-4 ${isSafe ? 'border-accent bg-accent/10' : 'border-warn bg-warn/10'}`}>
            <p className="text-sm leading-relaxed">
              {isSafe
                ? `✅ Optimal: KO-Abstand (${priceDropToKO}%) bietet genug Puffer für 2x ATR (${atrBuffer}%). Normale Schwankungen werden überstanden.`
                : `⚠️ Warnung: KO-Abstand (${priceDropToKO}%) ist kleiner als 2x ATR (${atrBuffer}%). Erhöhe den Hebel oder vergrößere das Risiko.`}
            </p>
          </div>

          <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold mb-2 text-slate-400">Hebel-Empfehlung</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Standard Momentum</span>
                <span className="font-mono text-accent">3x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">High-Vol Biotech</span>
                <span className="font-mono text-warn">2x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DAX-Bluechip</span>
                <span className="font-mono text-accent">4x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkliste */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-accent" />
          Einstiegs-Checkliste (Momentum)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CheckItem
            icon={<Newspaper className="w-6 h-6" />}
            title="Catalyst"
            desc="Earnings, FDA, Übernahme?"
            checked={checks.catalyst}
            onToggle={() => toggleCheck('catalyst')}
          />
          <CheckItem
            icon={<Volume2 className="w-6 h-6" />}
            title="Volumen"
            desc="RVOL > 3x?"
            checked={checks.volume}
            onToggle={() => toggleCheck('volume')}
          />
          <CheckItem
            icon={<Shield className="w-6 h-6" />}
            title="KO-Abstand"
            desc={isSafe ? '> 12% Puffer ✓' : 'Zu eng!'}
            checked={checks.kosafe}
            onToggle={() => toggleCheck('kosafe')}
            autoCheck={isSafe}
          />
        </div>

        <div className={`mt-5 p-5 rounded-xl text-center font-bold text-lg transition-all ${
          allChecked
            ? 'bg-accent/20 text-accent border border-accent'
            : checks.catalyst || checks.volume || checks.kosafe
            ? 'bg-warn/20 text-warn border border-warn'
            : 'bg-slate-800 text-slate-500 border border-slate-700'
        }`}>
          {allChecked
            ? '🚀 ALLE CHECKS BESTÄTIGT — EINSTIEG MÖGLICH'
            : checks.catalyst || checks.volume || checks.kosafe
            ? `⏳ ${Object.values(checks).filter(Boolean).length}/3 Checks — Warte auf Bestätigung`
            : '⏳ Warte auf alle 3 Checks...'}
        </div>
      </div>
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

function ScenarioCard({ title, badge, badgeColor, desc, barWidth, barColor }) {
  const badgeClasses = {
    yellow: 'bg-warn/20 text-warn',
    red: 'bg-danger/20 text-danger',
    green: 'bg-accent/20 text-accent',
  }
  return (
    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-sm">{title}</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClasses[badgeColor]}`}>{badge}</span>
      </div>
      <p className="text-sm text-slate-400 mb-3">{desc}</p>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${barWidth}%` }} />
      </div>
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