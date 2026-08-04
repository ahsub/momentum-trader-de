// src/services/tax/models/TaxResultModel.ts
import type { TaxResult, MatchedLot } from '@/types/tax';

export class TaxResultModel implements TaxResult {
  tradeId: string;
  symbol: string;
  sellDate: string;
  quantity: number;
  realizedPnl: number;
  taxableAmount: number;
  taxOwed: number;
  taxType: TaxResult['taxType'];
  taxRateApplied: number;
  holdingPeriodMet: boolean;
  matchedLots: MatchedLot[];
  notes: string[];

  constructor(data: TaxResult) {
    this.tradeId = data.tradeId;
    this.symbol = data.symbol;
    this.sellDate = data.sellDate;
    this.quantity = data.quantity;
    this.realizedPnl = data.realizedPnl;
    this.taxableAmount = data.taxableAmount;
    this.taxOwed = data.taxOwed;
    this.taxType = data.taxType;
    this.taxRateApplied = data.taxRateApplied;
    this.holdingPeriodMet = data.holdingPeriodMet;
    this.matchedLots = data.matchedLots;
    this.notes = data.notes;
  }

  toJSON(): TaxResult {
    return {
      tradeId: this.tradeId,
      symbol: this.symbol,
      sellDate: this.sellDate,
      quantity: this.quantity,
      realizedPnl: this.realizedPnl,
      taxableAmount: this.taxableAmount,
      taxOwed: this.taxOwed,
      taxType: this.taxType,
      taxRateApplied: this.taxRateApplied,
      holdingPeriodMet: this.holdingPeriodMet,
      matchedLots: this.matchedLots,
      notes: this.notes,
    };
  }
}
