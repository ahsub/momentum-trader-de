// src/types/tax.ts
// Gemeinsame Typen für die Tax Engine

export enum AssetClass {
  EQUITY = 'equity',
  CRYPTO = 'crypto',
  PRECIOUS_METAL = 'precious_metal',
  DERIVATIVE = 'derivative',
  BOND = 'bond',
}

export enum TaxType {
  CAPITAL_GAINS = 'capital_gains',
  INCOME_TAX = 'income_tax',
  SPECULATIVE = 'speculative',
  NONE = 'none',
}

export interface TaxRule {
  assetClass: AssetClass;
  taxType: TaxType;
  taxRate: number;           // z.B. 0.26375 für 26.375%
  holdingPeriodDays: number; // 0 = keine Haltefrist
  fifoRequired: boolean;
  lossDeductionAllowed: boolean;
  partialExemptionRate?: number; // z.B. 0.3 für 30%
  specialRules: string[];
  version: string;           // z.B. "2024-01"
}

export interface Position {
  id: string;
  assetClass: AssetClass;
  symbol: string;
  buyDate: string;           // ISO 8601
  quantity: number;
  buyPrice: number;          // pro Einheit
  fees: number;
}

export interface Trade {
  id: string;
  assetClass: AssetClass;
  symbol: string;
  sellDate: string;          // ISO 8601
  quantity: number;
  sellPrice: number;         // pro Einheit
  fees: number;
}

export interface MatchedLot {
  positionId: string;
  buyDate: string;
  matchedQuantity: number;
  unitCost: number;
  pnl: number;
  taxable: number;
  holdingPeriodMet: boolean;
}

export interface TaxResult {
  tradeId: string;
  symbol: string;
  sellDate: string;
  quantity: number;
  realizedPnl: number;
  taxableAmount: number;
  taxOwed: number;
  taxType: TaxType;
  taxRateApplied: number;
  holdingPeriodMet: boolean;
  matchedLots: MatchedLot[];
  notes: string[];
}

export interface TaxSummary {
  totalRealizedPnl: number;
  totalTaxableAmount: number;
  totalTaxOwed: number;
  numberOfTrades: number;
  byAssetClass: Record<string, {
    pnl: number;
    taxable: number;
    taxOwed: number;
    trades: number;
  }>;
}
