import { useState, useEffect } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useSnapshotReader } from '../hooks/useSnapshotReader';
import { findCSPSetup, analyzeCSPRoll } from '../utils/cspAdvisor';
import { findCCSetup, analyzeCCRoll } from '../utils/ccAdvisor';
import { analyzeWheelStage, calculateWheelPnL } from '../utils/wheelTracker';
import { fetchOptionsChain, findATMOption, getMidPrice, calculateAnnualizedYield } from '../services/optionsChainService';
import CSPSetupCard from './CSPSetupCard';
import CCSetupCard from './CCSetupCard';
import WheelTrackerPanel from './WheelTrackerPanel';

/**
 * Options Advisor Panel - Phase 8.1: Real-time Options Chain Integration
 * Integrates CSP, CC, and Wheel strategy advisors with live Alpha Vantage data
 */
export default function OptionsAdvisorPanel({ className = '' }) {
  const [activeTab, setActiveTab] = useState('csp');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [optionsChain, setOptionsChain] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { positions, trades, portfolioSummary } = usePortfolioStore();
  const { regime, snapshot } = useSnapshotReader();

  const tabs = [
    { id: 'csp', label: 'Cash Secured Put', icon: '🛡️' },
    { id: 'cc', label: 'Covered Call', icon: '📞' },
    { id: 'wheel', label: 'Wheel Tracker', icon: '♻️' },
    { id: 'screener', label: 'Screener', icon: '🔍' },
  ];

  // Fetch real options chain from Alpha Vantage
  const loadOptionsChain = async (symbol) => {
    if (!symbol) return;

    setLoading(true);
    setError(null);

    try {
      const chain = await fetchOptionsChain(symbol);
      setOptionsChain(chain);
      setLastUpdated(new Date().toLocaleTimeString());
      return chain;
    } catch (err) {
      console.error('[OptionsAdvisor] Fehler beim Laden der Chain:', err);
      setError('Fehler beim Laden der Options-Chain. Mock-Daten werden verwendet.');
      // Mock-Daten als Fallback
      const mockChain = generateMockChain(symbol);
      setOptionsChain(mockChain);
      return mockChain;
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedSymbol) return;

    setLoading(true);
    setError(null);

    try {
      // Lade echte Options-Chain
      const chain = await loadOptionsChain(selectedSymbol);

      // Hole aktuellen Kurs (aus der Chain oder Fallback)
      const underlyingPrice = chain.calls[Math.floor(chain.calls.length / 2)]?.strike || getMockPrice(selectedSymbol);

      if (activeTab === 'csp') {
        // Finde ATM Put für Ludwig-Strategie
        const atmPut = findATMOption(chain.puts, underlyingPrice);
        const dte = Math.ceil((new Date(atmPut?.expiration || Date.now() + 30*24*60*60*1000) - new Date()) / (1000 * 60 * 60 * 24));

        const result = findCSPSetup({
          symbol: selectedSymbol,
          underlyingPrice,
          availableCash: portfolioSummary?.cashBalance || 50000,
          regime,
          optionsChain: chain.puts,
          atmOption: atmPut,
          annualizedYield: atmPut ? calculateAnnualizedYield(atmPut, dte) : null,
          supportLevels: [underlyingPrice * 0.95, underlyingPrice * 0.90, underlyingPrice * 0.85],
          existingPositions: positions
        });
        setAnalysisResult(result);

      } else if (activeTab === 'cc') {
        const stockPos = positions.find(p => p.symbol === selectedSymbol && p.assetClass === 'STOCK');
        const atmCall = findATMOption(chain.calls, underlyingPrice);

        const result = findCCSetup({
          symbol: selectedSymbol,
          sharesOwned: stockPos?.netQuantity || 0,
          costBasis: stockPos?.avgCost || underlyingPrice,
          underlyingPrice,
          regime,
          optionsChain: chain.calls,
          atmOption: atmCall,
          resistanceLevels: [underlyingPrice * 1.05, underlyingPrice * 1.10, underlyingPrice * 1.15],
          existingPositions: positions
        });
        setAnalysisResult(result);
      }
    } catch (err) {
      console.error('[OptionsAdvisor] Analyse-Fehler:', err);
      setError('Analyse-Fehler: ' + err.message);
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
              <p className="text-slate-500 text-xs">Echtzeit-Options-Chain • Alpha Vantage API</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-slate-500">🕐 {lastUpdated}</span>
            )}
            <RegimeBadge regime={regime} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setAnalysisResult(null); setError(null); }}
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
                  Lade Chain...
                </>
              ) : (
                <>🔍 Analysieren</>
              )}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Chain Info */}
        {optionsChain && !loading && (
          <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                📊 <span className="text-white font-medium">{optionsChain.symbol}</span> • 
                {optionsChain.calls.length} Calls • {optionsChain.puts.length} Puts • 
                {optionsChain.expirations?.length || 0} Expirations
              </span>
              <span className="text-slate-500 text-xs">
                {optionsChain.timestamp ? new Date(optionsChain.timestamp).toLocaleString() : 'Mock-Daten'}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        {activeTab === 'csp' && analysisResult && (
          <CSPSetupCard result={analysisResult} chain={optionsChain} />
        )}

        {activeTab === 'cc' && analysisResult && (
          <CCSetupCard result={analysisResult} chain={optionsChain} />
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
            <p className="text-slate-500 text-sm mt-1">Der Advisor lädt echte Options-Chain-Daten von Alpha Vantage</p>
            <p className="text-slate-600 text-xs mt-2">Unterstützt: AAPL, MSFT, GOOGL, AMZN, TSLA, META, NVDA, JPM, JNJ, V, PG, KO, WMT</p>
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

// Mock helpers (Fallback)
function getMockPrice(symbol) {
  const prices = {
    'AAPL': 175, 'MSFT': 330, 'GOOGL': 140, 'AMZN': 130,
    'TSLA': 250, 'META': 300, 'NVDA': 460, 'JPM': 150,
    'JNJ': 155, 'V': 240, 'PG': 145, 'UNH': 480,
    'HD': 310, 'MA': 410, 'BAC': 37, 'ABBV': 165,
    'PFE': 28, 'KO': 60, 'PEP': 165, 'WMT': 60
  };
  return prices[symbol.toUpperCase()] || 100;
}

function generateMockChain(symbol) {
  const basePrice = getMockPrice(symbol);
  const expirations = [];
  const today = new Date();

  for (let i = 0; i < 4; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    let fridays = 0;
    for (let d = 1; d <= 31; d++) {
      const checkDate = new Date(date.getFullYear(), date.getMonth(), d);
      if (checkDate.getDay() === 5) {
        fridays++;
        if (fridays === 3) {
          expirations.push(checkDate.toISOString().split('T')[0]);
          break;
        }
      }
    }
  }

  const calls = [];
  const puts = [];

  expirations.forEach(exp => {
    const dte = Math.ceil((new Date(exp) - new Date()) / (1000 * 60 * 60 * 24));

    for (let i = -10; i <= 10; i++) {
      const strike = Math.round((basePrice + i * (basePrice * 0.02)) * 100) / 100;

      const callIV = 0.20 + Math.random() * 0.15;
      const callDistance = strike - basePrice;
      const callPremium = Math.max(0.01, 
        Math.exp(-callDistance / (basePrice * 0.3)) * basePrice * callIV * Math.sqrt(dte / 365) / 10
      );

      calls.push({
        symbol, contractId: `${symbol}${exp.replace(/-/g, '')}C${String(Math.round(strike * 1000)).padStart(8, '0')}`,
        expiration: exp, strike, type: 'call',
        lastPrice: Math.round(callPremium * 100) / 100,
        bid: Math.round((callPremium * 0.95) * 100) / 100,
        ask: Math.round((callPremium * 1.05) * 100) / 100,
        mark: Math.round(callPremium * 100) / 100,
        volume: Math.floor(Math.random() * 1000),
        openInterest: Math.floor(Math.random() * 5000),
        impliedVolatility: Math.round(callIV * 100) / 100,
        delta: Math.round((0.5 + (callDistance < 0 ? 0.3 : -0.3) * Math.random()) * 100) / 100,
        inTheMoney: strike < basePrice
      });

      const putIV = 0.22 + Math.random() * 0.15;
      const putDistance = basePrice - strike;
      const putPremium = Math.max(0.01,
        Math.exp(-putDistance / (basePrice * 0.3)) * basePrice * putIV * Math.sqrt(dte / 365) / 10
      );

      puts.push({
        symbol, contractId: `${symbol}${exp.replace(/-/g, '')}P${String(Math.round(strike * 1000)).padStart(8, '0')}`,
        expiration: exp, strike, type: 'put',
        lastPrice: Math.round(putPremium * 100) / 100,
        bid: Math.round((putPremium * 0.95) * 100) / 100,
        ask: Math.round((putPremium * 1.05) * 100) / 100,
        mark: Math.round(putPremium * 100) / 100,
        volume: Math.floor(Math.random() * 1000),
        openInterest: Math.floor(Math.random() * 5000),
        impliedVolatility: Math.round(putIV * 100) / 100,
        delta: Math.round((-0.5 + (putDistance < 0 ? 0.3 : -0.3) * Math.random()) * 100) / 100,
        inTheMoney: strike > basePrice
      });
    }
  });

  return {
    symbol, timestamp: new Date().toISOString(),
    calls: calls.sort((a, b) => a.strike - b.strike),
    puts: puts.sort((a, b) => a.strike - b.strike),
    expirations
  };
}

function OptionsScreener({ regime, positions }) {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'KO', 'WMT'];
  const activeSymbols = new Set(positions.map(p => p.symbol));

  const available = symbols.filter(s => !activeSymbols.has(s));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">🔍 Options Screener</h3>
        <span className="text-slate-400 text-sm">{available.length} Symbole verfügbar</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {available.map(symbol => (
          <div key={symbol} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold">{symbol}</span>
              <span className="text-xs text-slate-500">Keine aktive Position</span>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">CSP</span>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">CC</span>
            </div>
          </div>
        ))}
      </div>

      {available.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          Alle verfügbaren Symbole haben aktive Positionen
        </div>
      )}
    </div>
  );
}
