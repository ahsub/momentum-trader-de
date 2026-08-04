// src/services/tax/TaxEngine.ts
import type { Trade, Position, TaxResult, TaxSummary, AssetClass } from '@/types/tax';
import { TaxResultModel } from './models/TaxResultModel';
import { TaxStrategyFactory } from './TaxStrategyFactory';
import { Portfolio } from './Portfolio';

export class TaxEngine {
  private portfolio: Portfolio;
  private results: TaxResult[] = [];

  constructor(portfolio?: Portfolio) {
    this.portfolio = portfolio ?? new Portfolio();
  }

  getPortfolio(): Portfolio {
    return this.portfolio;
  }

  addPosition(position: Position): void {
    this.portfolio.addPosition(position);
  }

  addPositions(positions: Position[]): void {
    this.portfolio.addPositions(positions);
  }

  calculateTradeTax(trade: Trade): TaxResult {
    const strategy = TaxStrategyFactory.createStrategy(trade.assetClass);
    const positions = this.portfolio.getPositions(trade.symbol, trade.assetClass);

    const result = strategy.calculateTax(trade, positions);
    this.results.push(result);
    return result;
  }

  calculateMultipleTrades(trades: Trade[]): TaxResult[] {
    return trades.map(trade => this.calculateTradeTax(trade));
  }

  getResults(): TaxResult[] {
    return [...this.results];
  }

  getTaxSummary(): TaxSummary {
    const totalRealizedPnl = this.results.reduce((sum, r) => sum + r.realizedPnl, 0);
    const totalTaxable = this.results.reduce((sum, r) => sum + r.taxableAmount, 0);
    const totalTaxOwed = this.results.reduce((sum, r) => sum + r.taxOwed, 0);

    const byAssetClass: TaxSummary['byAssetClass'] = {};

    for (const result of this.results) {
      const ac = result.taxType;
      if (!byAssetClass[ac]) {
        byAssetClass[ac] = { pnl: 0, taxable: 0, taxOwed: 0, trades: 0 };
      }
      byAssetClass[ac].pnl += result.realizedPnl;
      byAssetClass[ac].taxable += result.taxableAmount;
      byAssetClass[ac].taxOwed += result.taxOwed;
      byAssetClass[ac].trades += 1;
    }

    // Runden
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      totalRealizedPnl: round2(totalRealizedPnl),
      totalTaxableAmount: round2(totalTaxable),
      totalTaxOwed: round2(totalTaxOwed),
      numberOfTrades: this.results.length,
      byAssetClass: Object.fromEntries(
        Object.entries(byAssetClass).map(([k, v]) => [
          k,
          {
            pnl: round2(v.pnl),
            taxable: round2(v.taxable),
            taxOwed: round2(v.taxOwed),
            trades: v.trades,
          },
        ])
      ),
    };
  }

  clearResults(): void {
    this.results = [];
  }

  exportToJSON(): string {
    const data = {
      summary: this.getTaxSummary(),
      trades: this.results.map(r => new TaxResultModel(r).toJSON()),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  downloadReport(filename?: string): void {
    const json = this.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `tax-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
