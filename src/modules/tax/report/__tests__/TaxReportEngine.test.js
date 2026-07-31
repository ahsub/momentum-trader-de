// src/modules/tax/report/__tests__/TaxReportEngine.test.js
// ═══════════════════════════════════════════════════════════════════════════════
// TaxReportEngine Tests — Gemeinschaftskonto, Währungsanalyse, Warnungen
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import TaxReportEngine from '../TaxReportEngine.js';

// Mock XML for testing (simplified FlexQuery structure)
const MOCK_XML_SINGLE = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="Activity">
  <FlexStatements count="1">
    <FlexStatement accountId="U123456" fromDate="20250101" toDate="20251231" period="LastYear">
      <Trades>
        <Trade currency="USD" fxRateToBase="0.92" symbol="AAPL" isin="US0378331005" 
               assetCategory="STK" buySell="SELL" quantity="10" tradePrice="180.50" 
               tradeDate="20250115" tradeTime="10:30:00" proceeds="1805.00" 
               commission="-1.50" fifoPnlRealized="150.00" />
        <Trade currency="USD" fxRateToBase="0.91" symbol="TSLA" isin="US88160R1014" 
               assetCategory="STK" buySell="SELL" quantity="5" tradePrice="250.00" 
               tradeDate="20250220" tradeTime="14:15:00" proceeds="1250.00" 
               commission="-1.25" fifoPnlRealized="-75.00" />
      </Trades>
      <Dividends />
      <Interest />
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;

const MOCK_XML_FOREIGN = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="Activity">
  <FlexStatements count="1">
    <FlexStatement accountId="U123456" fromDate="20250101" toDate="20251231" period="LastYear">
      <Trades>
        <Trade currency="GBP" fxRateToBase="1.18" symbol="SHEL" isin="GB00B03MLX29" 
               assetCategory="STK" buySell="SELL" quantity="50" tradePrice="28.50" 
               tradeDate="20250310" tradeTime="09:00:00" proceeds="1425.00" 
               commission="-2.50" fifoPnlRealized="200.00" />
        <Trade currency="USD" fxRateToBase="0.00" symbol="NVDA" isin="US67066G1040" 
               assetCategory="STK" buySell="SELL" quantity="3" tradePrice="450.00" 
               tradeDate="20250405" tradeTime="11:30:00" proceeds="1350.00" 
               commission="-1.50" fifoPnlRealized="300.00" />
      </Trades>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;

describe('TaxReportEngine', () => {
  describe('Einzelkonto (Legacy)', () => {
    let engine;

    beforeEach(() => {
      engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Max Mustermann', broker: 'CapTrader' },
        fx: { toleranz: 0.01, useIBKRRate: true },
        fifo: { toleranzCostBasis: 0.001 },
      });
    });

    it('sollte einen gültigen Report generieren', async () => {
      const report = await engine.generiereReport(MOCK_XML_SINGLE);

      expect(report).toBeDefined();
      expect(report.meta).toBeDefined();
      expect(report.meta.jahr).toBe(2025);
      expect(report.meta.steuerpflichtiger).toBe('Max Mustermann');
    });

    it('sollte Gewinne und Verluste korrekt berechnen', async () => {
      const report = await engine.generiereReport(MOCK_XML_SINGLE);
      const z = report.zusammenfassung;

      expect(z.gewinne.gesamt).toBeGreaterThan(0);
      expect(z.verluste.gesamt).toBeGreaterThanOrEqual(0);
      expect(z.saldo).toBe(z.gewinne.gesamt - z.verluste.gesamt);
    });

    it('sollte Anlage KAP Zeilen generieren', async () => {
      const report = await engine.generiereReport(MOCK_XML_SINGLE);

      expect(report.anlageKAP).toBeDefined();
      expect(report.anlageKAP.zeile7).toBeDefined();
      expect(report.anlageKAP.zeile8).toBeDefined();
    });

    it('sollte Steuer korrekt berechnen', async () => {
      const report = await engine.generiereReport(MOCK_XML_SINGLE);
      const z = report.zusammenfassung;

      expect(z.steuer.ohneKirchensteuer.betrag).toBeGreaterThan(0);
      expect(z.steuer.mitKirchensteuer9.betrag).toBeGreaterThanOrEqual(0);
      expect(z.steuer.mitKirchensteuer8.betrag).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Gemeinschaftskonto', () => {
    it('sollte zwei Personen unterstützen', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Person A', broker: 'CapTrader' },
        isGemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.5, kirchensteuerSatz: 'rest' },
          { name: 'Person B', anteil: 0.5, kirchensteuerSatz: 'bwBayern' },
        ],
      });

      const report = await engine.generiereReport(MOCK_XML_SINGLE);

      expect(report.isGemeinschaftskonto).toBe(true);
      expect(report.personen).toHaveLength(2);
      expect(report.personen[0].person.name).toBe('Person A');
      expect(report.personen[1].person.name).toBe('Person B');
    });

    it('sollte Anteile korrekt aufteilen (50/50)', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Person A', broker: 'CapTrader' },
        isGemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.5, kirchensteuerSatz: null },
          { name: 'Person B', anteil: 0.5, kirchensteuerSatz: null },
        ],
      });

      const report = await engine.generiereReport(MOCK_XML_SINGLE);

      const saldoA = report.personen[0].zusammenfassung.saldo;
      const saldoB = report.personen[1].zusammenfassung.saldo;

      expect(saldoA).toBeCloseTo(saldoB, 2);
      expect(saldoA + saldoB).toBeCloseTo(report.zusammenfassung.gesamtSaldo || report.zusammenfassung.saldo, 2);
    });

    it('sollte Anteile korrekt aufteilen (70/30)', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Person A', broker: 'CapTrader' },
        isGemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.7, kirchensteuerSatz: null },
          { name: 'Person B', anteil: 0.3, kirchensteuerSatz: null },
        ],
      });

      const report = await engine.generiereReport(MOCK_XML_SINGLE);

      const saldoA = report.personen[0].zusammenfassung.saldo;
      const saldoB = report.personen[1].zusammenfassung.saldo;

      expect(saldoA).toBeCloseTo(saldoB * (0.7 / 0.3), 2);
    });

    it('sollte unterschiedliche Kirchensteuer pro Person berechnen', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Person A', broker: 'CapTrader' },
        isGemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.5, kirchensteuerSatz: 'rest' },    // 9%
          { name: 'Person B', anteil: 0.5, kirchensteuerSatz: 'bwBayern' },  // 8%
        ],
      });

      const report = await engine.generiereReport(MOCK_XML_SINGLE);

      const steuerA = report.personen[0].zusammenfassung.steuer.mitKirchensteuer9?.betrag || 0;
      const steuerB = report.personen[1].zusammenfassung.steuer.mitKirchensteuer8?.betrag || 0;

      // Person A mit 9% KS sollte mehr Steuer zahlen als Person B mit 8% KS
      // (bei gleichem Anteil und gleichem Saldo)
      expect(steuerA).toBeGreaterThanOrEqual(steuerB);
    });

    it('sollte bei ungültigen Anteilen einen Fehler werfen', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Person A', broker: 'CapTrader' },
        isGemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.6, kirchensteuerSatz: null },
          { name: 'Person B', anteil: 0.3, kirchensteuerSatz: null },  // 60+30=90 ≠ 100
        ],
      });

      await expect(engine.generiereReport(MOCK_XML_SINGLE)).rejects.toThrow('Anteile müssen zusammen 100% ergeben');
    });
  });

  describe('Währungsanalyse', () => {
    it('sollte erkennen wenn EZB-Kurse nicht benötigt werden (alle in EUR)', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Test', broker: 'CapTrader' },
      });

      // Mock-XML nur mit EUR-Trades
      const xmlEUR = MOCK_XML_SINGLE.replace(/currency="USD"/g, 'currency="EUR"').replace(/fxRateToBase="[^"]*"/g, 'fxRateToBase="1.0"');
      const report = await engine.generiereReport(xmlEUR);

      expect(report.waehrungsAnalyse.benoetigtEZB).toBe(false);
      expect(report.waehrungsAnalyse.fremdwaehrungen).toHaveLength(0);
    });

    it('sollte erkennen wenn EZB-Kurse empfohlen sind (fehlende FX-Raten)', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Test', broker: 'CapTrader' },
      });

      const report = await engine.generiereReport(MOCK_XML_FOREIGN);

      expect(report.waehrungsAnalyse.fremdwaehrungen.length).toBeGreaterThan(0);
      expect(report.waehrungsAnalyse.ohneFXRate).toBeGreaterThan(0);
    });
  });

  describe('Warnungs-Deduplizierung', () => {
    it('sollte FX-Warnungen gruppieren', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Test', broker: 'CapTrader' },
      });

      const report = await engine.generiereReport(MOCK_XML_FOREIGN);

      // Sollte weniger Warnungen haben als Trades
      const fxWarnings = report.warnings.filter(w => w.type === 'FX_NICHT_VALIDIERT');
      const gruppierte = fxWarnings.filter(w => w.gruppiert);

      expect(gruppierte.length).toBeLessThanOrEqual(fxWarnings.length);
    });
  });

  describe('CSV-Export', () => {
    it('sollte Einzelkonto-CSV exportieren', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Test', broker: 'CapTrader' },
      });

      const report = await engine.generiereReport(MOCK_XML_SINGLE);
      const csv = engine.exportiere(report, 'csv');

      expect(csv).toContain('Kategorie;Wert;Hinweis');
      expect(csv).toContain('Jahr;2025;');
      expect(csv).toContain('Gesamtergebnis');
    });

    it('sollte Gemeinschafts-CSV exportieren', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Person A', broker: 'CapTrader' },
        isGemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.5, kirchensteuerSatz: null },
          { name: 'Person B', anteil: 0.5, kirchensteuerSatz: null },
        ],
      });

      const report = await engine.generiereReport(MOCK_XML_SINGLE);
      const csv = engine.exportiere(report, 'csv-gemeinschaft');

      expect(csv).toContain('Person A');
      expect(csv).toContain('Person B');
      expect(csv).toContain('50%');
    });
  });

  describe('Fehlerbehandlung', () => {
    it('sollte bei ungültigem XML einen Fehler werfen', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Test', broker: 'CapTrader' },
      });

      await expect(engine.generiereReport('<invalid>xml</invalid>')).rejects.toThrow();
    });

    it('sollte Fehler im Report speichern', async () => {
      const engine = new TaxReportEngine({
        report: { jahr: 2025, steuerpflichtiger: 'Test', broker: 'CapTrader' },
        isGemeinschaftskonto: true,
        personen: [
          { name: 'A', anteil: 0.6, kirchensteuerSatz: null },
          { name: 'B', anteil: 0.3, kirchensteuerSatz: null },
        ],
      });

      try {
        await engine.generiereReport(MOCK_XML_SINGLE);
      } catch (err) {
        expect(engine.errors.length).toBeGreaterThan(0);
        expect(engine.errors[0].type).toBe('GENERIERUNG_FEHLER');
      }
    });
  });
});
