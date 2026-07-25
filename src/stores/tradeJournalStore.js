/**
 * Trade Journal Store — v2.1.0
 * momentum-trader-de
 * 
 * Verwaltet Trade-Journal-Einträge mit:
 * - Setup-Typ, Entry/Exit, Management-Notizen, Tags
 * - Performance-Metriken (Win Rate, Expectancy, Drawdown)
 * - Integration mit Portfolio-Positionen
 */

import { create } from 'zustand';

export const SETUP_TYPES = [
  { id: 'csp', label: 'Cash-Secured Put', category: 'income' },
  { id: 'cc', label: 'Covered Call', category: 'income' },
  { id: 'wheel', label: 'Wheel Strategy', category: 'income' },
  { id: 'long_call', label: 'Long Call', category: 'directional' },
  { id: 'long_put', label: 'Long Put', category: 'directional' },
  { id: 'spread', label: 'Vertical Spread', category: 'spread' },
  { id: 'iron_condor', label: 'Iron Condor', category: 'spread' },
  { id: 'straddle', label: 'Straddle', category: 'volatility' },
  { id: 'strangle', label: 'Strangle', category: 'volatility' },
  { id: 'custom', label: 'Custom', category: 'other' },
];

export const TAGS = [
  'earnings_play',
  'technical_setup',
  'fundamental',
  'high_iv',
  'low_iv',
  'trend_following',
  'mean_reversion',
  'hedge',
  'speculation',
  'dividend_capture',
];

export const EXIT_REASONS = [
  'target_hit',
  'stop_loss',
  'time_decay',
  'volatility_crush',
  'earnings_exit',
  'manual_close',
  'roll_forward',
  'assignment',
  'max_loss',
  'profit_taking',
];

function generateJournalId() {
  return `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useTradeJournalStore = create((set, get) => ({
      entries: [],
      filters: {
        setupType: null,
        tag: null,
        dateFrom: null,
        dateTo: null,
        status: null,
      },
      
      addEntry: (entryData) => {
        const entry = {
          id: generateJournalId(),
          ...entryData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        set(state => ({
          entries: [entry, ...state.entries],
        }));
        
        return entry.id;
      },
      
      updateEntry: (id, updates) => {
        const current = get().entries;
        set({
          entries: current.map(entry =>
            entry.id === id
              ? { ...entry, ...updates, updatedAt: new Date().toISOString() }
              : entry
          ),
        });
      },
      
      removeEntry: (id) => {
        const current = get().entries;
        set({ entries: current.filter(entry => entry.id !== id) });
      },
      
      linkPosition: (journalId, positionId) => {
        const current = get().entries;
        set({
          entries: current.map(entry =>
            entry.id === journalId
              ? { ...entry, linkedPositionId: positionId, updatedAt: new Date().toISOString() }
              : entry
          ),
        });
      },
      
      closeTrade: (id, exitData) => {
        const { exitPrice, exitDate, exitReason, notes } = exitData;
        
        set(state => {
          const entry = state.entries.find(e => e.id === id);
          if (!entry) return state;
          
          const multiplier = 100;
          const entryValue = entry.entryPrice * entry.quantity * multiplier;
          const exitValue = exitPrice * entry.quantity * multiplier;
          const pnl = exitValue - entryValue;
          const pnlPercent = ((exitPrice - entry.entryPrice) / entry.entryPrice) * 100;
          const holdingDays = Math.max(1, Math.ceil(
            (new Date(exitDate) - new Date(entry.entryDate)) / (1000 * 60 * 60 * 24)
          ));
          
          return {
            entries: state.entries.map(e =>
              e.id === id
                ? {
                    ...e,
                    exitPrice,
                    exitDate,
                    exitReason,
                    exitNotes: notes,
                    pnl,
                    pnlPercent,
                    holdingDays,
                    status: 'closed',
                    updatedAt: new Date().toISOString(),
                  }
                : e
            ),
          };
        });
      },
      
      setFilter: (key, value) => {
        set(state => ({
          filters: { ...state.filters, [key]: value },
        }));
      },
      
      clearFilters: () => {
        set({
          filters: {
            setupType: null,
            tag: null,
            dateFrom: null,
            dateTo: null,
            status: null,
          },
        });
      },
      
      getFilteredEntries: () => {
        const { entries, filters } = get();
        
        return entries.filter(entry => {
          if (filters.setupType && entry.setupType !== filters.setupType) return false;
          if (filters.tag && !entry.tags?.includes(filters.tag)) return false;
          if (filters.dateFrom && new Date(entry.entryDate) < new Date(filters.dateFrom)) return false;
          if (filters.dateTo && new Date(entry.entryDate) > new Date(filters.dateTo)) return false;
          if (filters.status && filters.status !== 'all' && entry.status !== filters.status) return false;
          return true;
        });
      },
      
      getPerformanceMetrics: () => {
        const entries = get().entries.filter(e => e.status === 'closed');
        
        if (entries.length === 0) {
          return {
            totalTrades: 0,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            profitFactor: 0,
            expectancy: 0,
            maxDrawdown: 0,
            avgHoldingDays: 0,
            totalPnl: 0,
            bestTrade: null,
            worstTrade: null,
          };
        }
        
        const winners = entries.filter(e => e.pnl > 0);
        const losers = entries.filter(e => e.pnl <= 0);
        
        const totalPnl = entries.reduce((sum, e) => sum + e.pnl, 0);
        const winRate = (winners.length / entries.length) * 100;
        
        const avgWin = winners.length > 0
          ? winners.reduce((sum, e) => sum + e.pnl, 0) / winners.length
          : 0;
        
        const avgLoss = losers.length > 0
          ? losers.reduce((sum, e) => sum + e.pnl, 0) / losers.length
          : 0;
        
        const grossProfit = winners.reduce((sum, e) => sum + e.pnl, 0);
        const grossLoss = Math.abs(losers.reduce((sum, e) => sum + e.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
        
        const winProbability = winners.length / entries.length;
        const lossProbability = losers.length / entries.length;
        const expectancy = (winProbability * avgWin) + (lossProbability * avgLoss);
        
        let maxDrawdown = 0;
        let peak = 0;
        let runningPnl = 0;
        entries.forEach(e => {
          runningPnl += e.pnl;
          if (runningPnl > peak) peak = runningPnl;
          const drawdown = peak - runningPnl;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });
        
        const avgHoldingDays = entries.reduce((sum, e) => sum + (e.holdingDays || 0), 0) / entries.length;
        
        const sortedByPnl = [...entries].sort((a, b) => b.pnl - a.pnl);
        
        return {
          totalTrades: entries.length,
          winRate: parseFloat(winRate.toFixed(2)),
          avgWin: parseFloat(avgWin.toFixed(2)),
          avgLoss: parseFloat(avgLoss.toFixed(2)),
          profitFactor: parseFloat(profitFactor.toFixed(2)),
          expectancy: parseFloat(expectancy.toFixed(2)),
          maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
          avgHoldingDays: parseFloat(avgHoldingDays.toFixed(1)),
          totalPnl: parseFloat(totalPnl.toFixed(2)),
          bestTrade: sortedByPnl[0] || null,
          worstTrade: sortedByPnl[sortedByPnl.length - 1] || null,
        };
      },
      
      getSetupStats: () => {
        const entries = get().entries.filter(e => e.status === 'closed');
        const stats = {};
        
        entries.forEach(entry => {
          const setup = entry.setupType || 'unknown';
          if (!stats[setup]) {
            stats[setup] = { count: 0, wins: 0, totalPnl: 0, avgPnl: 0 };
          }
          stats[setup].count++;
          if (entry.pnl > 0) stats[setup].wins++;
          stats[setup].totalPnl += entry.pnl;
        });
        
        Object.keys(stats).forEach(key => {
          stats[key].winRate = (stats[key].wins / stats[key].count) * 100;
          stats[key].avgPnl = stats[key].totalPnl / stats[key].count;
        });
        
        return stats;
      },
      
      exportJournal: () => {
        return JSON.stringify(get().entries, null, 2);
      },
      
      importJournal: (jsonString) => {
        try {
          const entries = JSON.parse(jsonString);
          set({ entries });
          return true;
        } catch (e) {
          console.error('Failed to import journal:', e);
          return false;
        }
      },
      
      resetJournal: () => {
        set({ entries: [], filters: { setupType: null, tag: null, dateFrom: null, dateTo: null, status: null } });
      },

}));

// Manual persistence for production (not in tests)
if (typeof window !== 'undefined') {
  const STORAGE_KEY = 'momentum-trader-journal';

  // Load from localStorage on init
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data && data.entries) {
        useTradeJournalStore.setState({ entries: data.entries });
      }
    }
  } catch (e) {
    // ignore
  }

  // Save to localStorage on changes
  useTradeJournalStore.subscribe((state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: state.entries }));
    } catch (e) {
      // ignore
    }
  });
}

export default useTradeJournalStore;
