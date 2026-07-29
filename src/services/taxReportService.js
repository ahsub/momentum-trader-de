// src/services/taxReportService.js
// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTER: Alte API → Neue TaxEngine
// 
// Dieser Service stellt die alte API bereit, nutzt intern aber die neue
// modulare TaxEngine aus src/modules/tax/
// 
// WICHTIG: Dies ist ein Übergangs-Adapter. Langfristig sollten die
// Komponenten direkt auf die neue API umgestellt werden.
// ═══════════════════════════════════════════════════════════════════════════════

import TaxReportEngine from '../modules/tax/report/TaxReportEngine.js';
import TaxEngine from '../modules/tax/TaxEngine.js';

/**
 * Legacy-Adapter für taxReportService
 * Stellt die alte API bereit, nutzt intern die neue TaxEngine
 */
class TaxReportService {
  constructor() {
    this.engine = null;
    this.report = null;
  }

  /**
   * Legacy: Steuerreport aus Flex-Query XML generieren
   * @param {string} xmlString - Flex-Query XML
   * @param {Object} options - Steuerpflichtiger-Info etc.
   */
  async generateTaxReport(xmlString, options = {}) {
    const reportEngine = new TaxReportEngine({
      report: {
        jahr: options.year || new Date().getFullYear(),
        steuerpflichtiger: options.taxpayerName || 'Steuerpflichtiger',
        broker: 'CapTrader (Interactive Brokers)',
      },
      fx: { toleranz: 0.01 },
      fifo: { toleranzCostBasis: 0.001 },
    });

    this.report = await reportEngine.generiereReport(xmlString);
    return this._mapToLegacyFormat(this.report);
  }

  /**
   * Legacy: Steuerberechnung für einzelnen Trade
   */
  calculateTradeTax({ realizedPnl, secType, assetType, fondsCategory, quellensteuer }) {
    const engine = new TaxEngine({
      kirchensteuerSatz: null,
      sparerPauschbetrag: 0,
    });

    return engine.berechneSteuer({
      realizedPnl,
      secType,
      assetTyp: assetType,
      fondsCategory,
      quellensteuer,
    });
  }

  /**
   * Legacy: Verlusttopf-Stand abfragen
   */
  getVerlustToepfe() {
    if (!this.report) return { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 };
    return this.report.detailDaten.verlusttoepfe;
  }

  /**
   * Legacy: Jahresstatistik
   */
  getJahresStatistik() {
    if (!this.report) return null;
    return this.report.zusammenfassung;
  }

  /**
   * Legacy: Anlage KAP Zeilen
   */
  getAnlageKapZeilen() {
    if (!this.report) return null;
    return this.report.anlageKAP;
  }

  /**
   * Legacy: Export als CSV
   */
  exportCSV() {
    if (!this.report) return '';
    const reportEngine = new TaxReportEngine();
    return reportEngine.exportiere(this.report, 'csv');
  }

  /**
   * Legacy: Export als JSON
   */
  exportJSON() {
    if (!this.report) return '{}';
    const reportEngine = new TaxReportEngine();
    return reportEngine.exportiere(this.report, 'json');
  }

  /**
   * Legacy: Persistenz (localStorage)
   */
  saveToStorage(year, data) {
    const key = `mt_tax_year_data`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing[year] = data;
    localStorage.setItem(key, JSON.stringify(existing));
  }

  loadFromStorage(year) {
    const key = `mt_tax_year_data`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    return existing[year] || null;
  }

  /**
   * Mappt neues Report-Format auf Legacy-Format
   * für Kompatibilität mit bestehender UI
   */
  _mapToLegacyFormat(report) {
    const z = report.zusammenfassung;

    return {
      year: report.meta.jahr,
      taxpayer: report.meta.steuerpflichtiger,

      // Legacy: stockPnL, optionsPnL etc.
      stockPnL: z.gewinne.aktien.betrag - z.verluste.aktien.betrag,
      optionsPnL: z.gewinne.termingeschaefte.betrag - z.verluste.termingeschaefte.betrag,
      etfPnL: z.gewinne.allgemein.betrag - z.verluste.allgemein.betrag,

      // Legacy: dailyBreakdown → dailyReport
      dailyReport: this._buildDailyReport(report),

      // Legacy: summary
      summary: {
        totalGewinn: z.gewinne.gesamt,
        totalVerlust: z.verluste.gesamt,
        saldo: z.saldo,
        steuerOhneKirche: z.steuer.ohneKirchensteuer.betrag,
        steuerMitKirche9: z.steuer.mitKirchensteuer9?.betrag || 0,
        steuerMitKirche8: z.steuer.mitKirchensteuer8?.betrag || 0,
      },

      // Neue Daten (für erweiterte UI)
      anlageKAP: report.anlageKAP,
      verlustToepfe: z.verlustvortraege,
      warnings: report.warnings || [],
      errors: report.errors || [],

      // Roher Report für Export
      raw: report,
    };
  }

  _buildDailyReport(report) {
    // Gruppiere Trades nach Datum
    const daily = {};

    for (const trade of report.detailDaten.trades.gewinne || []) {
      const date = trade.date;
      if (!daily[date]) daily[date] = { date, trades: [], pnl: 0 };
      daily[date].trades.push(trade);
      daily[date].pnl += trade.fifoPnlRealizedEUR || 0;
    }

    for (const trade of report.detailDaten.trades.verluste || []) {
      const date = trade.date;
      if (!daily[date]) daily[date] = { date, trades: [], pnl: 0 };
      daily[date].trades.push(trade);
      daily[date].pnl += trade.fifoPnlRealizedEUR || 0;
    }

    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export default new TaxReportService();
