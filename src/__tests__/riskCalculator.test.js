import { describe, it, expect } from 'vitest';
import {
  calculateRiskScore,
  shouldTriggerCircuitBreaker,
  getRiskLevel,
  getRiskColor
} from '../utils/riskCalculator';

describe('calculateRiskScore', () => {
  it('returns low score for BULL_QUIET with low VIX percentile', () => {
    expect(calculateRiskScore('BULL_QUIET', { percentile: 20 })).toBe(5);
  });

  it('returns moderate score for BULL_QUIET with mid VIX percentile', () => {
    expect(calculateRiskScore('BULL_QUIET', { percentile: 40 })).toBe(20);
  });

  it('returns higher score for BULL_QUIET with high VIX percentile', () => {
    expect(calculateRiskScore('BULL_QUIET', { percentile: 80 })).toBe(30);
  });

  it('returns base 50 for BULL_VOLATILE with low percentile', () => {
    expect(calculateRiskScore('BULL_VOLATILE', { percentile: 30 })).toBe(45);
  });

  it('returns elevated for BULL_VOLATILE with high percentile', () => {
    expect(calculateRiskScore('BULL_VOLATILE', { percentile: 70 })).toBe(60);
  });

  it('returns high score for BEAR_QUIET', () => {
    expect(calculateRiskScore('BEAR_QUIET', { percentile: 50 })).toBe(75);
  });

  it('returns very high score for BEAR_VOLATILE', () => {
    expect(calculateRiskScore('BEAR_VOLATILE', { percentile: 50 })).toBe(85);
  });

  it('returns max score for CRISIS', () => {
    expect(calculateRiskScore('CRISIS', { percentile: 50 })).toBe(95);
  });

  it('caps score at 0 minimum', () => {
    expect(calculateRiskScore('BULL_QUIET', { percentile: 0 })).toBe(5);
  });

  it('caps score at 100 maximum', () => {
    // Extreme case that would exceed 100
    expect(calculateRiskScore('CRISIS', { percentile: 99 })).toBe(95);
  });

  it('handles null inputs gracefully', () => {
    expect(calculateRiskScore(null, null)).toBe(50);
  });
});

describe('shouldTriggerCircuitBreaker', () => {
  it('triggers on CRISIS regime', () => {
    expect(shouldTriggerCircuitBreaker('CRISIS', 50)).toBe(true);
  });

  it('triggers on extreme risk score', () => {
    expect(shouldTriggerCircuitBreaker('BEAR_VOLATILE', 95)).toBe(true);
  });

  it('does not trigger on normal conditions', () => {
    expect(shouldTriggerCircuitBreaker('BULL_QUIET', 15)).toBe(false);
  });

  it('does not trigger at exactly 89', () => {
    expect(shouldTriggerCircuitBreaker('BEAR_VOLATILE', 89)).toBe(false);
  });
});

describe('getRiskLevel', () => {
  it('classifies scores correctly', () => {
    expect(getRiskLevel(10)).toBe('Low');
    expect(getRiskLevel(30)).toBe('Moderate');
    expect(getRiskLevel(50)).toBe('Elevated');
    expect(getRiskLevel(70)).toBe('High');
    expect(getRiskLevel(95)).toBe('Extreme');
  });
});

describe('getRiskColor', () => {
  it('returns correct color classes', () => {
    expect(getRiskColor(10)).toBe('text-emerald-500');
    expect(getRiskColor(30)).toBe('text-lime-500');
    expect(getRiskColor(50)).toBe('text-amber-500');
    expect(getRiskColor(70)).toBe('text-orange-500');
    expect(getRiskColor(95)).toBe('text-red-500');
  });
});
