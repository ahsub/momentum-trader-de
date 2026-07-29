// src/modules/tax/report/TaxReportEngine.js
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
  }

  async generiereReport(xmlString, options = {}) {
    const parsed = await this.parser.parseXml(xmlString);
    if (options.ezbKurseCsv) {
      await this.fxConverter.ladeEZBKurse(options.ezbKurseCsv);
    }
    const tradesEUR = parsed.trades.map(t => this.fxConverter.konvertiereTrade(t));
    const dividendsEUR = parsed.dividends.map(d => this.fxConverter.konvertiereDividende(d));
    const interestsEUR = parsed.interests.map(i => this.fxConverter.konvertiereDividende(i));
    this.warnings.push(...this.fxConverter.getWarnungen());
    const fifoResult = this.fifoValidator.validiere(tradesEUR);
    this.warnings.push(...fifoResult.warnings);
    this.errors.push(...fifoResult.errors);
    if (!fifoResult.valid) {
      throw new Error(`FIFO-Validierung fehlgeschlagen: ${this.errors.length} Fehler`);
    }
    const report = this.reportGenerator.generiereReport(tradesEUR, dividendsEUR, interestsEUR);
    report.warnings = this.warnings;
    report.errors = this.errors;
    report.fifoValidation = fifoResult;
    return report;
  }

  exportiere(report, format = 'json') {
    switch (format) {
      case 'json': return JSON.stringify(report, null, 2);
      case 'csv': return this._exportCSV(report);
      case 'csv-trades': return this._exportTradesCSV(report);
      default: throw new Error(`Unbekanntes Format: ${format}`);
    }
  }

  _exportTradesCSV(report) {
    const headers = ['Datum','Symbol','ISIN','AssetCategory','BuySell','Quantity','Price','Proceeds','Commission','PnL_Realized_Orig','PnL_Realized_EUR','Currency','FX_Rate_IBKR','FX_Quelle','FX_Warnung'];
    const allTrades = [];
    const tradeData = report.detailDaten.trades;
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
    lines.push(`Jahr;${report.meta.jahr};`);
    lines.push(`Steuerpflichtiger;${report.meta.steuerpflichtiger};`);
    lines.push(`Broker;${report.meta.broker};`);
    lines.push(`Gewinne Aktien;${report.zusammenfassung.gewinne.aktien.betrag.toFixed(2)};${report.zusammenfassung.gewinne.aktien.anzahl} Trades`);
    lines.push(`Gewinne Termingeschaefte;${report.zusammenfassung.gewinne.termingeschaefte.betrag.toFixed(2)};${report.zusammenfassung.gewinne.termingeschaefte.anzahl} Trades`);
    lines.push(`Gewinne Allgemein;${report.zusammenfassung.gewinne.allgemein.betrag.toFixed(2)};${report.zusammenfassung.gewinne.allgemein.anzahl} Trades`);
    lines.push(`Gewinne Gesamt;${report.zusammenfassung.gewinne.gesamt.toFixed(2)};`);
    lines.push(`Verluste Aktien;${report.zusammenfassung.verluste.aktien.betrag.toFixed(2)};${report.zusammenfassung.verluste.aktien.anzahl} Trades`);
    lines.push(`Verluste Termingeschaefte;${report.zusammenfassung.verluste.termingeschaefte.betrag.toFixed(2)};${report.zusammenfassung.verluste.termingeschaefte.anzahl} Trades`);
    lines.push(`Verluste Allgemein;${report.zusammenfassung.verluste.allgemein.betrag.toFixed(2)};${report.zusammenfassung.verluste.allgemein.anzahl} Trades`);
    lines.push(`Verluste Gesamt;${report.zusammenfassung.verluste.gesamt.toFixed(2)};`);
    lines.push(`Saldo;${report.zusammenfassung.saldo.toFixed(2)};`);
    lines.push(`Steuer ohne Kirchensteuer;${report.zusammenfassung.steuer.ohneKirchensteuer.betrag.toFixed(2)};${report.zusammenfassung.steuer.ohneKirchensteuer.satz}`);
    lines.push(`Steuer mit Kirchensteuer (9%);${report.zusammenfassung.steuer.mitKirchensteuer9.betrag.toFixed(2)};${report.zusammenfassung.steuer.mitKirchensteuer9.satz}`);
    lines.push(`Steuer mit Kirchensteuer (8%);${report.zusammenfassung.steuer.mitKirchensteuer8.betrag.toFixed(2)};${report.zusammenfassung.steuer.mitKirchensteuer8.satz}`);
    lines.push(`Verlustvortrag Aktien;${report.zusammenfassung.verlustvortraege.AKTIEN.toFixed(2)};`);
    lines.push(`Verlustvortrag Allgemein;${report.zusammenfassung.verlustvortraege.ALLGEMEIN.toFixed(2)};`);
    lines.push(`Verlustvortrag Termingeschaefte;${report.zusammenfassung.verlustvortraege.TERMINGESCHAEFTE.toFixed(2)};`);
    for (const [zeile, data] of Object.entries(report.anlageKAP)) {
      if (data.wert !== undefined) {
        lines.push(`Anlage KAP ${zeile};${typeof data.wert === 'number' ? data.wert.toFixed(2) : data.wert};${data.beschreibung}`);
      }
    }
    return lines.join('\n');
  }
}

export default TaxReportEngine;
