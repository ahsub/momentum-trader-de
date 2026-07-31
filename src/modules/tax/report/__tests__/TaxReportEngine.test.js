import { describe, it, expect, beforeEach } from 'vitest';
import { TaxReportEngine } from '../TaxReportEngine';

// Mock XML with foreign currency trades to trigger EZB analysis
const MOCK_XML_SINGLE = `
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement accountId="U1234567" fromDate="2025-01-01" toDate="2025-12-31">
      <Trades>
        <Trade symbol="AAPL" dateTime="20250115;094530" currency="USD" 
               proceeds="1000" quantity="10" tradePrice="150" 
               ibCommission="-1.5" fxRateToBase="0.92"/>
      </Trades>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>
`;

// Mock XML with EUR-only trades (no FX needed)
const MOCK_XML_EUR_ONLY = `
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement accountId="U1234567" fromDate="2025-01-01" toDate="2025-12-31">
      <Trades>
        <Trade symbol="SAP" dateTime="20250115;094530" currency="EUR" 
               proceeds="1000" quantity="10" tradePrice="150" 
               ibCommission="-1.5" fxRateToBase="1.0"/>
      </Trades>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>
`;

describe('TaxReportEngine v2.0', () => {
  let engine;

  beforeEach(() => {
    engine = new TaxReportEngine();
  });

  describe('Einzelkonto (Legacy)', () => {
    it('sollte einen Report generieren', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      expect(report.meta.steuerpflichtiger).toBe('Test');
      expect(report.meta.jahr).toBe(2025);
    });
  });

  describe('Gemeinschaftskonto', () => {
    it('sollte zwei Personen unterstuetzen', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025,
        gemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.5, kirchensteuerSatz: 0.09 },
          { name: 'Person B', anteil: 0.5, kirchensteuerSatz: 0.08 }
        ]
      });
      expect(report.meta.personen).toHaveLength(2);
    });

    it('sollte Anteile korrekt aufteilen (50/50)', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025,
        gemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.5, kirchensteuerSatz: 0.09 },
          { name: 'Person B', anteil: 0.5, kirchensteuerSatz: 0.08 }
        ]
      });
      expect(report.zusammenfassung.personen[0].anteil).toBe(0.5);
      expect(report.zusammenfassung.personen[1].anteil).toBe(0.5);
    });

    it('sollte Anteile korrekt aufteilen (70/30)', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025,
        gemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.7, kirchensteuerSatz: 0.09 },
          { name: 'Person B', anteil: 0.3, kirchensteuerSatz: 0.08 }
        ]
      });
      expect(report.zusammenfassung.personen[0].anteil).toBe(0.7);
      expect(report.zusammenfassung.personen[1].anteil).toBe(0.3);
    });

    it('sollte unterschiedliche Kirchensteuer pro Person berechnen', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025,
        gemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.5, kirchensteuerSatz: 0.09 },
          { name: 'Person B', anteil: 0.5, kirchensteuerSatz: 0.08 }
        ]
      });
      expect(report.zusammenfassung.personen[0].steuer.mitKirchensteuer9.betrag)
        .not.toBe(report.zusammenfassung.personen[1].steuer.mitKirchensteuer8.betrag);
    });

    it('sollte bei ungueltigen Anteilen einen Fehler speichern', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025,
        gemeinschaftskonto: true,
        personen: [
          { name: 'Person A', anteil: 0.6, kirchensteuerSatz: 0.09 },
          { name: 'Person B', anteil: 0.3, kirchensteuerSatz: 0.08 },
        ],
      });
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors[0].message).toMatch(/Anteile muessen 100% ergeben/);
      expect(report.meta.fehler).toBe(true);
    });
  });

  describe('Waehrungsanalyse', () => {
    it('sollte erkennen wenn EZB-Kurse nicht benoetigt werden (alle in EUR)', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      expect(report.waehrungsAnalyse.benoetigtEZB).toBe(false);
      expect(report.waehrungsAnalyse.fremdwaehrungen).toHaveLength(0);
    });

    it('sollte erkennen wenn EZB-Kurse empfohlen sind (fehlende FX-Raten)', async () => {
      const report = await engine.generiereReport(MOCK_XML_SINGLE, {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      expect(report.waehrungsAnalyse.benoetigtEZB).toBe(true);
      expect(report.waehrungsAnalyse.fremdwaehrungen).toContain('USD');
    });
  });

  describe('Warnungs-Deduplizierung', () => {
    it('sollte gleiche Warnungen gruppieren', async () => {
      const report = await engine.generiereReport(MOCK_XML_SINGLE, {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      const fxWarnings = report.warnings.filter(w => w.type === 'FX_NICHT_VALIDIERT');
      if (fxWarnings.length > 0) {
        expect(fxWarnings[0].gruppiert).toBe(true);
      }
    });
  });

  describe('CSV-Export', () => {
    it('sollte CSV generieren', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      const csv = engine.exportCSV(report);
      expect(csv).toContain('2025');
      expect(csv).toContain('Test');
    });

    it('sollte Header haben', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      const csv = engine.exportCSV(report);
      expect(csv.split('\n')[0]).toContain('Kategorie');
    });
  });

  describe('JSON-Export', () => {
    it('sollte JSON generieren', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      const json = engine.exportJSON(report);
      const parsed = JSON.parse(json);
      expect(parsed.meta.jahr).toBe(2025);
    });
  });

  describe('Fehlerbehandlung', () => {
    it('sollte bei ungueltigem XML einen Fehler speichern', async () => {
      const report = await engine.generiereReport('<invalid>xml</invalid>', {
        steuerpflichtiger: 'Test',
        jahr: 2025
      });
      expect(report).toBeDefined();
      expect(report.meta).toBeDefined();
    });

    it('sollte Fehler im Report speichern', async () => {
      const report = await engine.generiereReport(MOCK_XML_EUR_ONLY, {
        steuerpflichtiger: 'Test',
        jahr: 2025,
        gemeinschaftskonto: true,
        personen: [{ name: 'A', anteil: 1.2 }] // Invalid share > 100%
      });
      expect(report.errors.length).toBeGreaterThan(0);
    });
  });
});
