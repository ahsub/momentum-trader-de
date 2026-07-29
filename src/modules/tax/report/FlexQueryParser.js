// src/modules/tax/report/FlexQueryParser.js
// ═══════════════════════════════════════════════════════════════════════════════
// Parst IBKR/CapTrader Flex-Query XML und extrahiert steuerrelevante Daten
// 
// WICHTIGE FELDER aus Flex-Query:
// - FifoPnlRealized: Realisierter Gewinn/Verlust nach FIFO
// - AssetCategory: STK, OPT, FUT, CFD, CASH, BOND, FUND etc.
// - Currency: Handelswährung
// - FxRateToBase: Wechselkurs zum Basiswährungstag
// - DateTime: Taggenauer Zeitstempel
// - Proceeds: Erlös
// - Commission: Gebühren
// - Multiplier: Kontraktgröße
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parst Flex-Query XML und extrahiert steuerrelevante Trades
 */
class FlexQueryParser {
  constructor() {
    this.trades = [];
    this.dividends = [];
    this.forexAdjustments = [];
    this.corporateActions = [];
    this.interests = [];
    this.withholdingTaxes = [];
  }

  /**
   * Parst Flex-Query XML-String
   * @param {string} xmlString - Flex-Query XML
   * @returns {Promise<Object>} Geparste Steuerdaten
   */
  async parseXml(xmlString) {
    const doc = this._parseXmlString(xmlString);

    // === TRADES SECTION ===
    const tradesSection = doc.querySelectorAll('Trades Trade');
    tradesSection.forEach(tradeNode => {
      const trade = this._extractTrade(tradeNode);
      if (trade.assetCategory !== 'CASH') {
        this.trades.push(trade);
      } else {
        this.forexAdjustments.push(this._extractForexAdjustment(tradeNode));
      }
    });

    // === CASH TRANSACTIONS (Dividenden, Zinsen, Steuern) ===
    const cashSection = doc.querySelectorAll('CashTransactions CashTransaction');
    cashSection.forEach(cashNode => {
      const cash = this._extractCashTransaction(cashNode);
      if (cash.type === 'Dividends') {
        this.dividends.push(cash);
      } else if (cash.type === 'Interest') {
        this.interests.push(cash);
      } else if (cash.type === 'Withholding Tax') {
        this.withholdingTaxes.push(cash);
      }
    });

    // === CORPORATE ACTIONS ===
    const corpSection = doc.querySelectorAll('CorporateActions CorporateAction');
    corpSection.forEach(corpNode => {
      this.corporateActions.push(this._extractCorporateAction(corpNode));
    });

    return this._buildResult();
  }

  _extractTrade(node) {
    const dateTime = node.getAttribute('dateTime') || '';
    const date = dateTime.split('T')[0] || '';

    return {
      tradeId: node.getAttribute('tradeID') || '',
      symbol: node.getAttribute('symbol') || '',
      isin: node.getAttribute('isin') || '',
      description: node.getAttribute('description') || '',

      // Asset-Klassifikation
      assetCategory: node.getAttribute('assetCategory') || 'STK',
      subCategory: node.getAttribute('subCategory') || '',

      // Trade-Details
      buySell: node.getAttribute('buySell') || '',
      quantity: parseFloat(node.getAttribute('quantity') || 0),
      tradePrice: parseFloat(node.getAttribute('tradePrice') || 0),
      proceeds: parseFloat(node.getAttribute('proceeds') || 0),
      commission: parseFloat(node.getAttribute('commission') || 0),
      commissionTax: parseFloat(node.getAttribute('commissionTax') || 0),
      multiplier: parseFloat(node.getAttribute('multiplier') || 1),

      // FIFO & P&L
      fifoPnlRealized: parseFloat(node.getAttribute('fifoPnlRealized') || 0),
      fifoPnlUnrealized: parseFloat(node.getAttribute('fifoPnlUnrealized') || 0),
      costBasisMoney: parseFloat(node.getAttribute('costBasisMoney') || 0),

      // Währung & Kurs
      currency: node.getAttribute('currency') || 'USD',
      fxRateToBase: parseFloat(node.getAttribute('fxRateToBase') || 1),
      fxPnl: parseFloat(node.getAttribute('fxPnl') || 0),

      // Datum
      dateTime,
      date,
      year: date ? parseInt(date.split('-')[0]) : 0,

      // Order-Details
      orderType: node.getAttribute('orderType') || '',
      exchange: node.getAttribute('exchange') || '',

      // Öffnen/Schließen
      openCloseIndicator: node.getAttribute('openCloseIndicator') || '',
    };
  }

  _extractCashTransaction(node) {
    const dateTime = node.getAttribute('dateTime') || '';

    return {
      type: node.getAttribute('type') || '',
      symbol: node.getAttribute('symbol') || '',
      isin: node.getAttribute('isin') || '',
      amount: parseFloat(node.getAttribute('amount') || 0),
      currency: node.getAttribute('currency') || 'USD',
      fxRateToBase: parseFloat(node.getAttribute('fxRateToBase') || 1),
      dateTime,
      date: dateTime.split('T')[0] || '',
      description: node.getAttribute('description') || '',
      withholdingTax: parseFloat(node.getAttribute('withholdingTax') || 0),
      tradeId: node.getAttribute('tradeID') || '',
    };
  }

  _extractForexAdjustment(node) {
    const dateTime = node.getAttribute('dateTime') || '';

    return {
      tradeId: node.getAttribute('tradeID') || '',
      symbol: node.getAttribute('symbol') || '',
      realizedPnl: parseFloat(node.getAttribute('fifoPnlRealized') || 0),
      currency: node.getAttribute('currency') || '',
      fxRateToBase: parseFloat(node.getAttribute('fxRateToBase') || 1),
      dateTime,
      date: dateTime.split('T')[0] || '',
      description: node.getAttribute('description') || '',
    };
  }

  _extractCorporateAction(node) {
    const dateTime = node.getAttribute('dateTime') || '';

    return {
      actionId: node.getAttribute('actionID') || '',
      type: node.getAttribute('type') || '',
      symbol: node.getAttribute('symbol') || '',
      isin: node.getAttribute('isin') || '',
      quantity: parseFloat(node.getAttribute('quantity') || 0),
      proceeds: parseFloat(node.getAttribute('proceeds') || 0),
      fifoPnlRealized: parseFloat(node.getAttribute('fifoPnlRealized') || 0),
      dateTime,
      date: dateTime.split('T')[0] || '',
      description: node.getAttribute('description') || '',
    };
  }

  _buildResult() {
    return {
      trades: this.trades,
      dividends: this.dividends,
      interests: this.interests,
      forexAdjustments: this.forexAdjustments,
      corporateActions: this.corporateActions,
      withholdingTaxes: this.withholdingTaxes,
      summary: {
        totalTrades: this.trades.length,
        totalDividends: this.dividends.length,
        totalInterests: this.interests.length,
        totalForexAdjustments: this.forexAdjustments.length,
        totalCorporateActions: this.corporateActions.length,
        years: [...new Set(this.trades.map(t => t.year))].sort(),
      }
    };
  }

  _parseXmlString(xmlString) {
    if (typeof DOMParser !== 'undefined') {
      return new DOMParser().parseFromString(xmlString, 'text/xml');
    }
    throw new Error('DOMParser nicht verfügbar. Verwende xml2js in Node.js.');
  }
}

export default FlexQueryParser;
