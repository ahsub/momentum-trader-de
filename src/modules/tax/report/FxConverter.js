// src/modules/tax/report/FxConverter.js
// ═══════════════════════════════════════════════════════════════════════════════
// Währungskonverter für Steuerreports
// 
// ANFORDERUNGEN:
// 1. Alle Beträge müssen in Euro umgerechnet werden
// 2. Wechselkurs muss taggenau sein
// 3. Validierung gegen EZB-Referenzkurse
// 4. Bei Abweichungen > 1% Warnung ausgeben
// ═══════════════════════════════════════════════════════════════════════════════

class FxConverter {
  constructor(options = {}) {
    this.ezbKurse = new Map();
    this.toleranz = options.toleranz || 0.01;
    this.useIBKRRate = options.useIBKRRate !== false;
    this.warnungen = [];
  }

  /**
   * Lädt EZB-Referenzkurse aus CSV
   * Quelle: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip
   * Format: Date,USD,JPY,GBP,...
   */
  async ladeEZBKurse(csvData) {
    const lines = csvData.split('\n');
    if (lines.length < 2) return;

    const header = lines[0].split(',').map(h => h.trim());

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const date = cols[0]?.trim();
      if (!date) continue;

      for (let j = 1; j < header.length; j++) {
        const waehrung = header[j];
        const kurs = parseFloat(cols[j]);
        if (!isNaN(kurs) && kurs > 0) {
          this.ezbKurse.set(`${date}:${waehrung}`, kurs);
        }
      }
    }
  }

  /**
   * Konvertiert einen Betrag in Euro
   * @param {number} betrag - Betrag in Fremdwährung
   * @param {string} waehrung - Fremdwährung (USD, CHF, etc.)
   * @param {string} datum - Datum im Format YYYY-MM-DD
   * @param {number} ibkrKurs - Optional: IBKR-Kurs zum Vergleich
   * @returns {Object} Konvertierter Betrag + Metadaten
   */
  konvertiereNachEuro(betrag, waehrung, datum, ibkrKurs = null) {
    if (waehrung === 'EUR' || waehrung === 'EU') {
      return {
        betragEUR: betrag,
        kurs: 1,
        quelle: 'EUR',
        validiert: true,
        warnung: null,
        original: { betrag, waehrung, datum },
      };
    }

    const schluessel = `${datum}:${waehrung}`;
    const ezbKurs = this.ezbKurse.get(schluessel);

    let verwendeterKurs;
    let quelle;
    let warnung = null;

    if (ezbKurs && ibkrKurs) {
      const abweichung = Math.abs(ezbKurs - ibkrKurs) / ezbKurs;

      if (abweichung > this.toleranz) {
        warnung = `Wechselkurs-Abweichung > ${(this.toleranz * 100).toFixed(1)}%: ` +
                  `EZB=${ezbKurs.toFixed(6)}, IBKR=${ibkrKurs.toFixed(6)} ` +
                  `(${datum}, ${waehrung})`;
        verwendeterKurs = ezbKurs;
        quelle = 'EZB (IBKR abweichend)';
        this.warnungen.push({ type: 'FX_ABWEICHUNG', datum, waehrung, ezbKurs, ibkrKurs, abweichung });
      } else {
        verwendeterKurs = this.useIBKRRate ? ibkrKurs : ezbKurs;
        quelle = this.useIBKRRate ? 'IBKR (validiert)' : 'EZB';
      }
    } else if (ezbKurs) {
      verwendeterKurs = ezbKurs;
      quelle = 'EZB';
    } else if (ibkrKurs) {
      verwendeterKurs = ibkrKurs;
      quelle = 'IBKR (nicht validiert)';
      warnung = `Kein EZB-Kurs für ${datum}/${waehrung}. Verwende IBKR-Kurs.`;
      this.warnungen.push({ type: 'FX_NICHT_VALIDIERT', datum, waehrung, ibkrKurs });
    } else {
      const fehler = `Kein Wechselkurs verfügbar für ${datum}/${waehrung}`;
      this.warnungen.push({ type: 'FX_FEHLEND', datum, waehrung });
      throw new Error(fehler);
    }

    // EZB-Kurse sind EUR/FX (z.B. 1 EUR = 1.08 USD)
    // Umrechnung: Betrag in FX / Kurs = Betrag in EUR
    const betragEUR = betrag / verwendeterKurs;

    return {
      betragEUR,
      kurs: verwendeterKurs,
      quelle,
      validiert: !!ezbKurs,
      warnung,
      original: { betrag, waehrung, datum },
    };
  }

  /**
   * Konvertiert einen kompletten Trade nach Euro
   */
  konvertiereTrade(trade) {
    const result = { ...trade };

    // Realized P&L in EUR
    const pnlEUR = this.konvertiereNachEuro(
      trade.fifoPnlRealized,
      trade.currency,
      trade.date,
      trade.fxRateToBase
    );
    result.fifoPnlRealizedEUR = pnlEUR.betragEUR;
    result.fifoPnlRealizedEURMeta = {
      kurs: pnlEUR.kurs,
      quelle: pnlEUR.quelle,
      validiert: pnlEUR.validiert,
      warnung: pnlEUR.warnung,
    };

    // Proceeds in EUR
    const proceedsEUR = this.konvertiereNachEuro(
      trade.proceeds,
      trade.currency,
      trade.date,
      trade.fxRateToBase
    );
    result.proceedsEUR = proceedsEUR.betragEUR;

    // Commission in EUR
    const commissionEUR = this.konvertiereNachEuro(
      trade.commission,
      trade.currency,
      trade.date,
      trade.fxRateToBase
    );
    result.commissionEUR = commissionEUR.betragEUR;

    // Cost Basis in EUR
    if (trade.costBasisMoney) {
      const costBasisEUR = this.konvertiereNachEuro(
        trade.costBasisMoney,
        trade.currency,
        trade.date,
        trade.fxRateToBase
      );
      result.costBasisMoneyEUR = costBasisEUR.betragEUR;
    }

    return result;
  }

  /**
   * Konvertiert Dividende nach Euro
   */
  konvertiereDividende(dividende) {
    const result = { ...dividende };

    const amountEUR = this.konvertiereNachEuro(
      dividende.amount,
      dividende.currency,
      dividende.date,
      dividende.fxRateToBase
    );
    result.amountEUR = amountEUR.betragEUR;
    result.amountEURMeta = {
      kurs: amountEUR.kurs,
      quelle: amountEUR.quelle,
      validiert: amountEUR.validiert,
      warnung: amountEUR.warnung,
    };

    if (dividende.withholdingTax) {
      const taxEUR = this.konvertiereNachEuro(
        dividende.withholdingTax,
        dividende.currency,
        dividende.date,
        dividende.fxRateToBase
      );
      result.withholdingTaxEUR = taxEUR.betragEUR;
    }

    return result;
  }

  /**
   * Gibt alle Warnungen aus
   */
  getWarnungen() {
    return [...this.warnungen];
  }

  resetWarnungen() {
    this.warnungen = [];
  }
}

export default FxConverter;
