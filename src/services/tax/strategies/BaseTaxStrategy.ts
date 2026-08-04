// src/services/tax/strategies/BaseTaxStrategy.ts
import type { TaxRule, Trade, Position, TaxResult, MatchedLot } from '@/types/tax';
import { PositionModel } from '../models/PositionModel';
import { TradeModel } from '../models/TradeModel';

export abstract class BaseTaxStrategy {
  protected rule: TaxRule;

  constructor(rule: TaxRule) {
    this.rule = rule;
  }

  abstract calculateTax(trade: Trade, positions: Position[]): TaxResult;

  protected matchLots(trade: Trade, positions: Position[]): Array<{ position: PositionModel; quantity: number }> {
    if (!this.rule.fifoRequired) return [];

    const eligible = positions
      .filter(p => p.symbol === trade.symbol && p.assetClass === trade.assetClass)
      .sort((a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime())
      .map(p => new PositionModel(p));

    const matched: Array<{ position: PositionModel; quantity: number }> = [];
    let remaining = trade.quantity;

    for (const pos of eligible) {
      if (remaining <= 0) break;
      const matchQty = Math.min(remaining, pos.quantity);
      matched.push({ position: pos, quantity: matchQty });
      remaining -= matchQty;
    }

    return matched;
  }

  protected holdingPeriodMet(buyDate: string, sellDate: string): boolean {
    if (this.rule.holdingPeriodDays === 0) return true;
    const buy = new Date(buyDate).getTime();
    const sell = new Date(sellDate).getTime();
    const diffDays = (sell - buy) / (1000 * 60 * 60 * 24);
    return diffDays >= this.rule.holdingPeriodDays;
  }

  protected round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  protected formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE');
  }
}
