// src/services/tax/parsers/FlexQueryParser.ts
import type { Trade, Position, AssetClass } from '@/types/tax';

export interface FlexQueryTrade {
  symbol: string;
  tradeDate: string;
  quantity: number;
  tradePrice: number;
  proceeds: number;
  commFee: number;
  currency: string;
  assetType: string;
  description?: string;
  isin?: string;
}

export interface FlexQueryPosition {
  symbol: string;
  openDate: string;
  quantity: number;
  costBasis: number;
  currency: string;
  assetType: string;
}

export class FlexQueryParser {
  /**
   * Parst IBKR FlexQuery XML und extrahiert Trades
   */
  static parseTrades(xmlString: string): FlexQueryTrade[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const trades: FlexQueryTrade[] = [];
    const tradeNodes = doc.querySelectorAll('Trade');

    tradeNodes.forEach((node) => {
      const trade: FlexQueryTrade = {
        symbol: node.getAttribute('symbol') || '',
        tradeDate: node.getAttribute('tradeDate') || '',
        quantity: parseFloat(node.getAttribute('quantity') || '0'),
        tradePrice: parseFloat(node.getAttribute('tradePrice') || '0'),
        proceeds: parseFloat(node.getAttribute('proceeds') || '0'),
        commFee: parseFloat(node.getAttribute('commFee') || '0'),
        currency: node.getAttribute('currency') || 'EUR',
        assetType: node.getAttribute('assetCategory') || '',
        description: node.getAttribute('description') || undefined,
        isin: node.getAttribute('isin') || undefined,
      };

      if (trade.symbol && trade.tradeDate) {
        trades.push(trade);
      }
    });

    return trades;
  }

  /**
   * Parst IBKR FlexQuery XML und extrahiert offene Positionen
   */
  static parsePositions(xmlString: string): FlexQueryPosition[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const positions: FlexQueryPosition[] = [];
    const posNodes = doc.querySelectorAll('OpenPosition');

    posNodes.forEach((node) => {
      const pos: FlexQueryPosition = {
        symbol: node.getAttribute('symbol') || '',
        openDate: node.getAttribute('openDate') || '',
        quantity: parseFloat(node.getAttribute('quantity') || '0'),
        costBasis: parseFloat(node.getAttribute('costBasisMoney') || '0'),
        currency: node.getAttribute('currency') || 'EUR',
        assetType: node.getAttribute('assetCategory') || '',
      };

      if (pos.symbol && pos.openDate) {
        positions.push(pos);
      }
    });

    return positions;
  }

  /**
   * Konvertiert FlexQuery-Trades in unsere Trade-Modelle
   */
  static toEngineTrades(flexTrades: FlexQueryTrade[]): Trade[] {
    return flexTrades.map((ft, idx) => ({
      id: `flex-trade-${idx}`,
      assetClass: this.mapAssetType(ft.assetType, ft.symbol),
      symbol: ft.symbol,
      sellDate: ft.tradeDate,
      quantity: Math.abs(ft.quantity),
      sellPrice: ft.tradePrice,
      fees: Math.abs(ft.commFee),
    }));
  }

  /**
   * Konvertiert FlexQuery-Positionen in unsere Position-Modelle
   */
  static toEnginePositions(flexPositions: FlexQueryPosition[]): Position[] {
    return flexPositions.map((fp, idx) => ({
      id: `flex-pos-${idx}`,
      assetClass: this.mapAssetType(fp.assetType, fp.symbol),
      symbol: fp.symbol,
      buyDate: fp.openDate,
      quantity: fp.quantity,
      buyPrice: fp.costBasis / fp.quantity,
      fees: 0,
    }));
  }

  /**
   * Mappt IBKR Asset-Typen auf unsere AssetClass
   */
  private static mapAssetType(ibkrType: string, symbol: string): AssetClass {
    const type = ibkrType.toUpperCase();

    // Krypto-Erkennung
    if (symbol.endsWith('.USD') || symbol.endsWith('.USDT') || 
        ['BTC', 'ETH', 'XRP', 'LTC', 'BCH'].includes(symbol)) {
      return 'crypto' as AssetClass;
    }

    // Edelmetalle
    if (['XAU', 'XAG', 'XPT', 'GOLD', 'SILVER'].includes(symbol.substring(0, 3))) {
      return 'precious_metal' as AssetClass;
    }

    switch (type) {
      case 'STK':
      case 'ETF':
      case 'FUND':
        return 'equity' as AssetClass;
      case 'OPT':
      case 'FUT':
      case 'WAR':
      case 'CFD':
        return 'derivative' as AssetClass;
      case 'BOND':
        return 'bond' as AssetClass;
      default:
        return 'equity' as AssetClass; // Fallback
    }
  }
}
