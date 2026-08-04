// src/services/tax/models/TradeModel.ts
import type { Trade } from '@/types/tax';

export class TradeModel implements Trade {
  id: string;
  assetClass: Trade['assetClass'];
  symbol: string;
  sellDate: string;
  quantity: number;
  sellPrice: number;
  fees: number;

  constructor(data: Trade) {
    this.id = data.id;
    this.assetClass = data.assetClass;
    this.symbol = data.symbol;
    this.sellDate = data.sellDate;
    this.quantity = data.quantity;
    this.sellPrice = data.sellPrice;
    this.fees = data.fees;
  }

  get grossProceeds(): number {
    return this.quantity * this.sellPrice - this.fees;
  }

  toJSON(): Trade {
    return {
      id: this.id,
      assetClass: this.assetClass,
      symbol: this.symbol,
      sellDate: this.sellDate,
      quantity: this.quantity,
      sellPrice: this.sellPrice,
      fees: this.fees,
    };
  }
}
