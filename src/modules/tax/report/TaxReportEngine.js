// src/modules/tax/report/TaxReportEngine.js
// ═══════════════════════════════════════════════════════════════════════════════
// Tax Report Engine v2.0 — Mit Gemeinschaftskonto-Support
// ═══════════════════════════════════════════════════════════════════════════════
// 
// NEU in v2.0:
// 1. Gemeinschaftskonto: Unterstützt 1-2 Steuerpflichtige mit individueller KS
// 2. FlexQuery Währung: Erkennt ob P&L bereits in Basiswährung vorliegt
// 3. Warnungs-Deduplizierung: Gruppiert FX-Warnungen pro Währung/Tag

import FlexQueryParser from './FlexQueryParser.js';
import FxConverter from './FxConverter.js';
import FifoValidator from './FifoValidator.js';
import KapReportGenerator from './KapReportGenerator.js';

class TaxReportEngine {
  constructor(options = {}) {
    this.parser = new FlexQueryParser();
    this.fxConverter = new FxConverter(options.fx);
    this.fifoValidator = new FifoValidator(options.fifo);
    this.reportGenerator = new KapReportGenerator(options.report);
    this.warnings = [];
    this.errors = [];
    this.options = options;

    // Gemeinschaftskonto-Optionen
    this.isGemeinschaftskonto = options.isGemeinschaftskonto || false;
    this.personen = options.personen || [{ name: options.report?.steuerpflichtiger || 'Steuerpflichtiger', anteil: 1.0, kirchensteuerSatz: null }];
  }

  async generiereReport(xmlString, options = {}) {
    const parsed = await this.parser.parseXml(xmlString);

    // ═══ WÄHRUNGSANALYSE ═══
    // Prüfe ob FlexQuery bereits in Basiswährung (EUR) ausgibt
    const currencyAnalysis = this._analysiereWaehrungen(parsed.trades);

    // EZB-Kurse nur laden wenn nötig (nicht-EUR Trades ohne IBKR-Kurs)
    if (options.ezbKurseCsv && currencyAnalysis.benoetigtEZB) {
      await this.fxConverter.ladeEZBKurse(options.ezbKurseCsv);
    }

    const tradesEUR = parsed.trades.map(t => this.fxConverter.konvertiereTrade(t));
    const dividendsEUR = parsed.dividends.map(d => this.fxConverter.konvertiereDividende(d));
    const interestsEUR = parsed.interests.map(i => this.fxConverter.konvertiereDividende(i));

    // Deduplizierte Warnungen sammeln
    this.warnings.push(...this._dedupliziereWarnungen(this.fxConverter.getWarnungen()));

    const fifoResult = this.fifoValidator.validiere(tradesEUR);
    this.warnings.push(...fifoResult.warnings);
    this.errors.push(...fifoResult.errors);

    if (!fifoResult.valid) {
      throw new Error(`FIFO-Validierung fehlgeschlagen: ${this.errors.length} Fehler`);
    }

    // ═══ GEMEINSCHAFTSKONTO-LOGIK ═══
    let report;
    if (this.isGemeinschaftskonto && this.personen.length === 2) {
      report = this._generiereGemeinschaftsReport(tradesEUR, dividendsEUR, interestsEUR);
    } else {
      report = this.reportGenerator.generiereReport(tradesEUR, dividendsEUR, interestsEUR);
    }

    report.warnings = this.warnings;
    report.errors = this.errors;
    report.fifoValidation = fifoResult;
    report.waehrungsAnalyse = currencyAnalysis;

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. WÄHRUNGSANALYSE — Prüft ob EZB-Kurse nötig sind
  // ═══════════════════════════════════════════════════════════════════════════════
  _analysiereWaehrungen(trades) {
    if (!trades || trades.length === 0) {
      return { basiswaehrung: 'EUR', benoetigtEZB: false, fremdwaehrungen: [] };
    }

    const waehrungen = new Map();
    let mitFXRate = 0;
    let ohneFXRate = 0;

    for (const trade of trades) {
      const w = trade.currency || 'EUR';
      if (w !== 'EUR') {
        waehrungen.set(w, (waehrungen.get(w) || 0) + 1);
        if (trade.fxRateToBase && trade.fxRateToBase > 0) {
          mitFXRate++;
        } else {
          ohneFXRate++;
        }
      }
    }

    const fremdwaehrungen = Array.from(waehrungen.keys());
    const benoetigtEZB = fremdwaehrungen.length > 0 && ohneFXRate > 0;

    return {
      basiswaehrung: 'EUR',
      benoetigtEZB,
      fremdwaehrungen,
      mitFXRate,
      ohneFXRate,
      empfehlung: benoetigtEZB 
        ? 'EZB-Kurse empfohlen (einige Trades ohne IBKR-FX-Rate)'
        : fremdwaehrungen.length > 0 
          ? 'IBKR-FX-Raten ausreichend (EZB-Kurse optional für Validierung)'
          : 'Keine Fremdwährungen — EZB-Kurse nicht erforderlich',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. WARNUNGS-DEDUPLIZIERUNG — Gruppiert redundante FX-Warnungen
  // ═══════════════════════════════════════════════════════════════════════════════
  _dedupliziereWarnungen(warnungen) {
    const gruppiert = new Map();
    const dedupliziert = [];

    for (const w of warnungen) {
      const key = `${w.type}_${w.waehrung || 'unknown'}_${w.datum?.split(';')[0] || 'unknown'}`;

      if (w.type === 'FX_NICHT_VALIDIERT' || w.type === 'FX_FEHLEND') {
        if (!gruppiert.has(key)) {
          gruppiert.set(key, { ...w, anzahl: 1 });
        } else {
          gruppiert.get(key).anzahl++;
        }
      } else {
        dedupliziert.push(w);
      }
    }

    // Gruppierte Warnungen zusammenfassen
    for (const [, w] of gruppiert) {
      if (w.anzahl > 1) {
        dedupliziert.push({
          ...w,
          message: `${w.waehrung}: ${w.anzahl}x nicht validiert am ${w.datum?.split(';')[0]}`,
          gruppiert: true,
        });
      } else {
        dedupliziert.push(w);
      }
    }

    return dedupliziert;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. GEMEINSCHAFTSKONTO — Generiert Report für 2 Personen
  // ═══════════════════════════════════════════════════════════════════════════════
  _generiereGemeinschaftsReport(trades, dividends, interests) {
    const [personA, personB] = this.personen;

    // Trades anteilig aufteilen (default 50/50)
    const anteilA = personA.anteil || 0.5;
    const anteilB = personB.anteil || 0.5;

    const tradesA = trades.map(t => ({ ...t, fifoPnlRealizedEUR: (t.fifoPnlRealizedEUR || 0) * anteilA }));
    const tradesB = trades.map(t => ({ ...t, fifoPnlRealizedEUR: (t.fifoPnlRealizedEUR || 0) * anteilB }));

    const divA = dividends.map(d => ({ ...d, amountEUR: (d.amountEUR || 0) * anteilA }));
    const divB = dividends.map(d => ({ ...d, amountEUR: (d.amountEUR || 0) * anteilB }));

    // Separate Reports für jede Person
    const genA = new KapReportGenerator({
      jahr: this.options.report?.jahr,
      steuerpflichtiger: personA.name,
      broker: this.options.report?.broker,
    });

    const genB = new KapReportGenerator({
      jahr: this.options.report?.jahr,
      steuerpflichtiger: personB.name,
      broker: this.options.report?.broker,
    });

    const reportA = genA.generiereReport(tradesA, divA, interests);
    const reportB = genB.generiereReport(tradesB, divB, interests);

    // Kombinierter Report
    return {
      meta: {
        jahr: this.options.report?.jahr,
        broker: this.options.report?.broker,
        steuerabzug: 'Kein (ausländischer Broker)',
        erstelltAm: new Date().toISOString(),
        version: '2.0.0',
        gemeinschaftskonto: true,
      },
      personen: [
        { ...reportA, person: personA },
        { ...reportB, person: personB },
      ],
      zusammenfassung: {
        gesamtGewinn: (reportA.zusammenfassung?.gewinne?.gesamt || 0) + (reportB.zusammenfassung?.gewinne?.gesamt || 0),
        gesamtVerlust: (reportA.zusammenfassung?.verluste?.gesamt || 0) + (reportB.zusammenfassung?.verluste?.gesamt || 0),
        personA: reportA.zusammenfassung,
        personB: reportB.zusammenfassung,
      },
      // Fallback: Person A als Hauptreport für Legacy-Kompatibilität
      ...reportA,
    };
  }

  exportiere(report, format = 'json') {
    switch (format) {
      case 'json': return JSON.stringify(report, null, 2);
      case 'csv': return this._exportCSV(report);
      case 'csv-trades': return this._exportTradesCSV(report);
      case 'csv-gemeinschaft': return this._exportGemeinschaftCSV(report);
      default: throw new Error(`Unbekanntes Format: ${format}`);
    }
  }

  _exportTradesCSV(report) {
    const headers = ['Datum','Symbol','ISIN','AssetCategory','BuySell','Quantity','Price','Proceeds','Commission','PnL_Realized_Orig','PnL_Realized_EUR','Currency','FX_Rate_IBKR','FX_Quelle','FX_Warnung'];
    const allTrades = [];
    const tradeData = report.detailDaten?.trades;
    if (tradeData) {
      ['aktien','termingeschaefte','allgemein'].forEach(cat => {
        if (tradeData[cat]) {
          if (tradeData[cat].gewinne) allTrades.push(...tradeData[cat].gewinne);
          if (tradeData[cat].verluste) allTrades.push(...tradeData[cat].verluste);
        }
      });
    }
    const rows = allTrades.map(t => [t.date,t.symbol,t.isin,t.assetCategory,t.buySell,t.quantity,t.tradePrice,t.proceeds,t.commission,t.fifoPnlRealized,t.fifoPnlRealizedEUR?.toFixed(2)||'',t.currency,t.fxRateToBase,t.fifoPnlRealizedEURMeta?.quelle||'',t.fifoPnlRealizedEURMeta?.warnung||''].map(v=>`"${v}"`).join(';'));
    return [headers.join(';'),...rows].join('\n');
  }

  _exportCSV(report) {
    const lines = ['Kategorie;Wert;Hinweis'];
    lines.push(`Jahr;${report.meta?.jahr};`);
    lines.push(`Steuerpflichtiger;${report.meta?.steuerpflichtiger};`);
    lines.push(`Broker;${report.meta?.broker};`);

    if (report.zusammenfassung) {
      const z = report.zusammenfassung;
      lines.push(`Gewinne Aktien;${z.gewinne?.aktien?.betrag?.toFixed(2) || 0};${z.gewinne?.aktien?.anzahl || 0} Trades`);
      lines.push(`Gewinne Termingeschaefte;${z.gewinne?.termingeschaefte?.betrag?.toFixed(2) || 0};${z.gewinne?.termingeschaefte?.anzahl || 0} Trades`);
      lines.push(`Gewinne Allgemein;${z.gewinne?.allgemein?.betrag?.toFixed(2) || 0};${z.gewinne?.allgemein?.anzahl || 0} Trades`);
      lines.push(`Gewinne Gesamt;${z.gewinne?.gesamt?.toFixed(2) || 0};`);
      lines.push(`Verluste Aktien;${z.verluste?.aktien?.betrag?.toFixed(2) || 0};${z.verluste?.aktien?.anzahl || 0} Trades`);
      lines.push(`Verluste Termingeschaefte;${z.verluste?.termingeschaefte?.betrag?.toFixed(2) || 0};${z.verluste?.termingeschaefte?.anzahl || 0} Trades`);
      lines.push(`Verluste Allgemein;${z.verluste?.allgemein?.betrag?.toFixed(2) || 0};${z.verluste?.allgemein?.anzahl || 0} Trades`);
      lines.push(`Verluste Gesamt;${z.verluste?.gesamt?.toFixed(2) || 0};`);
      lines.push(`Saldo;${z.saldo?.toFixed(2) || 0};`);
      lines.push(`Steuer ohne Kirchensteuer;${z.steuer?.ohneKirchensteuer?.betrag?.toFixed(2) || 0};${z.steuer?.ohneKirchensteuer?.satz || ''}`);
      lines.push(`Steuer mit Kirchensteuer (9%);${z.steuer?.mitKirchensteuer9?.betrag?.toFixed(2) || 0};${z.steuer?.mitKirchensteuer9?.satz || ''}`);
      lines.push(`Steuer mit Kirchensteuer (8%);${z.steuer?.mitKirchensteuer8?.betrag?.toFixed(2) || 0};${z.steuer?.mitKirchensteuer8?.satz || ''}`);
      lines.push(`Verlustvortrag Aktien;${z.verlustvortraege?.AKTIEN?.toFixed(2) || 0};`);
      lines.push(`Verlustvortrag Allgemein;${z.verlustvortraege?.ALLGEMEIN?.toFixed(2) || 0};`);
      lines.push(`Verlustvortrag Termingeschaefte;${z.verlustvortraege?.TERMINGESCHAEFTE?.toFixed(2) || 0};`);
    }

    if (report.anlageKAP) {
      for (const [zeile, data] of Object.entries(report.anlageKAP)) {
        if (data.wert !== undefined) {
          lines.push(`Anlage KAP ${zeile};${typeof data.wert === 'number' ? data.wert.toFixed(2) : data.wert};${data.beschreibung}`);
        }
      }
    }

    return lines.join('\n');
  }

  _exportGemeinschaftCSV(report) {
    if (!report.personen || report.personen.length !== 2) {
      return this._exportCSV(report);
    }

    const lines = ['Kategorie;Person A;Person B;Gesamt'];
    const [a, b] = report.personen;

    lines.push(`Steuerpflichtiger;${a.person?.name || ''};${b.person?.name || ''};`);
    lines.push(`Anteil;${(a.person?.anteil || 0.5) * 100}%;${(b.person?.anteil || 0.5) * 100}%;`);
    lines.push(`Kirchensteuer;${a.person?.kirchensteuerSatz || 'keine'};${b.person?.kirchensteuerSatz || 'keine'};`);
    lines.push(`Gewinne;${a.zusammenfassung?.gewinne?.gesamt?.toFixed(2) || 0};${b.zusammenfassung?.gewinne?.gesamt?.toFixed(2) || 0};${report.zusammenfassung?.gesamtGewinn?.toFixed(2) || 0}`);
    lines.push(`Verluste;${a.zusammenfassung?.verluste?.gesamt?.toFixed(2) || 0};${b.zusammenfassung?.verluste?.gesamt?.toFixed(2) || 0};${report.zusammenfassung?.gesamtVerlust?.toFixed(2) || 0}`);
    lines.push(`Steuer ohne KS;${a.zusammenfassung?.steuer?.ohneKirchensteuer?.betrag?.toFixed(2) || 0};${b.zusammenfassung?.steuer?.ohneKirchensteuer?.betrag?.toFixed(2) || 0};`);

    return lines.join('\n');
  }
}

export default TaxReportEngine;
