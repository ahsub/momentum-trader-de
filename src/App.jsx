import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Activity, 
  BarChart3, 
  List, 
  BookOpen,
  Menu,
  X,
  LayoutDashboard,
  Search,
  Upload,
  FileText
} from 'lucide-react';

// ─── Panels ───
import MomentumPanel from './components/MomentumPanel';
import TrendPanel from './components/TrendPanel';
import OrbPanel from './components/OrbPanel';
import WatchlistPanel from './components/WatchlistPanel';
import GapScanner from './components/GapScanner';
import PortfolioPanel from './components/PortfolioPanel';
import OptionsScanner from './components/OptionsScanner';
import CapTraderImport from './components/CapTraderImport';
import { TaxDemoPage } from './components/tax/TaxDemoPage';

// ─── NEW: Paper Mode Toggle ───
import PaperModeToggle from './components/PaperModeToggle';

// ─── Stores ───
import { usePortfolioStore } from './stores/portfolioStore';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'momentum', label: 'Momentum', icon: TrendingUp },
  { id: 'trend', label: 'Trend', icon: Activity },
  { id: 'orb', label: 'ORB', icon: BarChart3 },
  { id: 'watchlist', label: 'Watchlist', icon: List },
  { id: 'gaps', label: 'Gap Scanner', icon: BarChart3 },
  { id: 'portfolio', label: 'Portfolio', icon: BookOpen },
  { id: 'scanner', label: 'Options Scanner', icon: Search },
  { id: 'captrader', label: 'CapTrader Import', icon: Upload },
  { id: 'tax', label: 'Steueranalyse', icon: FileText },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPaperMode = usePortfolioStore((state) => state.isPaperMode);
  const togglePaperMode = usePortfolioStore((state) => state.togglePaperMode);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        togglePaperMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePaperMode]);

  const renderPanel = () => {
    switch (activeTab) {
      case 'momentum': return <MomentumPanel />;
      case 'trend': return <TrendPanel />;
      case 'orb': return <OrbPanel />;
      case 'watchlist': return <WatchlistPanel />;
      case 'gaps': return <GapScanner />;
      case 'portfolio': return <PortfolioPanel />;
      case 'scanner': return <OptionsScanner />;
      case 'captrader': return <CapTraderImport />;
      case 'tax': return <TaxDemoPage />;
      default: return <PortfolioPanel />;
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 transition-colors duration-300 ${isPaperMode ? 'paper-mode' : ''}`}>
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              Momentum<span className="text-emerald-400">Trader</span>
              <span className="ml-2 text-xs font-medium text-slate-500">DE</span>
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <PaperModeToggle />
            <button
              className="md:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-slate-800 bg-slate-900/95"
            >
              <div className="space-y-1 p-4">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderPanel()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
