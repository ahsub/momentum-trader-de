import { describe, it, expect } from 'vitest';
import { findCSPSetup, analyzeCSPRoll } from '../utils/cspAdvisor';
import { findCCSetup, analyzeCCRoll } from '../utils/ccAdvisor';
import { analyzeWheelStage, calculateWheelPnL } from '../utils/wheelTracker';

describe('cspAdvisor', () => {
  const mockChain = [
    { strike: 280, bid: 2.50, ask: 2.70, expiry: '2026-08-21', impliedVolatility: 0.30, openInterest: 1000 },
    { strike: 290, bid: 3.80, ask: 4.00, expiry: '2026-08-21', impliedVolatility: 0.28, openInterest: 2000 },
    { strike: 300, bid: 5.50, ask: 5.80, expiry: '2026-08-21', impliedVolatility: 0.25, openInterest: 3000 },
    { strike: 310, bid: 7.20, ask: 7.50, expiry: '2026-08-21', impliedVolatility: 0.22, openInterest: 1500 },
  ];

  it('recommends CSP in BULL_QUIET', () => {
    const result = findCSPSetup({
      symbol: 'AAPL',
      underlyingPrice: 312.50,
      availableCash: 50000,
      regime: 'BULL_QUIET',
      optionsChain: mockChain,
      supportLevels: [300, 290],
      existingPositions: []
    });

    expect(result.recommendation).toBe('EXECUTE');
    expect(result.setup).toBeDefined();
    expect(result.setup.strike).toBeDefined();
    expect(result.setup.annualizedReturn).toBeDefined();
  });

  it('avoids CSP in CRISIS', () => {
    const result = findCSPSetup({
      symbol: 'AAPL',
      underlyingPrice: 312.50,
      availableCash: 50000,
      regime: 'CRISIS',
      optionsChain: mockChain,
      existingPositions: []
    });

    expect(result.recommendation).toBe('AVOID');
    expect(result.reason).toContain('CRISIS');
  });

  it('skips if existing CSP on symbol', () => {
    const result = findCSPSetup({
      symbol: 'AAPL',
      underlyingPrice: 312.50,
      availableCash: 50000,
      regime: 'BULL_QUIET',
      optionsChain: mockChain,
      existingPositions: [
        { underlying: 'AAPL', strategy: 'CASH_SECURED_PUT', isOpen: true, strike: 300 }
      ]
    });

    expect(result.recommendation).toBe('SKIP');
  });

  it('returns alternatives', () => {
    const result = findCSPSetup({
      symbol: 'AAPL',
      underlyingPrice: 312.50,
      availableCash: 50000,
      regime: 'BULL_QUIET',
      optionsChain: mockChain,
      supportLevels: [300],
      existingPositions: []
    });

    expect(result.alternatives).toBeDefined();
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('analyzes CSP roll when DTE low', () => {
    const position = { optionType: 'PUT', strike: 300, daysToExpiry: 3, expiry: '2026-07-26' };
    const result = analyzeCSPRoll(position, {
      underlyingPrice: 295,
      optionsChain: mockChain,
      regime: 'BULL_QUIET'
    });

    expect(result.recommendation).toBe('ROLL');
    expect(result.triggers.some(t => t.type === 'DTE')).toBe(true);
    expect(result.triggers.some(t => t.type === 'ITM')).toBe(true);
  });
});

describe('ccAdvisor', () => {
  const mockChain = [
    { strike: 320, bid: 2.00, ask: 2.20, expiry: '2026-08-21', impliedVolatility: 0.28, openInterest: 1500 },
    { strike: 330, bid: 1.20, ask: 1.40, expiry: '2026-08-21', impliedVolatility: 0.25, openInterest: 2000 },
    { strike: 340, bid: 0.60, ask: 0.80, expiry: '2026-08-21', impliedVolatility: 0.22, openInterest: 1000 },
  ];

  it('recommends CC when shares owned', () => {
    const result = findCCSetup({
      symbol: 'AAPL',
      sharesOwned: 200,
      costBasis: 280,
      underlyingPrice: 312.50,
      regime: 'BULL_QUIET',
      optionsChain: mockChain,
      resistanceLevels: [320, 330],
      existingPositions: []
    });

    expect(result.recommendation).toBe('EXECUTE');
    expect(result.setup.contracts).toBe(2);
  });

  it('skips CC when not enough shares', () => {
    const result = findCCSetup({
      symbol: 'AAPL',
      sharesOwned: 50,
      costBasis: 280,
      underlyingPrice: 312.50,
      regime: 'BULL_QUIET',
      optionsChain: mockChain,
      existingPositions: []
    });

    expect(result.recommendation).toBe('SKIP');
  });

  it('prefers ITM calls when protecting profit', () => {
    const result = findCCSetup({
      symbol: 'AAPL',
      sharesOwned: 100,
      costBasis: 200,
      underlyingPrice: 312.50,
      regime: 'BULL_QUIET',
      optionsChain: mockChain,
      existingPositions: []
    });

    expect(result.recommendation).toBe('EXECUTE');
    expect(result.context.protectProfit).toBe(true);
  });

  it('analyzes CC roll when ITM', () => {
    const position = { optionType: 'CALL', strike: 310, daysToExpiry: 3, expiry: '2026-07-26' };
    const result = analyzeCCRoll(position, {
      underlyingPrice: 315,
      optionsChain: mockChain,
      regime: 'BULL_QUIET'
    });

    expect(result.recommendation).toBe('ROLL');
    expect(result.triggers.some(t => t.type === 'ITM')).toBe(true);
  });
});

describe('wheelTracker', () => {
  const mockPositions = [
    { underlying: 'AAPL', assetClass: 'STOCK', netQuantity: 100, avgCost: 280, isOpen: true },
    { underlying: 'AAPL', assetClass: 'OPTION', optionType: 'CALL', netQuantity: -1, strike: 320, isOpen: true, daysToExpiry: 14 },
    { underlying: 'NVDA', assetClass: 'OPTION', optionType: 'PUT', netQuantity: -1, strike: 380, isOpen: true, daysToExpiry: 21 },
  ];

  it('detects CC_ACTIVE stage', () => {
    const stage = analyzeWheelStage(mockPositions, 'AAPL');
    expect(stage.stage).toBe('CC_ACTIVE');
    expect(stage.nextAction).toBe('HOLD');
  });

  it('detects CSP_ACTIVE stage', () => {
    const stage = analyzeWheelStage(mockPositions, 'NVDA');
    expect(stage.stage).toBe('CSP_ACTIVE');
    expect(stage.nextAction).toBe('HOLD');
  });

  it('detects READY stage for new symbol', () => {
    const stage = analyzeWheelStage(mockPositions, 'TSLA');
    expect(stage.stage).toBe('READY');
    expect(stage.nextAction).toBe('CSP');
  });

  it('calculates wheel P&L', () => {
    const mockTrades = [
      { underlying: 'AAPL', strategy: 'CASH_SECURED_PUT', side: 'SELL', premium: 2.50, quantity: 1 },
      { underlying: 'AAPL', strategy: 'COVERED_CALL', side: 'SELL', premium: 1.80, quantity: 1 },
      { underlying: 'AAPL', assetClass: 'STOCK', realizedPnl: 500 },
    ];

    const pnl = calculateWheelPnL(mockTrades, 'AAPL');
    expect(parseFloat(pnl.cspPremium)).toBe(250);
    expect(parseFloat(pnl.ccPremium)).toBe(180);
    expect(parseFloat(pnl.stockPnl)).toBe(500);
    expect(parseFloat(pnl.totalPnL)).toBe(930);
  });
});
