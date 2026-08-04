// src/services/tax/strategies/DerivativeStrategy.ts
import type { Trade, Position, TaxResult, MatchedLot } from '@/types/tax';
import { BaseTaxStrategy } from './BaseTaxStrategy';

/**
 * Deutsche Derivat-Besteuerung:
 * - Kapitalertragssteuer + Soli (26,375%)
 * - KEINE Haltefrist (immer steuerpflichtig)
 * - FIFO Pflicht
 * - Verlustabzug erlaubt
 * - Z20 Abgeltung für bestimmte Zertifikate
 */
export class DerivativeStrategy extends BaseTaxStrategy {
  calculateTax(trade: Trade, positions: Position[]): TaxResult {
    const matched = this.matchLots(trade, positions);

    let totalPnl = 0;
    let totalTaxable = 0;
    const lotDetails: MatchedLot[] = [];
    const notes: string[] = [];

    for (const { position, quantity } of matched) {
      const proceeds = quantity * trade.sellPrice;
      const cost = quantity * position.unitCost;
      const pnl = proceeds - cost;

      // Derivate sind IMMER steuerpflichtig (keine Haltefrist)
      const taxable = pnl;

      if (pnl > 0) {
        notes.push(`Lot vom ${this.formatDate(position.buyDate)}: Steuerpflichtig (Derivate: keine Haltefrist)`);
      } else {
        notes.push(`Lot vom ${this.formatDate(position.buyDate)}: Verlust`);
      }

      totalPnl += pnl;
      totalTaxable += taxable;

      lotDetails.push({
        positionId: position.id,
        buyDate: position.buyDate,
        matchedQuantity: quantity,
        unitCost: this.round(position.unitCost),
        pnl: this.round(pnl),
        taxable: this.round(taxable),
        holdingPeriodMet: false, // Immer false für Derivate
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
      holdingPeriodMet: false,
      matchedLots: lotDetails,
      notes,
    };
  }
}
