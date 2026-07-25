// ============================================
// McmStore v3.1 - Risk Management Engine + Phase 4 UI
// ============================================

import type { MarketRegimeData, RiskProfile, PositionGate, MarketRegime } from '../types';

// ============================================
// PHASE 4: UI-KONFIGURATION (NEU)
// ============================================

export type MarketRegimeUI = 
  | 'BULL_QUIET' 
  | 'BULL_VOLATILE' 
  | 'BEAR_QUIET' 
  | 'BEAR_VOLATILE' 
  | 'CRISIS' 
  | 'NEUTRAL';

export const REGIME_CONFIG: Record<MarketRegimeUI, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  BULL_QUIET: {
    label: 'BULL QUIET',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/80',
    borderColor: 'border-emerald-500/50',
    description: 'Trend ↑, Volatilität ↓ – Ideale Trading-Bedingungen'
  },
  BULL_VOLATILE: {
    label: 'BULL VOLATILE',
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/80',
    borderColor: 'border-amber-500/50',
    description: 'Trend ↑, Volatilität ↑ – Vorsicht bei Position Sizing'
  },
  BEAR_QUIET: {
    label: 'BEAR QUIET',
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/80',
    borderColor: 'border-blue-500/50',
    description: 'Trend ↓, Volatilität ↓ – Short-Bias möglich'
  },
  BEAR_VOLATILE: {
    label: 'BEAR VOLATILE',
    color: 'text-orange-400',
    bgColor: 'bg-orange-950/80',
    borderColor: 'border-orange-500/50',
    description: 'Trend ↓, Volatilität ↑ – Hohes Risiko, kleine Positionen'
  },
  CRISIS: {
    label: 'CRISIS',
    color: 'text-red-500',
    bgColor: 'bg-red-950/80',
    borderColor: 'border-red-500/50',
    description: 'Extreme Volatilität – KEINE neuen Trades!'
  },
  NEUTRAL: {
    label: 'NEUTRAL',
    color: 'text-slate-400',
    bgColor: 'bg-slate-900/80',
    borderColor: 'border-slate-500/50',
    description: 'Kein klarer Trend – Warte auf Setup'
  }
};

export const RISK_CONFIG = {
  LOW: { max: 30, color: 'text-emerald-400', barColor: 'bg-emerald-500', label: 'Niedrig' },
  MEDIUM: { max: 60, color: 'text-amber-400', barColor: 'bg-amber-500', label: 'Mittel' },
  HIGH: { max: 85, color: 'text-orange-400', barColor: 'bg-orange-500', label: 'Hoch' },
  CRITICAL: { max: 100, color: 'text-red-500', barColor: 'bg-red-500', label: 'Kritisch' }
};

export function getRiskLevel(score: number) {
  if (score <= 30) return RISK_CONFIG.LOW;
  if (score <= 60) return RISK_CONFIG.MEDIUM;
  if (score <= 85) return RISK_CONFIG.HIGH;
  return RISK_CONFIG.CRITICAL;
}

// ============================================
// BESTEHENDE MCMSTORE KLASSE (unverändert)
// ============================================

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

// ============================================
// PHASE 4: REAKTIVE STORE-INSTANZ (NEU)
// ============================================

export const mcmStore = new McmStore();

// Erweiterte UI-State-Instanz für React Integration
export const mcmUIState = {
  regime: 'BULL_QUIET' as MarketRegimeUI,
  regimeConfidence: 78,
  riskScore: 25,
  allowNewTrades: true,
  gateReason: null as string | null,
  circuitBreakerTriggered: false,
  circuitBreakerReason: null as string | null,
  vixLevel: 14.2,
  spyTrend: 'UP' as 'UP' | 'DOWN' | 'SIDEWAYS',
  breadthRatio: 1.8,
  
  listeners: new Set<(state: any) => void>(),
  
  // Regime aktualisieren
  updateRegime(regime: MarketRegimeUI, confidence: number): void {
    this.regime = regime;
    this.regimeConfidence = confidence;
    this.checkPositionGate();
    this._notify();
  },
  
  // Risk Score aktualisieren
  updateRiskScore(score: number): void {
    this.riskScore = Math.max(0, Math.min(100, score));
    this.checkPositionGate();
    this._notify();
  },
  
  // Market Data aktualisieren
  updateMarketData(vix: number, trend: 'UP' | 'DOWN' | 'SIDEWAYS', breadth: number): void {
    this.vixLevel = vix;
    this.spyTrend = trend;
    this.breadthRatio = breadth;
    this._autoDetectRegime();
    this._notify();
  },
  
  // Circuit Breaker triggern
  triggerCircuitBreaker(reason: string): void {
    this.circuitBreakerTriggered = true;
    this.circuitBreakerReason = reason;
    this.allowNewTrades = false;
    this._notify();
  },
  
  // Circuit Breaker zurücksetzen
  resetCircuitBreaker(): void {
    this.circuitBreakerTriggered = false;
    this.circuitBreakerReason = null;
    this.checkPositionGate();
    this._notify();
  },
  
  // Position Gate prüfen
  checkPositionGate(): void {
    const crisisRegimes = ['CRISIS', 'BEAR_VOLATILE'];
    if (crisisRegimes.includes(this.regime) || this.riskScore > 85) {
      this.allowNewTrades = false;
      this.gateReason = crisisRegimes.includes(this.regime) 
        ? `Regime: ${REGIME_CONFIG[this.regime].label}`
        : `Risk Score zu hoch (${this.riskScore})`;
    } else {
      this.allowNewTrades = true;
      this.gateReason = null;
    }
  },
  
  // Auto-Regime Detection basierend auf VIX + Trend
  _autoDetectRegime(): void {
    if (this.vixLevel > 35) {
      this.regime = 'CRISIS';
    } else if (this.vixLevel > 25) {
      this.regime = this.spyTrend === 'UP' ? 'BULL_VOLATILE' : 'BEAR_VOLATILE';
    } else if (this.vixLevel > 18) {
      this.regime = this.spyTrend === 'UP' ? 'BULL_QUIET' : 'BEAR_QUIET';
    } else {
      this.regime = this.spyTrend === 'UP' ? 'BULL_QUIET' : 'NEUTRAL';
    }
    this.checkPositionGate();
  },
  
  // Listener benachrichtigen
  _notify(): void {
    const state = { ...this };
    delete (state as any).listeners;
    delete (state as any)._notify;
    delete (state as any).subscribe;
    delete (state as any).updateRegime;
    delete (state as any).updateRiskScore;
    delete (state as any).updateMarketData;
    delete (state as any).triggerCircuitBreaker;
    delete (state as any).resetCircuitBreaker;
    delete (state as any).checkPositionGate;
    delete (state as any)._autoDetectRegime;
    this.listeners.forEach(cb => cb(state));
  },
  
  // Subscribe für React
  subscribe(callback: (state: any) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
};
