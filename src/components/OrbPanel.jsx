import { useState } from 'react'
import { Clock, ArrowRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export default function OrbPanel() {
  const [open, setOpen] = useState(55.00)
  const [high, setHigh] = useState(56.20)
  const [low, setLow] = useState(54.80)
  const [current, setCurrent] = useState(56.50)

  const range = high - low
  const breakoutLevel = high + (range * 0.1)
  const confirmed = current >= breakoutLevel
  const breakoutPct = ((current - high) / high * 100).toFixed(2)

  const steps = [
    { time: '07:30', label: 'Pre-Market Scan', desc: 'TradingView Screener: Gap >5%, RVOL >3x', status: 'done' },
    { time: '08:00', label: 'Catalyst Check', desc: 'Finviz, Benzinga, SEC-Filings', status: 'done' },
    { time: '08:30', label: 'KO-Auswahl', desc: 'Hebel 2-3x, KO-Schwelle mind. 12% unter Einstieg', status: 'done' },
    { time: '09:00', label: 'Xetra Open', desc: 'ORB-Range beginnt', status: 'active' },
    { time: '09:15', label: 'ORB-Range set', desc: '15-Min Hoch/Tief definieren', status: 'wait' },
    { time: '09:20+', label: 'Einstieg', desc: 'Breakout + 5 Min Bestätigung', status: 'wait' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ORB Rechner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Deutsche ORB-Strategie
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Xetra-Eröffnung (€)
              </label>
              <input
                type="number"
                value={open}
                onChange={e => setOpen(Number(e.target.value))}
                step="0.01"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  15-Min Hoch (€)
                </label>
                <input
                  type="number"
                  value={high}
                  onChange={e => setHigh(Number(e.target.value))}
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  15-Min Tief (€)
                </label>
                <input
                  type="number"
                  value={low}
                  onChange={e => setLow(Number(e.target.value))}
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Aktueller Kurs (€)
              </label>
              <input
                type="number"
                value={current}
                onChange={e => setCurrent(Number(e.target.value))}
                step="0.01"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-accent focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="mt-6 bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
            <ResultRow label="ORB-Range (15 Min)" value={`${low.toFixed(2)} – ${high.toFixed(2)} €`} />
            <ResultRow label="Range-Breite" value={`${range.toFixed(2)} € (${(range/open*100).toFixed(1)}%)`} />
            <ResultRow label="Breakout-Level (+10% Range)" value={`${breakoutLevel.toFixed(2)} €`} accent />
            <ResultRow label="Aktueller Kurs" value={`${current.toFixed(2)} €`} />
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Breakout-Status</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${confirmed ? 'bg-accent/20 text-accent' : 'bg-warn/20 text-warn'}`}>
                {confirmed ? 'BESTÄTIGT ✓' : 'WARTEN...'}
              </span>
            </div>
            <ResultRow
              label="Abstand zum Breakout"
              value={`${confirmed ? '+' : ''}${breakoutPct}%`}
              accent={confirmed}
              warn={!confirmed}
            />
          </div>
        </div>

        {/* Tagesablauf */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Tagesablauf (MEZ)
          </h2>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-800" />

            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${
                    step.status === 'done' ? 'bg-slate-800 text-slate-500' :
                    step.status === 'active' ? 'bg-accent/20 text-accent border border-accent' :
                    'bg-slate-950 text-slate-600 border border-dashed border-slate-700'
                  }`}>
                    <span className="text-xs font-bold">{step.time}</span>
                  </div>
                  <div className="pt-1">
                    <div className="font-bold text-sm">{step.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{step.desc}</div>
                  </div>
                  {step.status === 'done' && <CheckCircle2 className="w-4 h-4 text-accent ml-auto mt-3" />}
                  {step.status === 'active' && <AlertCircle className="w-4 h-4 text-warn ml-auto mt-3" />}
                  {step.status === 'wait' && <XCircle className="w-4 h-4 text-slate-600 ml-auto mt-3" />}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-4 bg-slate-950 rounded-xl border-l-4 border-accent">
            <p className="text-sm text-slate-400 leading-relaxed">
              💡 <strong className="text-slate-200">Regel:</strong> Warte 5 Minuten nach ORB-Breakout. Ein Spike allein reicht nicht – der Kurs muss sich über dem 15-Min-Hoch halten.
            </p>
          </div>
        </div>
      </div>

      {/* Morgendlicher Workflow Detail */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-accent" />
          Detaillierter Morgen-Workflow
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WorkflowCard
            num="1"
            time="07:30"
            title="Pre-Market Scan"
            desc="TradingView Screener: Filter auf Gap >5%, RVOL >3x, Float <50M, Volumen >50k. Notiere 5-15 Kandidaten."
            color="accent"
          />
          <WorkflowCard
            num="2"
            time="08:00"
            title="Catalyst-Analyse"
            desc="Prüfe Finviz, Benzinga, SEC-Filings. Earnings? FDA? Guidance? Quelle verifizieren. Fade-würdige News aussortieren."
            color="accent"
          />
          <WorkflowCard
            num="3"
            time="08:30"
            title="KO-Auswahl & Risiko"
            desc="Hebel 2-3x wählen. KO-Schwelle mind. 12% unter Einstieg. Positionsgröße max. 2% des Kapitals. ATR-Puffer prüfen."
            color="warn"
          />
          <WorkflowCard
            num="4"
            time="09:00–09:15"
            title="ORB-Beobachtung"
            desc="Xetra-Open abwarten. Kein Einstieg vor 09:15! 15-Min-Range definieren (Hoch/Tief). Emotionen kontrollieren."
            color="warn"
          />
          <WorkflowCard
            num="5"
            time="09:15–09:20"
            title="Breakout-Prüfung"
            desc="Kurs über 15-Min-Hoch? +10% Range als Breakout-Level. Warte 5 Minuten auf Bestätigung. Kein Spike-Trading!"
            color="accent"
          />
          <WorkflowCard
            num="6"
            time="09:20+"
            title="Einstieg oder Abbruch"
            desc="Breakout bestätigt = Einstieg mit KO-Zertifikat. Kein Breakout = nächster Tag. Es gibt jeden Tag neue Chancen."
            color="accent"
          />
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

function WorkflowCard({ num, time, title, desc, color }) {
  const colorMap = {
    accent: 'bg-accent text-slate-950',
    warn: 'bg-warn text-slate-950',
    danger: 'bg-danger text-white',
  }
  return (
    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${colorMap[color]}`}>
          {num}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500">{time}</span>
            <span className="font-bold text-sm">{title}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  )
}