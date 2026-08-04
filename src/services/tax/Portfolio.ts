// src/services/tax/Portfolio.ts
import type { Position } from '@/types/tax';
import { PositionModel } from './models/PositionModel';

export class Portfolio {
  private positions: Map<string, PositionModel[]> = new Map();

  addPosition(position: Position): void {
    const key = position.symbol;
    if (!this.positions.has(key)) {
      this.positions.set(key, []);
    }
    this.positions.get(key)!.push(new PositionModel(position));
  }

  addPositions(positions: Position[]): void {
    positions.forEach(p => this.addPosition(p));
  }

  getPositions(symbol: string, assetClass: Position['assetClass']): Position[] {
    const allPositions = this.positions.get(symbol) ?? [];
    return allPositions
      .filter(p => p.assetClass === assetClass)
      .map(p => p.toJSON());
  }

  getAllPositions(): Position[] {
    const result: Position[] = [];
    this.positions.forEach(posList => {
      posList.forEach(p => result.push(p.toJSON()));
    });
    return result;
  }

  removeSymbol(symbol: string): void {
    this.positions.delete(symbol);
  }

  clear(): void {
    this.positions.clear();
  }
}
