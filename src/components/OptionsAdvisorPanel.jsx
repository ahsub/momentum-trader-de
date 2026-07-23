import { useState } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useSnapshotReader } from '../hooks/useSnapshotReader';
import { findCSPSetup, analyzeCSPRoll } from '../utils/cspAdvisor';
import { findCCSetup, analyzeCCRoll } from '../utils/ccAdvisor';
import { analyzeWheelStage, calculateWheelPnL } from '../utils/wheelTracker';
import CSPSetupCard from './CSPSetupCard';
import CCSetupCard from './CCSetupCard';
import WheelTrackerPanel from './WheelTrackerPanel';

/**
 * Options Advisor Panel - Main Phase 7 Component
 * Integrates CSP, CC, and Wheel strategy advisors
 */
export default function OptionsAdvisorPanel({ className = '' }) {
  const [activeTab, setActiveTab] = useState('csp');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const { positions, trades, portfolioSummary } = usePortfolioStore();
  const { regime, snapshot } = useSnapshotReader();

  const tabs = [
    { id: 'csp', label: 'Cash Secured Put', icon: '🛡️' },
    { id: 'cc', label: 'Covered Call', icon: '📞' },
    { id: 'wheel', label: 'Wheel Tracker', icon: '♻️' },
    { id: 'screener', label: 'Screener', icon: '🔍' },
  ];

  // Mock options chain fetch (would be real API in production)
  const fetchOptionsChain = async (symbol, type) => {
    // In production: fetch from Yahoo Finance or IB API
    // For now, return mock data based on symbol
    const mockChains = {
      AAPL: generateMockChain('AAPL', 312.50, type),
      NVDA: generateMockChain('NVDA', 395.00, type),
      TSLA: generateMockChain('TSLA', 240.00, type),
      AMD: generateMockChain('AMD', 148.00, type),
    };
    return mockChains[symbol] || [];
  };

  const handleAnalyze = async () => {
    if (!selectedSymbol) return;

    setLoading(true);

    try {
      const chain = await fetchOptionsChain(selectedSymbol, activeTab === 'csp' ? 'PUT' : 'CALL');

      if (activeTab === 'csp') {
        const result = findCSPSetup({
          symbol: selectedSymbol,
          underlyingPrice: getMockPrice(selectedSymbol),
          availableCash: portfolioSummary?.cashBalance || 50000,
          regime,
          optionsChain: chain,
          supportLevels: [300, 290, 280], // Would come from technical analysis
          existingPositions: positions
        });
        setAnalysisResult(result);
      } else if (activeTab === 'cc') {
        const stockPos = positions.find(p => p.symbol === selectedSymbol && p.assetClass === 'STOCK');
        const result = findCCSetup({
          symbol: selectedSymbol,
          sharesOwned: stockPos?.netQuantity || 0,
          costBasis: stockPos?.avgCost || getMockPrice(selectedSymbol),
          underlyingPrice: getMockPrice(selectedSymbol),
          regime,
          optionsChain: chain,
          resistanceLevels: [320, 330, 340],
          existingPositions: positions
        });
        setAnalysisResult(result);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-slate-950 rounded-xl border border-slate-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h2 className="text-lg font-bold text-white">Options Advisor</h2>
              <p className="text-slate-500 text-xs">KI-basierte Strategie-Empfehlungen</p>
            </div>
          </div>
          <RegimeBadge regime={regime} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setAnalysisResult(null); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2
              ${activeTab === tab.id 
                ? 'text-white border-blue-500 bg-slate-800/50' 
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Symbol Input */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1">
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2">Symbol</label>
            <input
              type="text"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
              placeholder="z.B. AAPL"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white 
                placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors uppercase"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={!selectedSymbol || loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500
                text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Analysiere...
                </>
              ) : (
                <>🔍 Analysieren</>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'csp' && analysisResult && (
          <CSPSetupCard result={analysisResult} />
        )}

        {activeTab === 'cc' && analysisResult && (
          <CCSetupCard result={analysisResult} />
        )}

        {activeTab === 'wheel' && (
          <WheelTrackerPanel 
            positions={positions} 
            trades={trades}
            onSelectSymbol={setSelectedSymbol}
          />
        )}

        {activeTab === 'screener' && (
          <OptionsScreener regime={regime} positions={positions} />
        )}

        {!analysisResult && activeTab !== 'wheel' && activeTab !== 'screener' && (
          <div className="text-center py-12">
            <span className="text-4xl mb-3 block">🎯</span>
            <p className="text-slate-400">Gib ein Symbol ein und klicke "Analysieren"</p>
            <p className="text-slate-500 text-sm mt-1">Der Advisor findet das optimale Setup basierend auf Regime und Options-Chain</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RegimeBadge({ regime }) {
  const colors = {
    BULL_QUIET: 'bg-emerald-500/20 text-emerald-400',
    BULL_VOLATILE: 'bg-amber-500/20 text-amber-400',
    BEAR_QUIET: 'bg-orange-500/20 text-orange-400',
    BEAR_VOLATILE: 'bg-red-500/20 text-red-400',
    CRISIS: 'bg-red-700/20 text-red-400'
  };
  return (
    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${colors[regime] || colors.BULL_QUIET}`}>
      {regime?.replace('_', ' ')}
    </span>
  );
}

// Mock helpers
function getMockPrice(symbol) {
  const prices = { AAPL: 312.50, NVDA: 395.00, TSLA: 240.00, AMD: 148.00, JPM: 165.00 };
  return prices[symbol] || 100;
}

function generateMockChain(symbol, price, type) {
  const chain = [];
  const strikes = type === 'PUT' 
    ? [price * 0.75, price * 0.80, price * 0.85, price * 0.90, price * 0.95, price]
    : [price, price * 1.05, price * 1.10, price * 1.15, price * 1.20, price * 1.25];

  const expiries = ['2026-08-21', '2026-09-18', '2026-10-16'];

  strikes.forEach((strike, i) => {
    expiries.forEach(expiry => {
      const iv = 0.25 + Math.random() * 0.20;
      const premium = type === 'PUT' 
        ? Math.max(0.50, (strike - price * 0.95) * 0.3 + Math.random() * 2)
        : Math.max(0.50, (price * 1.05 - strike) * 0.3 + Math.random() * 2);

      chain.push({
        strike: Math.round(strike),
        bid: Math.max(0.01, premium - 0.10),
        ask: premium + 0.10,
        expiry,
        impliedVolatility: iv,
        openInterest: Math.floor(Math.random() * 5000) + 100
      });
    });
  });

  return chain;
}

function OptionsScreener({ regime, positions }) {
  const symbols = ['AAPL', 'NVDA', 'TSLA', 'AMD', 'MSFT', 'JPM'];
  const existingSymbols = new Set(positions.map(p => p.underlying || p.symbol));

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Top Opportunities basierend auf Regime: <span className="text-white font-medium">{regime}</span></p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {symbols.filter(s => !existingSymbols.has(s)).map(symbol => (
          <div key={symbol} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold">{symbol}</span>
              <span className="text-emerald-400 text-xs">✓ Verfügbar</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Preis</span>
                <p className="text-white font-mono">${getMockPrice(symbol)}</p>
              </div>
              <div>
                <span className="text-slate-500">IV-Rank</span>
                <p className="text-white font-mono">{Math.floor(Math.random() * 60 + 20)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
