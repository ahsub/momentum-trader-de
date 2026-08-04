// src/services/tax/report/CapTraderImportService.ts
import type { Trade, Position } from '@/types/tax';
import { TaxEngine } from '../TaxEngine';
import { FlexQueryParser } from '../parsers/FlexQueryParser';
import { FxConverter } from '../fx/FxConverter';

export interface CapTraderConfig {
  taxYear: number;
  steuerpflichtiger: string;
  broker: string;
  isGemeinschaftskonto: boolean;
  fxConfig?: {
    useIBKRRate?: boolean;
    tolerance?: number;
  };
}

export interface CapTraderReport {
  config: CapTraderConfig;
  trades: Trade[];
  positions: Position[];
  summary: {
    totalTrades: number;
    totalPositions: number;
    currencies: string[];
  };
}

/**
 * CapTrader/IBKR Import Service
 * Integriert FlexQuery-XML mit der neuen Tax Engine
 */
export class CapTraderImportService {
  private engine: TaxEngine;
  private fxConverter: FxConverter;
  private config: CapTraderConfig;

  constructor(config: CapTraderConfig) {
    this.config = config;
    this.engine = new TaxEngine();
    this.fxConverter = new FxConverter(config.fxConfig);
  }

  /**
   * Lädt ECB-Kurse
   */
  async initialize(): Promise<void> {
    await this.fxConverter.loadECBRates();
  }

  /**
   * Verarbeitet FlexQuery-XML und importiert in Tax Engine
   */
  async processFlexQuery(xmlData: string): Promise<CapTraderReport> {
    // 1. XML parsen
    const flexTrades = FlexQueryParser.parseTrades(xmlData);
    const flexPositions = FlexQueryParser.parsePositions(xmlData);

    // 2. Währungen sammeln
    const currencies = [...new Set([
      ...flexTrades.map(t => t.currency),
      ...flexPositions.map(p => p.currency),
    ])].filter(c => c !== 'EUR');

    // 3. In EUR konvertieren
    const trades = this.convertTradesToEUR(flexTrades);
    const positions = this.convertPositionsToEUR(flexPositions);

    // 4. In Engine importieren
    this.engine.addPositions(positions);

    // 5. Trades berechnen
    const results = this.engine.calculateMultipleTrades(trades);

    return {
      config: this.config,
      trades,
      positions,
      summary: {
        totalTrades: trades.length,
        totalPositions: positions.length,
        currencies,
      },
    };
  }

  /**
   * Berechnet Steuern für alle importierten Trades
   */
  calculateTaxes() {
    return this.engine.getTaxSummary();
  }

  /**
   * Exportiert Steuerbericht als JSON
   */
  exportTaxReport(): string {
    return this.engine.exportToJSON();
  }

  /**
   * Gibt die Tax Engine zurück (für erweiterte Operationen)
   */
  getEngine(): TaxEngine {
    return this.engine;
  }

  private convertTradesToEUR(flexTrades: import('../parsers/FlexQueryParser').FlexQueryTrade[]): Trade[] {
    return flexTrades.map((ft, idx) => ({
      id: `captrade-${idx}`,
      assetClass: FlexQueryParser['mapAssetType'](ft.assetType, ft.symbol),
      symbol: ft.symbol,
      sellDate: ft.tradeDate,
      quantity: Math.abs(ft.quantity),
      sellPrice: this.fxConverter.toEUR(ft.tradePrice, ft.currency),
      fees: this.fxConverter.toEUR(Math.abs(ft.commFee), ft.currency),
    }));
  }

  private convertPositionsToEUR(flexPositions: import('../parsers/FlexQueryParser').FlexQueryPosition[]): Position[] {
    return flexPositions.map((fp, idx) => ({
      id: `cappos-${idx}`,
      assetClass: FlexQueryParser['mapAssetType'](fp.assetType, fp.symbol),
      symbol: fp.symbol,
      buyDate: fp.openDate,
      quantity: fp.quantity,
      buyPrice: this.fxConverter.toEUR(fp.costBasis / fp.quantity, fp.currency),
      fees: 0,
    }));
  }
}
