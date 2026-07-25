/**
 * 
 */
cat > src/stores/portfolioStore.js << 'EOF'
/**
 * Enhanced Portfolio Store — mit Paper-Trading Support
 * Phase 8.5 — momentum-trader-de
 * 
 * Erweitert den bestehenden portfolioStore um:
 * - isPaper Flag pro Position
 * - Paper-Portfolio separat verwaltet
 * - Toggle zwischen Live und Paper
 * - Paper-Trades persistieren im localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function generatePaperId() {
  return `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculatePnL(position, currentPrice) {
  const multiplier = 100;
  const entry = position.entryPrice * position.quantity * multiplier;
  const current = currentPrice * position.quantity * multiplier;
  const pnl = current - entry;
  const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
  return { pnl, pnlPercent };
}

export const usePortfolioStore = create(
  persist(
    (set, get) => ({
      isPaperMode: false,
      livePositions: [],
      paperPositions: [],
      
      togglePaperMode: () => {
        set(state => ({ isPaperMode: !state.isPaperMode }));
      },
      
      setPaperMode: (mode) => {
        set({ isPaperMode: mode });
      },
      
      getPositions: () => {
        const { isPaperMode, livePositions, paperPositions } = get();
        return isPaperMode ? paperPositions : livePositions;
      },
      
      setLivePositions: (positions) => {
        set({ livePositions: positions });
      },
      
      addLivePosition: (position) => {
        set(state => ({
          livePositions: [...state.livePositions, { ...position, isPaper: false }],
        }));
      },
      
      updateLivePosition: (id, updates) => {
        set(state => ({
          livePositions: state.livePositions.map(pos =>
            pos.id === id ? { ...pos, ...updates } : pos
          ),
        }));
      },
      
      removeLivePosition: (id) => {
        set(state => ({
          livePositions: state.livePositions.filter(pos => pos.id !== id),
        }));
      },
      
      addPaperPosition: (position) => {
        const paperPosition = {
          ...position,
          id: position.id || generatePaperId(),
          isPaper: true,
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          paperPositions: [...state.paperPositions, paperPosition],
        }));
        return paperPosition.id;
      },
      
      updatePaperPosition: (id, updates) => {
        set(state => ({
          paperPositions: state.paperPositions.map(pos =>
            pos.id === id ? { ...pos, ...updates } : pos
          ),
        }));
      },
      
      removePaperPosition: (id) => {
        set(state => ({
          paperPositions: state.paperPositions.filter(pos => pos.id !== id),
        }));
      },
      
      closePaperPosition: (id, exitPrice, exitDate = new Date().toISOString()) => {
        set(state => ({
          paperPositions: state.paperPositions.map(pos =>
            pos.id === id
              ? { ...pos, exitPrice, exitDate, status: 'closed', isOpen: false }
              : pos
          ),
        }));
      },
      
      simulateTrade: (tradeData) => {
        const { symbol, optionType, strike, expiration, quantity, entryPrice, underlyingPrice, strategy } = tradeData;
        
        const position = {
          id: generatePaperId(),
          symbol,
          optionType,
          strike,
          expiration,
          quantity,
          entryPrice,
          currentPrice: entryPrice,
          underlyingPrice,
          strategy: strategy || 'manual',
          status: 'open',
          isOpen: true,
          isPaper: true,
          createdAt: new Date().toISOString(),
          greeks: null,
        };
        
        set(state => ({
          paperPositions: [...state.paperPositions, position],
        }));
        
        return position;
      },
      
      getPortfolioMetrics: () => {
        const positions = get().getPositions();
        const openPositions = positions.filter(p => p.isOpen !== false);
        
        const totalPnl = openPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
        const totalValue = openPositions.reduce((sum, pos) => {
          const multiplier = 100;
          return sum + (pos.currentPrice || pos.entryPrice) * Math.abs(pos.quantity) * multiplier;
        }, 0);
        
        const winners = openPositions.filter(p => (p.pnl || 0) > 0).length;
        const losers = openPositions.filter(p => (p.pnl || 0) < 0).length;
        const winRate = openPositions.length > 0 ? (winners / openPositions.length) * 100 : 0;
        
        return {
          totalPositions: openPositions.length,
          totalPnl,
          totalValue,
          winRate,
          winners,
          losers,
          isPaperMode: get().isPaperMode,
        };
      },
      
      resetPaperPortfolio: () => {
        set({ paperPositions: [] });
      },
      
      exportPaperTrades: () => {
        return JSON.stringify(get().paperPositions, null, 2);
      },
      
      importPaperTrades: (jsonString) => {
        try {
          const trades = JSON.parse(jsonString);
          set({ paperPositions: trades });
          return true;
        } catch (e) {
          console.error('Failed to import paper trades:', e);
          return false;
        }
      },
    }),
    {
      name: 'momentum-trader-portfolio',
      partialize: (state) => ({
        isPaperMode: state.isPaperMode,
        paperPositions: state.paperPositions,
      }),
    }
  )
);

export default usePortfolioStore;
