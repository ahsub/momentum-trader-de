import React, { useState, useEffect } from 'react';
import MomentumPanel from './components/MomentumPanel.jsx';
import TrendPanel from './components/TrendPanel.jsx';
import OrbPanel from './components/OrbPanel.jsx';
import WatchlistPanel from './components/WatchlistPanel.jsx';
import GapScanner from './components/GapScanner.jsx';
import RegimeBadge from './components/RegimeBadge.jsx';
import RiskScoreBar from './components/RiskScoreBar.jsx';
import PositionGate from './components/PositionGate.jsx';
import CircuitBreakerAlert from './components/CircuitBreakerAlert.jsx';
import { useAlerts } from './hooks/useAlerts.js';
import AlertPanel from './components/AlertPanel.jsx';
import AlertToast from './components/AlertToast.jsx';
import AlertBadge from './components/AlertBadge.jsx';
import McmStorePanel from './components/McmStorePanel.jsx';

const TABS = [
  { id: 'momentum', label: 'Momentum', icon: '📈' },
  { id: 'trend', label: 'Trend', icon: '📊' },
  { id: 'orb', label: 'ORB', icon: '⏰' },
  { id: 'watchlist', label: 'Watchlist', icon: '👁️' },
  { id: 'gapscanner', label: 'Gap Scanner', icon: '🔍' },
  { id: 'alerts', label: 'Alerts', icon: '🚨' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('momentum');
  const [showDevPanel, setShowDevPanel] = useState(false);
  const {
    alerts, triggered, history, webhooks, pushEnabled,
    addAlert, addAlertFromTemplate, updateAlert, deleteAlert, toggleAlert,
    scanAlerts, clearTriggered, clearHistory, enablePush,
    addWebhook, onDeleteWebhook, toggleWebhook,
  } = useAlerts();
  
  const renderPanel = () => {
    switch (activeTab) {
      case 'momentum': return <MomentumPanel />;
      case 'trend': return <TrendPanel />;
      case 'orb': return <OrbPanel />;
      case 'watchlist': return <WatchlistPanel />;
      case 'gapscanner': return <GapScanner />;
      case 'alerts': return <AlertPanel alerts={alerts} history={history} webhooks={webhooks} pushEnabled={pushEnabled} onAdd={addAlert} onAddFromTemplate={addAlertFromTemplate} onUpdate={updateAlert} onDelete={deleteAlert} onToggle={toggleAlert} onClearHistory={clearHistory} onEnablePush={enablePush} onAddWebhook={addWebhook} onDeleteWebhook={onDeleteWebhook} onToggleWebhook={toggleWebhook} />;
      default: return <MomentumPanel />;
    }
  };
  
  const runAlertScan = async () => {
    if (alerts.length === 0) return;
    const symbols = [...new Set(alerts.filter((a) => a.enabled).map((a) => a.symbol))];
    if (symbols.length === 0) return;
    try {
      const marketData = await Promise.all(
        symbols.map(async (sym) => {
          const res = await fetch('https://finnhub.io/api/v1/quote?symbol=' + sym + '&token=' + import.meta.env.VITE_FINNHUB_API_KEY);
          const data = await res.json();
          return { symbol: sym, price: data.c, change: data.d, changePercent: data.dp, volume: data.v || 0 };
        })
      );
      scanAlerts(marketData);
    } catch (err) { console.error('Alert-Scan fehlgeschlagen:', err); }
  };
  
  useEffect(() => {
    const interval = setInterval(runAlertScan, 60000);
    return () => clearInterval(interval);
  }, [alerts]);
  
  const handleGapScanComplete = (scanResults) => {
    const marketData = scanResults.map((r) => ({
      symbol: r.symbol, price: r.price, change: r.change,
      changePercent: r.changePercent, volume: r.volume, gapPercent: r.gapPercent,
    }));
    scanAlerts(marketData);
  };
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-emerald-500/20">
                MT
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-100 tracking-tight">Momentum Trader Pro</h1>
                <p className="text-[10px] text-slate-500">v2.0.0 • Phase 4</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <RegimeBadge />
              <div className="hidden sm:block w-48">
                <RiskScoreBar />
              </div>
              <AlertBadge count={triggered.length} onClick={() => setActiveTab('alerts')} />
            </div>
            
            <button
              onClick={() => setShowDevPanel(!showDevPanel)}
              className={`
                px-2 py-1 rounded text-[10px] font-mono transition-colors
                ${showDevPanel ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}
              `}
            >
              {showDevPanel ? 'DEV ON' : 'DEV'}
            </button>
          </div>
        </div>
      </header>
      
      {/* DEV PANEL */}
      {showDevPanel && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <McmStorePanel />
        </div>
      )}
      
      {/* OVERLAYS */}
      <PositionGate />
      <AlertToast triggered={triggered} onClear={clearTriggered} />
      <CircuitBreakerAlert />
      
      {/* TABS */}
      <nav className="sticky top-[65px] z-30 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-all
                  ${activeTab === tab.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}
                `}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>
      
      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderPanel()}
      </main>
      
      {/* FOOTER */}
      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-[10px] text-slate-600">
          <span>Momentum Trader Pro v2.0.0</span>
          <span>github.com/ahsub/momentum-trader-de</span>
        </div>
      </footer>
    </div>
  );
}
