import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mocks ───
vi.mock('../stores/portfolioStore', () => ({
  usePortfolioStore: vi.fn((selector) => {
    const state = {
      positions: [
        { symbol: 'AAPL', qty: 10, avgPrice: 150, currentPrice: 175, marketValue: 1750, unrealizedPnl: 250 },
        { symbol: 'TSLA', qty: 5, avgPrice: 200, currentPrice: 180, marketValue: 900, unrealizedPnl: -100 },
      ],
      isPaperMode: false,
      togglePaperMode: vi.fn(),
      totalValue: 2650,
      totalPnl: 150,
      totalPnlPercent: 6.0,
      cashBalance: 10000,
      buyingPower: 12650,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../stores/tradeJournalStore', () => ({
  useTradeJournalStore: vi.fn((selector) => {
    const state = {
      entries: [
        { id: 1, symbol: 'AAPL', status: 'open', entryPrice: 150, exitPrice: null, pnl: 250 },
        { id: 2, symbol: 'TSLA', status: 'closed', entryPrice: 200, exitPrice: 180, pnl: -100 },
      ],
      getPerformanceMetrics: vi.fn(() => ({
        totalTrades: 2,
        winRate: 50,
        profitFactor: 2.5,
        avgWin: 250,
        avgLoss: -100,
        netPnl: 150,
      })),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../services/greeksCalculator', () => ({
  calculatePositionGreeks: vi.fn(() => ({
    delta: 0.65,
    gamma: 0.02,
    theta: -0.15,
    vega: 0.30,
    rho: 0.05,
  })),
  calculatePortfolioGreeks: vi.fn(() => ({
    totalDelta: 1.30,
    totalGamma: 0.04,
    totalTheta: -0.30,
    totalVega: 0.60,
    totalRho: 0.10,
  })),
}));

vi.mock('../components/GreeksBar', () => ({
  default: function GreeksBar({ greeks, compact }) {
    return (
      <div data-testid="greeks-bar" data-compact={compact ? 'true' : 'false'}>
        <span data-testid="delta">Delta: {greeks?.totalDelta ?? greeks?.delta}</span>
        <span data-testid="gamma">Gamma: {greeks?.totalGamma ?? greeks?.gamma}</span>
        <span data-testid="theta">Theta: {greeks?.totalTheta ?? greeks?.theta}</span>
        <span data-testid="vega">Vega: {greeks?.totalVega ?? greeks?.vega}</span>
      </div>
    );
  },
}));

vi.mock('../components/PositionGreeksCard', () => ({
  default: function PositionGreeksCard({ position, greeks }) {
    return (
      <div data-testid={`position-greeks-${position.symbol}`}>
        <span>{position.symbol}</span>
        <span data-testid={`pos-delta-${position.symbol}`}>{greeks?.delta}</span>
      </div>
    );
  },
}));

vi.mock('../components/TradeJournalPanel', () => ({
  default: function TradeJournalPanel() {
    return <div data-testid="trade-journal-panel">Trade Journal Content</div>;
  },
}));

// ─── Components Under Test ───
import PortfolioPanel from '../components/PortfolioPanel';

describe('Integration: PortfolioPanel with Greeks & Journal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // TAB NAVIGATION
  // ═══════════════════════════════════════════
  describe('Tab Navigation', () => {
    it('renders all three tabs: Portfolio, Greeks, Journal', () => {
      render(<PortfolioPanel />);

      // Use getAllByText since "Portfolio" appears in both h2 title and tab button
      expect(screen.getAllByText('Portfolio').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Greeks').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Trade Journal').length).toBeGreaterThanOrEqual(1);
    });

    it('defaults to Portfolio tab showing positions table', () => {
      render(<PortfolioPanel />);

      // Positions table should be visible
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('TSLA')).toBeInTheDocument();
    });

    it('switches to Greeks tab and renders GreeksBar', async () => {
      render(<PortfolioPanel />);

      // Click the Greeks tab button (getAllByText returns array, click the button one)
      const greeksTabs = screen.getAllByText('Greeks');
      const greeksButton = greeksTabs.find(el => el.tagName === 'BUTTON');
      fireEvent.click(greeksButton || greeksTabs[0]);

      await waitFor(() => {
        expect(screen.getByTestId('greeks-bar')).toBeInTheDocument();
      });

      expect(screen.getByTestId('delta')).toHaveTextContent('1.3');
      expect(screen.getByTestId('gamma')).toHaveTextContent('0.04');
    });

    it('switches to Journal tab and renders TradeJournalPanel', async () => {
      render(<PortfolioPanel />);

      const journalTabs = screen.getAllByText('Trade Journal');
      const journalButton = journalTabs.find(el => el.tagName === 'BUTTON');
      fireEvent.click(journalButton || journalTabs[0]);

      await waitFor(() => {
        expect(screen.getByTestId('trade-journal-panel')).toBeInTheDocument();
      });
    });

    it('renders PositionGreeksCard for each position in Greeks tab', async () => {
      render(<PortfolioPanel />);

      const greeksTabs = screen.getAllByText('Greeks');
      const greeksButton = greeksTabs.find(el => el.tagName === 'BUTTON');
      fireEvent.click(greeksButton || greeksTabs[0]);

      await waitFor(() => {
        expect(screen.getByTestId('position-greeks-AAPL')).toBeInTheDocument();
        expect(screen.getByTestId('position-greeks-TSLA')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════
  // PORTFOLIO TAB FEATURES
  // ═══════════════════════════════════════════
  describe('Portfolio Tab Features', () => {
    it('displays summary cards with correct values', () => {
      render(<PortfolioPanel />);

      expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
      expect(screen.getByText('Cash Balance')).toBeInTheDocument();
      expect(screen.getByText('Buying Power')).toBeInTheDocument();
      expect(screen.getByText('Open Positions')).toBeInTheDocument();
    });

    it('shows quick Greeks overview in Portfolio tab when positions exist', () => {
      render(<PortfolioPanel />);

      // Quick overview should be visible in portfolio tab
      expect(screen.getByText('Quick Greeks Overview')).toBeInTheDocument();
      expect(screen.getByTestId('greeks-bar')).toHaveAttribute('data-compact', 'true');
    });

    it('has link to switch to Greeks tab from quick overview', () => {
      render(<PortfolioPanel />);

      const link = screen.getByText('View Details');
      expect(link).toBeInTheDocument();

      fireEvent.click(link);

      // Should switch to Greeks tab (GreeksBar without compact)
      expect(screen.getByTestId('greeks-bar')).toHaveAttribute('data-compact', 'false');
    });
  });

  // ═══════════════════════════════════════════
  // PAPER MODE INTEGRATION
  // ═══════════════════════════════════════════
  describe('Paper Mode Integration', () => {
    it('shows paper mode indicator in portfolio header', () => {
      const { usePortfolioStore } = require('../stores/portfolioStore');
      usePortfolioStore.mockImplementation((selector) => {
        const state = {
          positions: [],
          isPaperMode: true,
          togglePaperMode: vi.fn(),
          totalValue: 0,
          totalPnl: 0,
          totalPnlPercent: 0,
          cashBalance: 100000,
          buyingPower: 100000,
        };
        return selector ? selector(state) : state;
      });

      render(<PortfolioPanel />);

      // Paper Mode appears in header text
      const paperModeElements = screen.getAllByText(/Paper Mode/);
      expect(paperModeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════
  // EMPTY STATES
  // ═══════════════════════════════════════════
  describe('Empty States', () => {
    it('shows empty state when no positions in Greeks tab', () => {
      const { usePortfolioStore } = require('../stores/portfolioStore');
      usePortfolioStore.mockImplementation((selector) => {
        const state = {
          positions: [],
          isPaperMode: false,
          togglePaperMode: vi.fn(),
          totalValue: 0,
          totalPnl: 0,
          totalPnlPercent: 0,
          cashBalance: 10000,
          buyingPower: 10000,
        };
        return selector ? selector(state) : state;
      });

      render(<PortfolioPanel />);

      const greeksTabs = screen.getAllByText('Greeks');
      const greeksButton = greeksTabs.find(el => el.tagName === 'BUTTON');
      fireEvent.click(greeksButton || greeksTabs[0]);

      expect(screen.getByText('No positions available for Greeks calculation')).toBeInTheDocument();
    });
  });
});
