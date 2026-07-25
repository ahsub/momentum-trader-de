import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePmccWidthRule, screenLeapCandidates, screenPmccCandidates } from '../services/optionsScreener';
import * as bridge from '../services/koAggregatorBridge';

vi.mock('../services/koAggregatorBridge', () => ({
  fetchKoAggregatorData: vi.fn(),
  filterLeapCandidates: vi.fn((data) => data),
  filterPmccCandidates: vi.fn((data) => data),
}));

describe('Options Screener', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('validates a correct PMCC setup', () => {
    const r = validatePmccWidthRule({ width: 25, netDebit: 20 });
    expect(r.valid).toBe(true); expect(r.widthRule).toBe(5); expect(r.maxProfit).toBe(500);
  });
  it('rejects width <= netDebit', () => {
    const r = validatePmccWidthRule({ width: 15, netDebit: 20 });
    expect(r.valid).toBe(false); expect(r.widthRule).toBe(-5);
  });
  it('handles missing data', () => {
    const r = validatePmccWidthRule({});
    expect(r.valid).toBe(false); expect(r.reason).toBe('Missing data');
  });
  it('returns LEAP candidates with mock fallback', async () => {
    bridge.fetchKoAggregatorData.mockResolvedValue([
      { symbol: 'AAPL', price: 225, compositeScore: 85, ema200: 200, sma50: 210, sma200: 200, rsi14: 55, hvp: 25, regime: 'BULL_QUIET' },
    ]);
    const results = await screenLeapCandidates();
    expect(results[0].symbol).toBe('AAPL'); expect(results[0].strategy).toBe('LEAP');
  });
  it('returns PMCC candidates with metrics', async () => {
    bridge.fetchKoAggregatorData.mockResolvedValue([
      { symbol: 'MSFT', price: 425, compositeScore: 80, ema200: 400, sma50: 410, sma200: 400, rsi14: 58, hvp: 20, regime: 'BULL_QUIET' },
    ]);
    const results = await screenPmccCandidates();
    expect(results[0].strategy).toBe('PMCC'); expect(results[0].netDebit).toBeDefined();
  });
});
