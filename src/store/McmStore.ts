// ============================================
// McmStore v3.0 - Risk Management Engine
// ============================================

import type { MarketRegimeData, RiskProfile, PositionGate, MarketRegime } from '../types';

export class McmStore {
  private regime: MarketRegimeData;
  private risk: RiskProfile;
  private listeners: ((regime: MarketRegimeData) => void)[] = [];

  constructor() {
    this.regime = {
      regime: 'BULL_QUIET',
      score: 50,
      moveIndex: 85,
      vix: 15,
      trend: 'UP',
      health: 65,
      circuitBreaker: 'NORMAL',
    };
    this.risk = {
      maxRiskPerTrade: 2,
      maxRiskPerDay: 5,
      maxOpenPositions: 5,
      maxLeverage: 3,
      currentExposure: 0,
      dailyPnL: 0,
      openPositions: 0,
    };
  }

  // Regime aktualisieren (von Snapshot oder API)
  updateRegime(data: Partial<MarketRegimeData>): void {
    this.regime = { ...this.regime, ...data };
    this.notifyListeners();
  }

  // Aktuelles Regime abrufen
  getRegime(): MarketRegimeData {
    return { ...this.regime };
  }

  // Ist das Setup tradable?
  isTradable(): boolean {
    return this.regime.score > -20 && 
           this.regime.circuitBreaker === 'NORMAL' && 
           this.regime.moveIndex < 110;
  }

  // Position Gate basierend auf Regime
  getPositionGate(): PositionGate {
    const gates: Record<MarketRegime, PositionGate> = {
      'BULL_QUIET':     { regime: 'BULL_QUIET',     maxPositionSize: 100, maxLeverage: 3, allowNewTrades: true },
      'BULL_VOLATILE':  { regime: 'BULL_VOLATILE',  maxPositionSize: 50,  maxLeverage: 2, allowNewTrades: true },
      'BEAR_QUIET':     { regime: 'BEAR_QUIET',     maxPositionSize: 30,  maxLeverage: 2, allowNewTrades: true },
      'BEAR_VOLATILE':  { regime: 'BEAR_VOLATILE',  maxPositionSize: 20,  maxLeverage: 1, allowNewTrades: false },
      'CRISIS':         { regime: 'CRISIS',         maxPositionSize: 0,   maxLeverage: 0, allowNewTrades: false },
    };
    return gates[this.regime.regime];
  }

  // Risk Score berechnen (0-100, <60 = tradable)
  calculateRiskScore(): number {
    let score = 50;
    score += this.regime.health * 0.3;
    score -= (this.regime.moveIndex - 80) * 0.5;
    score -= this.regime.vix * 0.5;
    if (this.regime.trend === 'UP') score += 10;
    if (this.regime.trend === 'DOWN') score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  // Listener für Regime-Änderungen
  onRegimeChange(callback: (regime: MarketRegimeData) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l(this.regime));
  }
}

export const mcmStore = new McmStore();
