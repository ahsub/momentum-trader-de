import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeJournalStore } from '../stores/tradeJournalStore';

describe('Trade Journal Store', () => {
  beforeEach(() => {
    useTradeJournalStore.setState({
      entries: [],
      filters: { setupType: null, tag: null, dateFrom: null, dateTo: null, status: null },
    });
  });

  describe('addEntry', () => {
    it('fuegt einen neuen Journal-Eintrag hinzu', () => {
      const store = useTradeJournalStore.getState();
      const id = store.addEntry({
        symbol: 'AAPL',
        optionType: 'call',
        strike: 180,
        expiration: '2026-08-15',
        quantity: 2,
        entryPrice: 3.50,
        setupType: 'long_call',
        entryDate: '2026-07-20',
      });

      expect(id).toBeDefined();
      // Re-read state after addEntry (zustand getState() returns snapshot)
      const updatedStore = useTradeJournalStore.getState();
      expect(updatedStore.entries).toHaveLength(1);
      expect(updatedStore.entries[0].symbol).toBe('AAPL');
      expect(updatedStore.entries[0].status).toBe('open');
    });

    it('generiert eine eindeutige ID', () => {
      const store = useTradeJournalStore.getState();
      const id1 = store.addEntry({ symbol: 'AAPL', entryPrice: 1, quantity: 1, entryDate: '2026-07-20' });
      const id2 = store.addEntry({ symbol: 'TSLA', entryPrice: 1, quantity: 1, entryDate: '2026-07-20' });
      expect(id1).not.toBe(id2);
    });
  });

  describe('closeTrade', () => {
    it('schliesst einen Trade und berechnet P&L', () => {
      const store = useTradeJournalStore.getState();
      const id = store.addEntry({
        symbol: 'AAPL',
        optionType: 'call',
        strike: 180,
        expiration: '2026-08-15',
        quantity: 1,
        entryPrice: 3.00,
        setupType: 'long_call',
        entryDate: '2026-07-20',
      });

      store.closeTrade(id, {
        exitPrice: 5.00,
        exitDate: '2026-07-25',
        exitReason: 'target_hit',
      });

      // Re-read state after mutation (zustand getState() returns snapshot)
      const updatedStore = useTradeJournalStore.getState();
      const entry = updatedStore.entries.find(e => e.id === id);
      expect(entry.status).toBe('closed');
      expect(entry.exitPrice).toBe(5.00);
      expect(entry.pnl).toBe(200);
      expect(entry.pnlPercent).toBeCloseTo(66.67, 1);
      expect(entry.holdingDays).toBe(5);
    });

    it('berechnet Verlust korrekt', () => {
      const store = useTradeJournalStore.getState();
      const id = store.addEntry({
        symbol: 'TSLA',
        optionType: 'put',
        strike: 200,
        expiration: '2026-08-15',
        quantity: -1,
        entryPrice: 4.00,
        setupType: 'csp',
        entryDate: '2026-07-20',
      });

      store.closeTrade(id, {
        exitPrice: 6.00,
        exitDate: '2026-07-22',
        exitReason: 'stop_loss',
      });

      const entry = store.entries.find(e => e.id === id);
      expect(entry.pnl).toBe(-200);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('berechnet Win Rate korrekt', () => {
      const store = useTradeJournalStore.getState();
      
      const id1 = store.addEntry({ symbol: 'A', entryPrice: 1, quantity: 1, entryDate: '2026-07-01' });
      const id2 = store.addEntry({ symbol: 'B', entryPrice: 1, quantity: 1, entryDate: '2026-07-02' });
      const id3 = store.addEntry({ symbol: 'C', entryPrice: 1, quantity: 1, entryDate: '2026-07-03' });
      const id4 = store.addEntry({ symbol: 'D', entryPrice: 1, quantity: 1, entryDate: '2026-07-04' });

      store.closeTrade(id1, { exitPrice: 2, exitDate: '2026-07-05' });
      store.closeTrade(id2, { exitPrice: 2, exitDate: '2026-07-06' });
      store.closeTrade(id3, { exitPrice: 2, exitDate: '2026-07-07' });
      store.closeTrade(id4, { exitPrice: 0.5, exitDate: '2026-07-08' });

      const metrics = store.getPerformanceMetrics();
      expect(metrics.totalTrades).toBe(4);
      expect(metrics.winRate).toBe(75);
      expect(metrics.totalPnl).toBe(250);
    });

    it('berechnet Profit Factor korrekt', () => {
      const store = useTradeJournalStore.getState();
      
      const id1 = store.addEntry({ symbol: 'A', entryPrice: 2, quantity: 1, entryDate: '2026-07-01' });
      const id2 = store.addEntry({ symbol: 'B', entryPrice: 2, quantity: 1, entryDate: '2026-07-02' });

      store.closeTrade(id1, { exitPrice: 5, exitDate: '2026-07-05' });
      store.closeTrade(id2, { exitPrice: 1, exitDate: '2026-07-06' });

      const metrics = store.getPerformanceMetrics();
      expect(metrics.profitFactor).toBe(3);
    });

    it('gibt leere Metriken zurueck wenn keine Trades', () => {
      const store = useTradeJournalStore.getState();
      const metrics = store.getPerformanceMetrics();
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
    });
  });

  describe('filters', () => {
    it('filtert nach Setup-Type', () => {
      const store = useTradeJournalStore.getState();
      store.addEntry({ symbol: 'A', setupType: 'csp', entryPrice: 1, quantity: 1, entryDate: '2026-07-01' });
      store.addEntry({ symbol: 'B', setupType: 'cc', entryPrice: 1, quantity: 1, entryDate: '2026-07-01' });

      store.setFilter('setupType', 'csp');
      const filtered = store.getFilteredEntries();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('A');
    });

    it('filtert nach Status', () => {
      const store = useTradeJournalStore.getState();
      const id1 = store.addEntry({ symbol: 'A', entryPrice: 1, quantity: 1, entryDate: '2026-07-01' });
      store.addEntry({ symbol: 'B', entryPrice: 1, quantity: 1, entryDate: '2026-07-02' });

      store.closeTrade(id1, { exitPrice: 2, exitDate: '2026-07-05' });

      store.setFilter('status', 'closed');
      const filtered = store.getFilteredEntries();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe('closed');
    });

    it('loescht Filter korrekt', () => {
      const store = useTradeJournalStore.getState();
      store.addEntry({ symbol: 'A', setupType: 'csp', entryPrice: 1, quantity: 1, entryDate: '2026-07-01' });
      store.addEntry({ symbol: 'B', setupType: 'cc', entryPrice: 1, quantity: 1, entryDate: '2026-07-01' });

      store.setFilter('setupType', 'csp');
      store.clearFilters();
      const filtered = store.getFilteredEntries();
      expect(filtered).toHaveLength(2);
    });
  });

  describe('getSetupStats', () => {
    it('aggregiert Statistiken pro Setup', () => {
      const store = useTradeJournalStore.getState();
      
      const id1 = store.addEntry({ symbol: 'A', setupType: 'csp', entryPrice: 2, quantity: 1, entryDate: '2026-07-01' });
      const id2 = store.addEntry({ symbol: 'B', setupType: 'csp', entryPrice: 2, quantity: 1, entryDate: '2026-07-02' });
      const id3 = store.addEntry({ symbol: 'C', setupType: 'cc', entryPrice: 2, quantity: 1, entryDate: '2026-07-03' });

      store.closeTrade(id1, { exitPrice: 3, exitDate: '2026-07-05' });
      store.closeTrade(id2, { exitPrice: 1, exitDate: '2026-07-06' });
      store.closeTrade(id3, { exitPrice: 4, exitDate: '2026-07-07' });

      const stats = store.getSetupStats();
      expect(stats.csp.count).toBe(2);
      expect(stats.csp.winRate).toBe(50);
      expect(stats.csp.totalPnl).toBe(0);
      expect(stats.cc.count).toBe(1);
      expect(stats.cc.winRate).toBe(100);
      expect(stats.cc.totalPnl).toBe(200);
    });
  });
});
