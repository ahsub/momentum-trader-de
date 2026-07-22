import { useState } from 'react'
import { Rocket, TrendingUp, Clock, Shield, Activity, ChevronRight, Zap } from 'lucide-react'
import MomentumPanel from './components/MomentumPanel'
import TrendPanel from './components/TrendPanel'
import OrbPanel from './components/OrbPanel'
import WatchlistPanel from './components/WatchlistPanel'
import GapScanner from './components/GapScanner'

function App() {
  const [activeTab, setActiveTab] = useState('momentum')
  const [showWatchlist, setShowWatchlist] = useState(false)

  const tabs = [
    { id: 'momentum', label: 'Momentum (KO)', icon: Rocket },
    { id: 'trend', label: 'Trendfolge', icon: TrendingUp },
    { id: 'orb', label: 'ORB-Setup', icon: Clock },
    { id: 'scanner', label: 'Gap Scanner', icon: Zap },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Momentum & Trend Trader</h1>
              <p className="text-xs text-slate-500">Deutscher Markt · KO-Zertifikate · Xetra 09:00 MEZ</p>
            </div>
          </div>
          <button
            onClick={() => setShowWatchlist(!showWatchlist)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <Shield className="w-4 h-4" />
            Watchlist
            <ChevronRight className={`w-4 h-4 transition-transform ${showWatchlist ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </header>

      {/* Watchlist Sidebar */}
      {showWatchlist && (
        <div className="border-b border-slate-800 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <WatchlistPanel />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'momentum' && <MomentumPanel />}
        {activeTab === 'trend' && <TrendPanel />}
        {activeTab === 'orb' && <OrbPanel />}
        {activeTab === 'scanner' && <GapScanner />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>⚠️ Hinweis: Trading birgt erhebliche Risiken. Dieses Tool dient ausschließlich der Analyse.</p>
          <p className="mt-1">Keine Anlageberatung. Verluste des eingesetzten Kapitals sind möglich.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
