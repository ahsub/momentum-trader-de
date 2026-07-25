import { describe, it, expect } from 'vitest';
import { parseOptionSymbol, determineTradeStatus, detectStrategy, parseCapTraderCSV, validateTrades } from '../utils/csvParser';
import { calculatePositionGreeks, aggregatePositions, calculatePortfolioSummary } from '../utils/positionsEngine';
import { generateRecommendations, generateAlerts } from '../utils/kiEngine';

describe('csvParser', () => {
  describe('parseOptionSymbol', () => {
    it('parses AAPL put correctly', () => {
      const result = parseOptionSymbol('AAPL  240816P00200000');
      expect(result).toEqual({
        underlying: 'AAPL',
        expiry: '2024-08-16',
        optionType: 'PUT',
        strike: 200
      });
    });

    it('parses NVDA call correctly', () => {
      const result = parseOptionSymbol('NVDA  240719C00400000');
      expect(result).toEqual({
        underlying: 'NVDA',
        expiry: '2024-07-19',
        optionType: 'CALL',
        strike: 400
      });
    });

    it('returns null for stock symbol', () => {
      expect(parseOptionSymbol('AAPL')).toBeNull();
    });
  });

  describe('determineTradeStatus', () => {
    it('detects expired options', () => {
      expect(determineTradeStatus('C;Ep', 'OPT', 1)).toBe('EXPIRED');
    });

    it('detects assigned stock', () => {
      expect(determineTradeStatus('A;Ep', 'STK', 200)).toBe('ASSIGNED');
    });

    it('detects exercised/called away', () => {
      expect(determineTradeStatus('C;Ex', 'STK', -200)).toBe('EXERCISED');
    });

    it('detects rolled positions', () => {
      expect(determineTradeStatus('C;R', 'OPT', 1)).toBe('ROLLED');
    });
  });

  describe('detectStrategy', () => {
    it('identifies cash secured put', () => {
      const trade = { assetClass: 'OPTION', optionType: 'PUT', side: 'SELL' };
      expect(detectStrategy(trade)).toBe('CASH_SECURED_PUT');
    });

    it('identifies covered call with underlying', () => {
      const trade = { assetClass: 'OPTION', optionType: 'CALL', side: 'SELL', underlying: 'AAPL' };
      const allTrades = [{ symbol: 'AAPL', assetClass: 'STK', netQuantity: 100 }];
      expect(detectStrategy(trade, allTrades)).toBe('COVERED_CALL');
    });

    it('identifies naked call without underlying', () => {
      const trade = { assetClass: 'OPTION', optionType: 'CALL', side: 'SELL', underlying: 'TSLA' };
      expect(detectStrategy(trade, [])).toBe('NAKED_CALL');
    });
  });

  describe('parseCapTraderCSV', () => {
    it('parses mock CSV correctly', () => {
      const csv = `Date/Time,Symbol,Quantity,T. Price,Proceeds,Comm/Fee,Realized P/L,Code,Buy/Sell,Order Type,Description,AssetClass
2026-07-23 10:00:00,AAPL,100,185.50,-18550.00,-1.00,,O,BUY,LMT,AAPL Stock,STK
2026-07-23 10:00:00,AAPL  240816P00200000,-1,2.50,250.00,-1.24,,O,SELL,LMT,AAPL PUT,OPT`;

      const trades = parseCapTraderCSV(csv);
      expect(trades).toHaveLength(2);
      expect(trades[0].assetClass).toBe('STOCK');
      expect(trades[1].assetClass).toBe('OPTION');
      expect(trades[1].optionType).toBe('PUT');
    });
  });
});

describe('positionsEngine', () => {
  const mockTrades = [
    { symbol: 'AAPL', underlying: 'AAPL', assetClass: 'STOCK', netQuantity: 100, price: 185.50, proceeds: -18550, commission: -1, status: 'OPEN', strategy: 'BUY_AND_HOLD' },
    { symbol: 'AAPL  240816P00200000', underlying: 'AAPL', assetClass: 'OPTION', optionType: 'PUT', strike: 200, expiry: '2026-08-16', netQuantity: -1, price: 2.50, proceeds: 250, commission: -1.24, status: 'OPEN', strategy: 'CASH_SECURED_PUT', premium: 2.50 },
    { symbol: 'AAPL  240816P00200000', underlying: 'AAPL', assetClass: 'OPTION', optionType: 'PUT', strike: 200, expiry: '2026-08-16', netQuantity: 1, price: 0.05, proceeds: -5, commission: -1.24, status: 'EXPIRED', strategy: 'CASH_SECURED_PUT', realizedPnl: 243.52, premium: -0.05 },
  ];

  describe('aggregatePositions', () => {
    it('aggregates stock position correctly', () => {
      const positions = aggregatePositions(mockTrades, { AAPL: 210.50 });
      const aapl = positions.find(p => p.symbol === 'AAPL');
      expect(aapl).toBeDefined();
      expect(aapl.netQuantity).toBe(100);
    });

    it('calculates option position as closed after expiry', () => {
      const positions = aggregatePositions(mockTrades, { AAPL: 210.50 });
      const put = positions.find(p => p.symbol === 'AAPL  240816P00200000');
      expect(put.netQuantity).toBe(0); // Opened -1, closed +1
      expect(put.realizedPnl).toBe(243.52);
    });
  });

  describe('calculatePortfolioSummary', () => {
    it('calculates summary correctly', () => {
      const positions = aggregatePositions(mockTrades, { AAPL: 210.50 });
      const summary = calculatePortfolioSummary(positions, 50000);

      expect(summary.cashBalance).toBe(50000);
      expect(summary.openPositions).toBe(1); // Only AAPL stock remains
      expect(summary.realizedPnl).toBe(243.52);
    });
  });
});

describe('kiEngine', () => {
  const mockSnapshot = {
    computed: { regime: 'CRISIS', riskScore: 95 }
  };

  const mockPortfolio = {
    totalValue: 150000,
    cashBalance: 50000,
    investedValue: 100000,
    portfolioDelta: 1500,
    cashPercent: 33.3,
    stockPercent: 66.7,
    optionPercent: 0
  };

  const mockPositions = [
    { symbol: 'AAPL', underlying: 'AAPL', assetClass: 'STOCK', netQuantity: 100, marketValue: 21050, isOpen: true },
    { symbol: 'NVDA', underlying: 'NVDA', assetClass: 'STOCK', netQuantity: 50, marketValue: 19750, isOpen: true },
    { symbol: 'TSLA  240816P00230000', underlying: 'TSLA', assetClass: 'OPTION', optionType: 'PUT', strike: 230, expiry: '2026-08-16', netQuantity: -1, marketValue: 0, isOpen: true, daysToExpiry: 24, assignmentRisk: 'NONE', marketPrice: 240 }
  ];

  describe('generateRecommendations', () => {
    it('generates crisis warning for high delta', () => {
      const recs = generateRecommendations(mockPortfolio, mockSnapshot, mockPositions);
      const crisisRec = recs.find(r => r.id === 'crisis-delta');
      expect(crisisRec).toBeDefined();
      expect(crisisRec.priority).toBe('CRITICAL');
    });

    it('warns about short options in crisis', () => {
      const recs = generateRecommendations(mockPortfolio, mockSnapshot, mockPositions);
      const shortOptRec = recs.find(r => r.id === 'crisis-short-options');
      expect(shortOptRec).toBeDefined();
      expect(shortOptRec.priority).toBe('CRITICAL');
    });

    it('suggests cash deployment in bull quiet', () => {
      const bullSnapshot = { computed: { regime: 'BULL_QUIET', riskScore: 15 } };
      const highCashPortfolio = { ...mockPortfolio, cashPercent: 50 };
      const recs = generateRecommendations(highCashPortfolio, bullSnapshot, mockPositions);
      const cashRec = recs.find(r => r.id === 'cash-deployment');
      expect(cashRec).toBeDefined();
    });
  });

  describe('generateAlerts', () => {
    it('creates expiry alert for same-day expiration', () => {
      const today = new Date().toISOString().split('T')[0];
      const positions = [{ expiry: today, assetClass: 'OPTION', netQuantity: -1, underlying: 'AAPL', optionType: 'PUT', strike: 200, marketPrice: 195 }];
      const alerts = generateAlerts(positions, mockSnapshot);
      expect(alerts.some(a => a.type === 'EXPIRY')).toBe(true);
    });
  });
});
