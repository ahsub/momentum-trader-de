// ============================================
// Momentum Trader Pro - TypeScript-Typen
// ============================================

export interface GapData {
  ticker: string;
  prevClose: number;
  preMarketOpen: number;
  gapPct: number;
  gapDirection: 'UP' | 'DOWN';
  preMarketVolume: number;
  avgVolume20d: number;
  volumeRatio: number;
  atr14: number;
  regime: MarketRegime;
  setupScore: number;
  alertLevel: AlertLevel;
  timestamp: string;
  source: string;
  error?: string;
}

export type MarketRegime = 
  | 'BULL_QUIET' 
  | 'BULL_VOLATILE' 
  | 'BEAR_QUIET' 
  | 'BEAR_VOLATILE' 
  | 'CRISIS';

export type AlertLevel = 'INFO' | 'WATCH' | 'ALERT' | 'BREAKOUT';

export interface MarketRegimeData {
  regime: MarketRegime;
  score: number;
  moveIndex: number;
  vix: number;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  health: number;
  circuitBreaker: 'NORMAL' | 'ELEVATED' | 'CRITICAL';
}

export interface RiskProfile {
  maxRiskPerTrade: number;      // % des Kapitals
  maxRiskPerDay: number;         // % des Kapitals
  maxOpenPositions: number;
  maxLeverage: number;
  currentExposure: number;       // Aktuelle Exposure in %
  dailyPnL: number;              // Tägliches P&L in %
  openPositions: number;
}

export interface PositionGate {
  regime: MarketRegime;
  maxPositionSize: number;       // 0-100%
  maxLeverage: number;
  allowNewTrades: boolean;
}

export interface QuickWinSetup {
  id: string;
  ticker: string;
  setupType: 'GAP_AND_GO' | 'EMA_CROSS' | 'OPENING_RANGE' | 'MEAN_REVERSION';
  trigger: string;
  entry: number;
  stopLoss: number;
  target: number;
  timeFrame: number;              // Minuten
  riskReward: number;
  priority: AlertLevel;
}

export interface Trade {
  id: string;
  ticker: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  target: number;
  size: number;
  pnl?: number;
  pnlPct?: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  openedAt: string;
  closedAt?: string;
  setupType: string;
  notes?: string;
}

export interface Portfolio {
  cash: number;
  totalValue: number;
  dayPnL: number;
  dayPnLPct: number;
  openTrades: Trade[];
  closedTrades: Trade[];
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

export interface GapFilterConfig {
  minGapPct: number;
  maxGapPct: number;
  minAvgVolume: number;
  maxAtrPct: number;
  onlyLong: boolean;
}

export const DEFAULT_GAP_FILTER: GapFilterConfig = {
  minGapPct: 2,
  maxGapPct: 15,
  minAvgVolume: 500000,
  maxAtrPct: 5,
  onlyLong: false,
};

export interface SnapshotData {
  date: string;
  run: 'morning' | 'nyse';
  regime: MarketRegimeData;
  leaderboard: Record<string, any[]>;
  tickers: Record<string, any>;
}
