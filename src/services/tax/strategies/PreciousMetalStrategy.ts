// src/services/tax/strategies/PreciousMetalStrategy.ts
import type { Trade, Position, TaxResult, MatchedLot } from '@/types/tax';
import { BaseTaxStrategy } from './BaseTaxStrategy';

/**
 * Deutsche Edelmetall-Besteuerung (§ 23 EStG):
 * - Einkommensteuer (progressiv, hier als Flat-Rate modelliert)
 * - 1 Jahr Spekulationsfrist
 * - FIFO Pflicht
 * - Verlustabzug erlaubt
 */
export class PreciousMetalStrategy extends BaseTaxStrategy {
  calculateTax(trade: Trade, positions: Position[]): TaxResult {
    const matched = this.matchLots(trade, positions);

    let totalPnl = 0;
    let totalTaxable = 0;
    let allHoldingMet = true;
    const lotDetails: MatchedLot[] = [];
    const notes: string[] = [];

    for (const { position, quantity } of matched) {
      const proceeds = quantity * trade.sellPrice;
      const cost = quantity * position.unitCost;
      const pnl = proceeds - cost;

      const hpMet = this.holdingPeriodMet(position.buyDate, trade.sellDate);

      let taxable: number;
      if (hpMet) {
        taxable = 0;
        notes.push(`Lot vom ${this.formatDate(position.buyDate)}: Steuerfrei (Spekulationsfrist überschritten)`);
      } else {
        taxable = pnl;
        if (pnl > 0) {
          notes.push(`Lot vom ${this.formatDate(position.buyDate)}: Steuerpflichtig (§ 23 EStG, Spekulationsfrist)`);
        } else {
          notes.push(`Lot vom ${this.formatDate(position.buyDate)}: Verlust`);
        }
      }

      totalPnl += pnl;
      totalTaxable += taxable;
      if (!hpMet) allHoldingMet = false;

      lotDetails.push({
        positionId: position.id,
        buyDate: position.buyDate,
        matchedQuantity: quantity,
        unitCost: this.round(position.unitCost),
        pnl: this.round(pnl),
        taxable: this.round(taxable),
        holdingPeriodMet: hpMet,
      });
    }

    let taxOwed = 0;
    if (totalTaxable > 0) {
      taxOwed = totalTaxable * this.rule.taxRate;
    } else if (totalTaxable < 0 && !this.rule.lossDeductionAllowed) {
      notes.push('Verlustabzug nicht erlaubt');
      totalTaxable = 0;
    }

    return {
      tradeId: trade.id,
      symbol: trade.symbol,
      sellDate: trade.sellDate,
      quantity: trade.quantity,
      realizedPnl: this.round(totalPnl),
      taxableAmount: this.round(totalTaxable),
      taxOwed: this.round(taxOwed),
      taxType: this.rule.taxType,
      taxRateApplied: this.rule.taxRate,
      holdingPeriodMet: allHoldingMet,
      matchedLots: lotDetails,
      notes,
    };
  }
}
