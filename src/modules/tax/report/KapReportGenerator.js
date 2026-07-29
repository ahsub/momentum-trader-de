// src/modules/tax/report/KapReportGenerator.js
// ═══════════════════════════════════════════════════════════════════════════════
// Generiert Anlage KAP Zeilen-Mapping und Steuerzusammenfassung
// 
// AUSGABE:
// a) Zeilen-Mapping für Anlage KAP (mit/ohne Kirchensteuer)
// b) Zusammenfassung der Kapitalerträge und -verluste
// ═══════════════════════════════════════════════════════════════════════════════

import TaxEngine from '../TaxEngine.js';
import { VERLUST_TOEPFE } from '../taxConfig.js';
import { mapSecTypeToKategorie, VERLUSTTOPF_MAPPING } from '../instrumentTypes.js';

class KapReportGenerator {
  constructor(options = {}) {
    this.options = options;
    this.jahr = options.jahr || new Date().getFullYear();
    this.steuerpflichtiger = options.steuerpflichtiger || 'Steuerpflichtiger';
    this.broker = options.broker || 'CapTrader (Interactive Brokers)';
  }

  /**
   * Generiert kompletten Steuerreport
   * @param {Array} trades - In EUR konvertierte Trades
   * @param {Array} dividends - In EUR konvertierte Dividenden
   * @param {Array} interests - In EUR konvertierte Zinsen
   * @returns {Object} Kompletter Steuerreport
   */
  generiereReport(trades, dividends = [], interests = []) {
    // === 1. TRADES NACH KATEGORIEN GRUPPIEREN ===
    const kategorisiert = this._kategorisiereTrades(trades);

    // === 2. STEUER BERECHNEN (ohne Kirchensteuer) ===
    const engineOhneKirche = new TaxEngine({
      kirchensteuerSatz: null,
      sparerPauschbetrag: 0,
    });
    const steuerOhneKirche = this._berechneSteuerFuerEngine(kategorisiert, engineOhneKirche);

    // === 3. STEUER BERECHNEN (mit Kirchensteuer 9%) ===
    const engineMitKirche9 = new TaxEngine({
      kirchensteuerSatz: 'rest',
      sparerPauschbetrag: 0,
    });
    const steuerMitKirche9 = this._berechneSteuerFuerEngine(kategorisiert, engineMitKirche9);

    // === 4. STEUER BERECHNEN (mit Kirchensteuer 8%) ===
    const engineMitKirche8 = new TaxEngine({
      kirchensteuerSatz: 'bwBayern',
      sparerPauschbetrag: 0,
    });
    const steuerMitKirche8 = this._berechneSteuerFuerEngine(kategorisiert, engineMitKirche8);

    // === 5. ANLAGE KAP ZEILEN MAPPING ===
    const anlageKap = this._mappeAnlageKap(kategorisiert);

    // === 6. ZUSAMMENFASSUNG ===
    const zusammenfassung = this._erstelleZusammenfassung(
      kategorisiert, 
      steuerOhneKirche,
      steuerMitKirche9,
      steuerMitKirche8,
      engineOhneKirche
    );

    return {
      meta: {
        jahr: this.jahr,
        steuerpflichtiger: this.steuerpflichtiger,
        broker: this.broker,
        steuerabzug: 'Kein (ausländischer Broker)',
        erstelltAm: new Date().toISOString(),
        version: '1.0.0',
      },
      anlageKAP: anlageKap,
      zusammenfassung,
      detailDaten: {
        trades: kategorisiert,
        dividends,
        interests,
        verlusttoepfe: engineOhneKirche.getVerlustToepfe(),
      },
    };
  }

  _kategorisiereTrades(trades) {
    const result = {
      aktien: { 
        gewinne: [], verluste: [], 
        summeGewinn: 0, summeVerlust: 0, 
        anzahlGewinne: 0, anzahlVerluste: 0 
      },
      termingeschaefte: { 
        gewinne: [], verluste: [], 
        summeGewinn: 0, summeVerlust: 0,
        anzahlGewinne: 0, anzahlVerluste: 0
      },
      allgemein: { 
        gewinne: [], verluste: [], 
        summeGewinn: 0, summeVerlust: 0,
        anzahlGewinne: 0, anzahlVerluste: 0
      },
    };

    for (const trade of trades) {
      const assetCat = trade.assetCategory;
      let kategorie;

      if (assetCat === 'STK') {
        kategorie = 'aktien';
      } else if (['OPT', 'FOP', 'FUT', 'CFD', 'WAR'].includes(assetCat)) {
        kategorie = 'termingeschaefte';
      } else {
        kategorie = 'allgemein';
      }

      const pnl = trade.fifoPnlRealizedEUR || 0;
      const isGewinn = pnl >= 0;

      if (isGewinn) {
        result[kategorie].gewinne.push(trade);
        result[kategorie].summeGewinn += pnl;
        result[kategorie].anzahlGewinne += 1;
      } else {
        result[kategorie].verluste.push(trade);
        result[kategorie].summeVerlust += Math.abs(pnl);
        result[kategorie].anzahlVerluste += 1;
      }
    }

    return result;
  }

  _berechneSteuerFuerEngine(kategorisiert, engine) {
    // Verluste zuerst verbuchen
    for (const trade of kategorisiert.aktien.verluste) {
      engine.verbucheVerlust(Math.abs(trade.fifoPnlRealizedEUR || 0), 'STK');
    }
    for (const trade of kategorisiert.termingeschaefte.verluste) {
      engine.verbucheVerlust(Math.abs(trade.fifoPnlRealizedEUR || 0), 'CFD');
    }
    for (const trade of kategorisiert.allgemein.verluste) {
      engine.verbucheVerlust(Math.abs(trade.fifoPnlRealizedEUR || 0), 'ETF');
    }

    // Dann Gewinne berechnen
    const ergebnisse = [];

    for (const trade of kategorisiert.aktien.gewinne) {
      ergebnisse.push(engine.berechneSteuer({
        realizedPnl: trade.fifoPnlRealizedEUR || 0,
        secType: 'STK',
      }));
    }
    for (const trade of kategorisiert.termingeschaefte.gewinne) {
      ergebnisse.push(engine.berechneSteuer({
        realizedPnl: trade.fifoPnlRealizedEUR || 0,
        secType: trade.assetCategory,
      }));
    }
    for (const trade of kategorisiert.allgemein.gewinne) {
      ergebnisse.push(engine.berechneSteuer({
        realizedPnl: trade.fifoPnlRealizedEUR || 0,
        secType: trade.assetCategory,
      }));
    }

    return ergebnisse;
  }

  _mappeAnlageKap(kategorisiert) {
    const gesamtGewinn = kategorisiert.aktien.summeGewinn + 
                         kategorisiert.termingeschaefte.summeGewinn + 
                         kategorisiert.allgemein.summeGewinn;

    const gesamtVerlust = kategorisiert.aktien.summeVerlust + 
                          kategorisiert.termingeschaefte.summeVerlust + 
                          kategorisiert.allgemein.summeVerlust;

    return {
      // ─── ANTRÄGE ─────────────────────────────────────────────────────────────
      zeile4: {
        beschreibung: 'Antrag auf Günstigerprüfung',
        wert: false,
        hinweis: 'Nur setzen wenn persönlicher Einkommensteuersatz < 25%',
        pflichtfeld: false,
      },
      zeile5: {
        beschreibung: 'Überprüfung des Steuereinbehalts',
        wert: false,
        hinweis: 'Nur bei deutschem Broker relevant',
        pflichtfeld: false,
      },
      zeile6: {
        beschreibung: 'Kirchensteuerpflicht',
        wert: false,
        hinweis: 'Wenn zutreffend, in Zeile 6 ankreuzen',
        pflichtfeld: false,
      },

      // ─── KAPITALERTRÄGE OHNE STEUERABZUG (Hauptbereich für CapTrader) ────────
      zeile7: {
        beschreibung: 'Kapitalerträge (Gewinne, Dividenden, Zinsen)',
        wert: gesamtGewinn,
        aufschluesselung: {
          aktien: kategorisiert.aktien.summeGewinn,
          termingeschaefte: kategorisiert.termingeschaefte.summeGewinn,
          allgemein: kategorisiert.allgemein.summeGewinn,
        },
        hinweis: 'Summe aller Kapitalerträge aus dem Auslandsdepot',
        pflichtfeld: true,
      },
      zeile8: {
        beschreibung: 'Gewinne aus Aktienveräußerungen',
        wert: kategorisiert.aktien.summeGewinn,
        hinweis: 'Teil von Zeile 7, separat auszuweisen',
        pflichtfeld: true,
      },
      zeile15: {
        beschreibung: 'Verluste aus Aktienveräußerungen',
        wert: kategorisiert.aktien.summeVerlust,
        hinweis: 'Nur gegen Aktiengewinne verrechenbar',
        pflichtfeld: true,
      },
      zeile19: {
        beschreibung: 'Kapitalerträge Auslandsdepot',
        wert: gesamtGewinn,
        wichtig: true,
        hinweis: 'HAUPTZEILE für CapTrader! Alle Erträge hier eintragen.',
        pflichtfeld: true,
      },
      zeile25: {
        beschreibung: 'Sonstige Verluste (Termingeschäfte)',
        wert: kategorisiert.termingeschaefte.summeVerlust,
        hinweis: '§20 Abs. 2 Nr. 3 EStG: Optionen, Futures, CFDs, Zertifikate, Devisen',
        pflichtfeld: true,
      },

      // ─── SPARERPAUSCHBETRAG ──────────────────────────────────────────────────
      zeile16: {
        beschreibung: 'In Anspruch genommener Sparerpauschbetrag',
        wert: 0,
        hinweis: 'CapTrader: Kein Freistellungsauftrag möglich. In Steuererklärung geltend machen.',
        pflichtfeld: false,
      },

      // ─── STEUERABZUGSBERTRÄGE (bei CapTrader: immer 0) ───────────────────────
      zeile37: { 
        beschreibung: 'Kapitalertragsteuer (einbehalten)', 
        wert: 0,
        hinweis: 'Ausländischer Broker: Kein Steuerabzug',
        pflichtfeld: true,
      },
      zeile38: { 
        beschreibung: 'Solidaritätszuschlag (einbehalten)', 
        wert: 0,
        hinweis: 'Ausländischer Broker: Kein Steuerabzug',
        pflichtfeld: true,
      },
      zeile39: { 
        beschreibung: 'Kirchensteuer (einbehalten)', 
        wert: 0,
        hinweis: 'Ausländischer Broker: Kein Steuerabzug',
        pflichtfeld: true,
      },
      zeile40: { 
        beschreibung: 'Angerechnete ausländische Steuer', 
        wert: 0,
        hinweis: 'Quellensteuer ggf. in Steuererklärung geltend machen',
        pflichtfeld: false,
      },
      zeile41: {
        beschreibung: 'Anrechenbare noch nicht angerechnete ausländische Steuer',
        wert: 0,
        hinweis: 'Für Verlustvortrag in Folgejahre',
        pflichtfeld: false,
      },
    };
  }

  _erstelleZusammenfassung(kategorisiert, steuerOhne, steuerMit9, steuerMit8, engine) {
    const gesamtGewinn = kategorisiert.aktien.summeGewinn + 
                         kategorisiert.termingeschaefte.summeGewinn + 
                         kategorisiert.allgemein.summeGewinn;

    const gesamtVerlust = kategorisiert.aktien.summeVerlust + 
                          kategorisiert.termingeschaefte.summeVerlust + 
                          kategorisiert.allgemein.summeVerlust;

    const steuerOhneSumme = steuerOhne.reduce((sum, s) => sum + (s.steuerNetto || 0), 0);
    const steuerMit9Summe = steuerMit9.reduce((sum, s) => sum + (s.steuerNetto || 0), 0);
    const steuerMit8Summe = steuerMit8.reduce((sum, s) => sum + (s.steuerNetto || 0), 0);

    return {
      gewinne: {
        gesamt: gesamtGewinn,
        aktien: {
          betrag: kategorisiert.aktien.summeGewinn,
          anzahl: kategorisiert.aktien.anzahlGewinne,
        },
        termingeschaefte: {
          betrag: kategorisiert.termingeschaefte.summeGewinn,
          anzahl: kategorisiert.termingeschaefte.anzahlGewinne,
        },
        allgemein: {
          betrag: kategorisiert.allgemein.summeGewinn,
          anzahl: kategorisiert.allgemein.anzahlGewinne,
        },
      },
      verluste: {
        gesamt: gesamtVerlust,
        aktien: {
          betrag: kategorisiert.aktien.summeVerlust,
          anzahl: kategorisiert.aktien.anzahlVerluste,
        },
        termingeschaefte: {
          betrag: kategorisiert.termingeschaefte.summeVerlust,
          anzahl: kategorisiert.termingeschaefte.anzahlVerluste,
        },
        allgemein: {
          betrag: kategorisiert.allgemein.summeVerlust,
          anzahl: kategorisiert.allgemein.anzahlVerluste,
        },
      },
      saldo: gesamtGewinn - gesamtVerlust,
      steuer: {
        ohneKirchensteuer: {
          betrag: steuerOhneSumme,
          satz: '26,375%',
          satzNummerisch: 0.26375,
        },
        mitKirchensteuer9: {
          betrag: steuerMit9Summe,
          satz: '27,99%',
          satzNummerisch: 0.2799,
          bundesland: 'Rest-Deutschland (9%)',
        },
        mitKirchensteuer8: {
          betrag: steuerMit8Summe,
          satz: '27,82%',
          satzNummerisch: 0.2782,
          bundesland: 'Baden-Württemberg / Bayern (8%)',
        },
      },
      verlustvortraege: engine.getVerlustToepfe(),
    };
  }
}

export default KapReportGenerator;
