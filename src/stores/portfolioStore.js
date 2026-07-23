import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Portfolio Store - Central state for all portfolio data
 * Persists in localStorage (client-side only, no server)
 */
export const usePortfolioStore = create(
  persist(
    (set, get) => ({
      // Raw data
      trades: [],
      positions: [],

      // Computed
      portfolioSummary: null,

      // KI Output
      recommendations: [],
      alerts: [],

      // UI State
      importStatus: 'idle', // idle | importing | success | error
      importError: null,
      selectedPosition: null,

      // Actions
      setTrades: (trades) => {
        set({ trades });
        get().recalculatePositions();
      },

      addTrades: (newTrades) => {
        const current = get().trades;
        set({ trades: [...current, ...newTrades] });
        get().recalculatePositions();
      },

      clearTrades: () => {
        set({ trades: [], positions: [], portfolioSummary: null, recommendations: [] });
      },

      setPositions: (positions, summary) => {
        set({ positions, portfolioSummary: summary });
      },

      recalculatePositions: () => {
        // This will be called after trade import
        // Actual calculation happens in the engine, not here
        const { trades } = get();
        // Trigger recalculation via hook or component
      },

      setRecommendations: (recommendations) => {
        set({ recommendations });
      },

      setAlerts: (alerts) => {
        set({ alerts });
      },

      setImportStatus: (status, error = null) => {
        set({ importStatus: status, importError: error });
      },

      selectPosition: (position) => {
        set({ selectedPosition: position });
      },

      // Getters
      getOpenPositions: () => get().positions.filter(p => p.isOpen),
      getClosedPositions: () => get().positions.filter(p => !p.isOpen),
      getPositionBySymbol: (symbol) => get().positions.find(p => p.underlying === symbol || p.symbol === symbol),

      // Stats
      getTradeCount: () => get().trades.length,
      getOpenPositionCount: () => get().positions.filter(p => p.isOpen).length,
    }),
    {
      name: 'momentum-trader-portfolio',
      partialize: (state) => ({
        trades: state.trades,
        positions: state.positions,
        portfolioSummary: state.portfolioSummary
      })
    }
  )
);
