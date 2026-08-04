// src/services/tax/models/PositionModel.ts
import type { Position } from '@/types/tax';

export class PositionModel implements Position {
  id: string;
  assetClass: Position['assetClass'];
  symbol: string;
  buyDate: string;
  quantity: number;
  buyPrice: number;
  fees: number;

  constructor(data: Position) {
    this.id = data.id;
    this.assetClass = data.assetClass;
    this.symbol = data.symbol;
    this.buyDate = data.buyDate;
    this.quantity = data.quantity;
    this.buyPrice = data.buyPrice;
    this.fees = data.fees;
  }

  get costBasis(): number {
    return this.quantity * this.buyPrice + this.fees;
  }

  get unitCost(): number {
    if (this.quantity === 0) return 0;
    return this.costBasis / this.quantity;
  }

  toJSON(): Position {
    return {
      id: this.id,
      assetClass: this.assetClass,
      symbol: this.symbol,
      buyDate: this.buyDate,
      quantity: this.quantity,
      buyPrice: this.buyPrice,
      fees: this.fees,
    };
  }
}
