// ============================================
// McmStore Unit Tests
// ============================================

import { describe, it, expect, beforeEach } from 'vitest';
import { McmStore } from '../../store/McmStore';
import type { MarketRegimeData } from '../../types';

describe('McmStore v3.0', () => {
  let store: McmStore;

  beforeEach(() => {
    store = new McmStore();
  });

  it('sollte initial BULL_QUIET Regime haben', () => {
    const regime = store.getRegime();
    expect(regime.regime).toBe('BULL_QUIET');
    expect(regime.score).toBe(50);
  });

  it('sollte tradable sein bei normalem Regime', () => {
    expect(store.isTradable()).toBe(true);
  });

  it('sollte nicht tradable sein bei CRISIS', () => {
    store.updateRegime({ regime: 'CRISIS', circuitBreaker: 'CRITICAL', moveIndex: 120 });
    expect(store.isTradable()).toBe(false);
  });

  it('sollte Position Gate für BULL_QUIET zurückgeben', () => {
    const gate = store.getPositionGate();
    expect(gate.maxPositionSize).toBe(100);
    expect(gate.allowNewTrades).toBe(true);
  });

  it('sollte Position Gate für CRISIS zurückgeben', () => {
    store.updateRegime({ regime: 'CRISIS' });
    const gate = store.getPositionGate();
    expect(gate.maxPositionSize).toBe(0);
    expect(gate.allowNewTrades).toBe(false);
  });

  it('sollte Risk Score berechnen', () => {
    const score = store.calculateRiskScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('sollte Listener benachrichtigen', () => {
    let notified = false;
    const unsubscribe = store.onRegimeChange(() => {
      notified = true;
    });

    store.updateRegime({ score: 75 });
    expect(notified).toBe(true);

    unsubscribe();
  });
});
