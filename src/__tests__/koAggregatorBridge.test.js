import { describe, it, expect } from 'vitest';
import { filterLeapCandidates, filterPmccCandidates } from '../services/koAggregatorBridge';

const mockTickers = [
  { symbol: 'AAPL', price: 225, ema200: 200, sma50: 210, sma200: 200, rsi14: 55, hvp: 25, compositeScore: 85, regime: 'BULL_QUIET' },
  { symbol: 'TSLA', price: 180, ema200: 200, sma50: 190, sma200: 200, rsi14: 75, hvp: 55, compositeScore: 60, regime: 'BULL_VOLATILE' },
  { symbol: 'MSFT', price: 425, ema200: 400, sma50: 410, sma200: 400, rsi14: 58, hvp: 20, compositeScore: 90, regime: 'BULL_QUIET' },
  { symbol: 'META', price: 300, ema200: 310, sma50: 305, sma200: 310, rsi14: 50, hvp: 30, compositeScore: 80, regime: 'BEAR_QUIET' },
];

describe('KO Aggregator Bridge', () => {
  it('filters LEAP candidates correctly', () => {
    expect(filterLeapCandidates(mockTickers).map(r => r.symbol)).toEqual(['AAPL', 'MSFT']);
  });
  it('filters PMCC candidates with looser criteria', () => {
    expect(filterPmccCandidates(mockTickers).map(r => r.symbol)).toEqual(['AAPL', 'MSFT']);
  });
  it('excludes tickers below EMA200', () => {
    expect(filterLeapCandidates(mockTickers).find(r => r.symbol === 'META')).toBeUndefined();
  });
});
