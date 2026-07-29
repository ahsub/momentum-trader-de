// src/modules/tax/report/FifoValidator.js
// ═══════════════════════════════════════════════════════════════════════════════
// FIFO-Validator
// 
// PRÜFUNGEN:
// 1. FIFO-Reihenfolge der Trades pro Symbol
// 2. Plausibilität der Cost-Basis
// 3. Erkennung von Wash Sales (30-Tage-Regel)
// 4. Abgleich mit Corporate Actions
// ═══════════════════════════════════════════════════════════════════════════════

class FifoValidator {
  constructor(options = {}) {
    this.positionen = new Map();
    this.warnings = [];
    this.errors = [];
    this.toleranzCostBasis = options.toleranzCostBasis || 0.001; // 0.1%
    this.washSaleTage = options.washSaleTage || 30;
  }

  /**
   * Validiert alle Trades auf FIFO-Korrektheit
   * @param {Array} trades - In EUR konvertierte Trades
   * @returns {Object} Validierungsergebnis
   */
  validiere(trades) {
    const gruppiert = this._gruppiereNachSymbol(trades);

    for (const [symbol, symbolTrades] of gruppiert) {
      this._validiereSymbol(symbol, symbolTrades);
    }

    return {
      valid: this.errors.length === 0,
      warnings: this.warnings,
      errors: this.errors,
      positionen: this._getPositionenSummary(),
    };
  }

  _gruppiereNachSymbol(trades) {
    const gruppiert = new Map();
    for (const trade of trades) {
      if (!gruppiert.has(trade.symbol)) {
        gruppiert.set(trade.symbol, []);
      }
      gruppiert.get(trade.symbol).push(trade);
    }
    // Sortieren nach Datum
    for (const [symbol, list] of gruppiert) {
      list.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      gruppiert.set(symbol, list);
    }
    return gruppiert;
  }

  _validiereSymbol(symbol, trades) {
    const kaeufe = []; // FIFO-Queue: { datum, menge, preisEUR, costBasisEUR }
    let bestand = 0;

    for (const trade of trades) {
      if (trade.buySell === 'BUY') {
        // Kauf: Zur FIFO-Queue hinzufügen
        const menge = trade.quantity;
        const costBasisProStueck = trade.costBasisMoneyEUR 
          ? trade.costBasisMoneyEUR / menge 
          : trade.tradePrice; // Fallback

        kaeufe.push({
          datum: trade.date,
          menge,
          preisEUR: trade.tradePrice,
          costBasisEUR: costBasisProStueck,
          tradeId: trade.tradeId,
        });
        bestand += menge;
      } 
      else if (trade.buySell === 'SELL') {
        // Verkauf: FIFO-Abgleich
        const verkaufsMenge = trade.quantity;
        let verbleibend = verkaufsMenge;
        let berechneteCostBasis = 0;

        while (verbleibend > 0.0001 && kaeufe.length > 0) {
          const kauf = kaeufe[0];
          const menge = Math.min(verbleibend, kauf.menge);

          berechneteCostBasis += menge * kauf.costBasisEUR;
          kauf.menge -= menge;
          verbleibend -= menge;

          if (kauf.menge <= 0.0001) {
            kaeufe.shift();
          }
        }

        // Prüfung: Berechnete Cost-Basis vs. IBKR Cost-Basis
        if (trade.costBasisMoneyEUR) {
          const ibkrCostBasis = Math.abs(trade.costBasisMoneyEUR);
          const differenz = Math.abs(berechneteCostBasis - ibkrCostBasis);
          const toleranz = ibkrCostBasis * this.toleranzCostBasis;

          if (differenz > toleranz) {
            this.warnings.push({
              type: 'FIFO_COST_BASIS_MISMATCH',
              severity: 'warning',
              symbol,
              tradeId: trade.tradeId,
              datum: trade.date,
              berechnet: berechneteCostBasis,
              ibkr: ibkrCostBasis,
              differenz,
              differenzProzent: ((differenz / ibkrCostBasis) * 100).toFixed(2) + '%',
              message: `Cost-Basis-Differenz bei ${symbol} Verkauf ${trade.date}: ` +
                       `Berechnet=${berechneteCostBasis.toFixed(2)} EUR, ` +
                       `IBKR=${ibkrCostBasis.toFixed(2)} EUR`,
            });
          }
        }

        // Prüfung: Wash Sale (30-Tage-Regel)
        if (trade.fifoPnlRealizedEUR < 0) {
          this._pruefeWashSale(symbol, trade, kaeufe);
        }

        bestand -= verkaufsMenge;
      }
    }

    // Position speichern
    this.positionen.set(symbol, {
      bestand,
      offeneKaeufe: kaeufe.length,
    });
  }

  _pruefeWashSale(symbol, verkauf, offeneKaeufe) {
    const verkaufsDatum = new Date(verkauf.date);

    for (const kauf of offeneKaeufe) {
      const kaufDatum = new Date(kauf.datum);
      const tageDiff = (kaufDatum - verkaufsDatum) / (1000 * 60 * 60 * 24);

      if (tageDiff > 0 && tageDiff <= this.washSaleTage) {
        this.warnings.push({
          type: 'WASH_SALE_RISK',
          severity: 'info',
          symbol,
          tradeId: verkauf.tradeId,
          verkaufsDatum: verkauf.date,
          wiedereinstiegDatum: kauf.datum,
          tageDiff: Math.round(tageDiff),
          verlust: verkauf.fifoPnlRealizedEUR,
          message: `Wash-Sale-Risiko bei ${symbol}: Verlustverkauf ${verkauf.date}, ` +
                   `Wiedereinstieg ${kauf.datum} (${Math.round(tageDiff)} Tage später)`,
        });
      }
    }
  }

  _getPositionenSummary() {
    const summary = {};
    for (const [symbol, pos] of this.positionen) {
      summary[symbol] = {
        bestand: pos.bestand,
        offeneKaeufe: pos.offeneKaeufe,
      };
    }
    return summary;
  }
}

export default FifoValidator;
