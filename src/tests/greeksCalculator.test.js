import { describe, it, expect } from 'vitest';
import {
  calculateGreeks,
  calculatePortfolioGreeks,
  estimateImpliedVolatility,
  calculatePositionGreeks,
} from '../services/greeksCalculator';

describe('Greeks Calculator', () => {
  describe('calculateGreeks', () => {
    it('berechnet korrekte Greeks fuer einen ATM Call', () => {
      const result = calculateGreeks({
        S: 100,
        K: 100,
        T: 30 / 365,
        r: 0.045,
        sigma: 0.30,
        optionType: 'call',
        quantity: 1,
      });

      expect(result.delta).toBeGreaterThan(0.4);
      expect(result.delta).toBeLessThan(0.6);
      expect(result.gamma).toBeGreaterThan(0);
      expect(result.theta).toBeLessThan(0);
      expect(result.vega).toBeGreaterThan(0);
      expect(result.theoreticalPrice).toBeGreaterThan(2);
      expect(result.theoreticalPrice).toBeLessThan(5);
    });

    it('berechnet korrekte Greeks fuer einen ATM Put', () => {
      const result = calculateGreeks({
        S: 100,
        K: 100,
        T: 30 / 365,
        r: 0.045,
        sigma: 0.30,
        optionType: 'put',
        quantity: 1,
      });

      expect(result.delta).toBeGreaterThan(-0.6);
      expect(result.delta).toBeLessThan(-0.4);
      expect(result.gamma).toBeGreaterThan(0);
      expect(result.theta).toBeLessThan(0);
      expect(result.vega).toBeGreaterThan(0);
    });

    it('Deep ITM Call hat Delta nahe 1', () => {
      const result = calculateGreeks({
        S: 150,
        K: 100,
        T: 30 / 365,
        r: 0.045,
        sigma: 0.30,
        optionType: 'call',
        quantity: 1,
      });

      expect(result.delta).toBeGreaterThan(0.95);
    });

    it('Deep OTM Call hat Delta nahe 0', () => {
      const result = calculateGreeks({
        S: 50,
        K: 100,
        T: 30 / 365,
        r: 0.045,
        sigma: 0.30,
        optionType: 'call',
        quantity: 1,
      });

      expect(result.delta).toBeLessThan(0.05);
    });

    it('Short Position invertiert Delta-Zeichen', () => {
      const long = calculateGreeks({
        S: 100, K: 100, T: 30 / 365, r: 0.045, sigma: 0.30,
        optionType: 'call', quantity: 1,
      });
      const short = calculateGreeks({
        S: 100, K: 100, T: 30 / 365, r: 0.045, sigma: 0.30,
        optionType: 'call', quantity: -1,
      });

      expect(short.delta).toBeCloseTo(-long.delta, 2);
    });

    it('Multiplikator 100 wird angewendet', () => {
      const result = calculateGreeks({
        S: 100, K: 100, T: 30 / 365, r: 0.045, sigma: 0.30,
        optionType: 'call', quantity: 2,
      });

      const single = calculateGreeks({
        S: 100, K: 100, T: 30 / 365, r: 0.045, sigma: 0.30,
        optionType: 'call', quantity: 1,
      });

      expect(result.delta).toBeCloseTo(single.delta * 2, 2);
    });

    it('handle T=0 gracefully', () => {
      const result = calculateGreeks({
        S: 100, K: 100, T: 0, r: 0.045, sigma: 0.30,
        optionType: 'call', quantity: 1,
      });

      expect(result.delta).toBe(100);
      expect(result.gamma).toBe(0);
      expect(result.theta).toBe(0);
      expect(result.vega).toBe(0);
    });
  });

  describe('calculatePortfolioGreeks', () => {
    it('aggregiert mehrere Positionen korrekt', () => {
      const positions = [
        { greeks: { delta: 50, gamma: 5, theta: -10, vega: 20, rho: 2 } },
        { greeks: { delta: -30, gamma: 3, theta: -5, vega: 15, rho: 1 } },
      ];

      const result = calculatePortfolioGreeks(positions);

      expect(result.totalDelta).toBe(20);
      expect(result.totalGamma).toBe(8);
      expect(result.totalTheta).toBe(-15);
      expect(result.totalVega).toBe(35);
      expect(result.totalRho).toBe(3);
    });

    it('ignoriert Positionen ohne greeks', () => {
      const positions = [
        { greeks: { delta: 50, gamma: 5, theta: -10, vega: 20, rho: 2 } },
        { symbol: 'AAPL' },
      ];

      const result = calculatePortfolioGreeks(positions);
      expect(result.totalDelta).toBe(50);
    });
  });

  describe('estimateImpliedVolatility', () => {
    it('schaetzt IV fuer ATM Call korrekt', () => {
      const iv = estimateImpliedVolatility(
        100, 100, 30 / 365, 0.045, 3.50, 'call'
      );
      expect(iv).toBeGreaterThan(0.20);
      expect(iv).toBeLessThan(0.50);
    });

    it('gibt NaN-freies Ergebnis zurueck', () => {
      const iv = estimateImpliedVolatility(
        100, 100, 30 / 365, 0.045, 3.50, 'call'
      );
      expect(iv).not.toBeNaN();
      expect(iv).toBeGreaterThan(0);
    });
  });

  describe('calculatePositionGreeks', () => {
    it('berechnet Greeks aus Position-Objekt', () => {
      const position = {
        underlyingPrice: 100,
        strike: 100,
        daysToExpiration: 30,
        riskFreeRate: 0.045,
        impliedVolatility: 0.30,
        optionType: 'call',
        quantity: 1,
      };

      const result = calculatePositionGreeks(position);
      expect(result.delta).toBeGreaterThan(0);
      expect(result.gamma).toBeGreaterThan(0);
    });

    it('schaetzt IV aus Marktpreis wenn keine IV vorhanden', () => {
      const position = {
        underlyingPrice: 100,
        strike: 100,
        daysToExpiration: 30,
        riskFreeRate: 0.045,
        impliedVolatility: null,
        optionType: 'call',
        quantity: 1,
        marketPrice: 3.50,
      };

      const result = calculatePositionGreeks(position);
      expect(result.delta).toBeGreaterThan(0);
      expect(result.theoreticalPrice).toBeGreaterThan(0);
    });

    it('verwendet Fallback-IV von 30%', () => {
      const position = {
        underlyingPrice: 100,
        strike: 100,
        daysToExpiration: 30,
        optionType: 'call',
        quantity: 1,
      };

      const result = calculatePositionGreeks(position);
      expect(result.delta).toBeGreaterThan(0);
    });
  });
});
