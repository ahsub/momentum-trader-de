import { describe, it, expect } from 'vitest';
import { calculateRegime, getRegimeLabel, getRegimeColor } from '../utils/regimeCalculator';

describe('calculateRegime', () => {
  it('returns CRISIS when VIX > 30 and SPX below MA200', () => {
    const snapshot = {
      vix: { current: 35 },
      spx: { current: 4000, ma200: 4200, ma50: 4100 },
      breadth: { nyaChangePercent: -1 }
    };
    expect(calculateRegime(snapshot)).toBe('CRISIS');
  });

  it('returns BEAR_VOLATILE when VIX > 25', () => {
    const snapshot = {
      vix: { current: 28 },
      spx: { current: 4500, ma200: 4200, ma50: 4400 },
      breadth: { nyaChangePercent: -0.5 }
    };
    expect(calculateRegime(snapshot)).toBe('BEAR_VOLATILE');
  });

  it('returns BEAR_VOLATILE on severe breadth deterioration', () => {
    const snapshot = {
      vix: { current: 18 },
      spx: { current: 4500, ma200: 4200, ma50: 4400 },
      breadth: { nyaChangePercent: -3.5 }
    };
    expect(calculateRegime(snapshot)).toBe('BEAR_VOLATILE');
  });

  it('returns BULL_QUIET when VIX < 15 and golden cross', () => {
    const snapshot = {
      vix: { current: 12 },
      spx: { current: 5000, ma200: 4500, ma50: 4800 },
      breadth: { nyaChangePercent: 0.5 }
    };
    expect(calculateRegime(snapshot)).toBe('BULL_QUIET');
  });

  it('returns BULL_VOLATILE when VIX > 20 and SPX above MA200', () => {
    const snapshot = {
      vix: { current: 22 },
      spx: { current: 5000, ma200: 4500, ma50: 4800 },
      breadth: { nyaChangePercent: -0.5 }
    };
    expect(calculateRegime(snapshot)).toBe('BULL_VOLATILE');
  });

  it('returns BEAR_QUIET when SPX below MA200 but VIX moderate', () => {
    const snapshot = {
      vix: { current: 18 },
      spx: { current: 4000, ma200: 4200, ma50: 4100 },
      breadth: { nyaChangePercent: -0.5 }
    };
    expect(calculateRegime(snapshot)).toBe('BEAR_QUIET');
  });

  it('defaults to BULL_QUIET on null snapshot', () => {
    expect(calculateRegime(null)).toBe('BULL_QUIET');
  });

  it('defaults to BULL_QUIET on empty object', () => {
    expect(calculateRegime({})).toBe('BULL_QUIET');
  });
});

describe('getRegimeLabel', () => {
  it('returns human-readable labels', () => {
    expect(getRegimeLabel('CRISIS')).toBe('Crisis');
    expect(getRegimeLabel('BULL_QUIET')).toBe('Bull Quiet');
    expect(getRegimeLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('getRegimeColor', () => {
  it('returns correct Tailwind classes', () => {
    expect(getRegimeColor('CRISIS')).toBe('bg-red-700');
    expect(getRegimeColor('BULL_QUIET')).toBe('bg-emerald-500');
    expect(getRegimeColor('UNKNOWN')).toBe('bg-gray-500');
  });
});
