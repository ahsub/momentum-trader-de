// src/modules/tax/__tests__/integration.test.js
import { describe, it, expect } from 'vitest';
import TaxReportEngine from '../report/TaxReportEngine.js';

describe('TaxReportEngine Integration', () => {
  const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="Steuerreport" type="AF">
  <Trades>
    <Trade tradeID="1" symbol="AAPL" assetCategory="STK" buySell="BUY" 
           quantity="10" tradePrice="150" proceeds="-1500" commission="-1.5" 
           fifoPnlRealized="0" currency="USD" fxRateToBase="0.92" 
           dateTime="2026-01-15T14:30:00"/>
    <Trade tradeID="2" symbol="AAPL" assetCategory="STK" buySell="SELL" 
           quantity="10" tradePrice="170" proceeds="1700" commission="-1.5" 
           fifoPnlRealized="200" costBasisMoney="-1500" currency="USD" 
           fxRateToBase="0.92" dateTime="2026-03-20T10:15:00"/>
    <Trade tradeID="3" symbol="AAPL230421C00150000" assetCategory="OPT" 
           buySell="SELL" quantity="1" tradePrice="2.5" proceeds="250" 
           multiplier="100" fifoPnlRealized="150" currency="USD" 
           fxRateToBase="0.92" dateTime="2026-03-20T11:00:00"/>
    <Trade tradeID="4" symbol="MES" assetCategory="FUT" buySell="SELL" 
           quantity="1" tradePrice="4200" proceeds="21000" 
           fifoPnlRealized="500" currency="USD" fxRateToBase="0.92" 
           dateTime="2026-04-10T09:30:00"/>
    <Trade tradeID="5" symbol="SPY" assetCategory="ETF" buySell="SELL" 
           quantity="5" tradePrice="400" proceeds="2000" 
           fifoPnlRealized="300" currency="USD" fxRateToBase="0.91" 
           dateTime="2026-05-10T09:00:00"/>
  </Trades>
  <CashTransactions>
    <CashTransaction type="Dividends" symbol="AAPL" amount="25" 
                     currency="USD" fxRateToBase="0.92" 
                     dateTime="2026-02-15T00:00:00"/>
  </CashTransactions>
</FlexQueryResponse>`;

  it('sollte kompletten Steuerreport generieren', async () => {
    const engine = new TaxReportEngine({
      report: { jahr: 2026, steuerpflichtiger: 'Max Mustermann' },
    });

    const report = await engine.generiereReport(mockXml);

    // Meta prüfen
    expect(report.meta.jahr).toBe(2026);
    expect(report.meta.steuerpflichtiger).toBe('Max Mustermann');

    // Anlage KAP Zeilen prüfen
    expect(report.anlageKAP.zeile19.wert).toBeGreaterThan(0);
    expect(report.anlageKAP.zeile37.wert).toBe(0); // Kein Steuerabzug

    // Zusammenfassung prüfen
    expect(report.zusammenfassung.gewinne.aktien.betrag).toBeGreaterThan(0);
    expect(report.zusammenfassung.gewinne.termingeschaefte.betrag).toBeGreaterThan(0);
    expect(report.zusammenfassung.steuer.ohneKirchensteuer.betrag).toBeGreaterThan(0);
  });

  it('sollte CSV exportieren', async () => {
    const engine = new TaxReportEngine({
      report: { jahr: 2026, steuerpflichtiger: 'Max Mustermann' },
    });

    const report = await engine.generiereReport(mockXml);
    const csv = engine.exportiere(report, 'csv');

    expect(csv).toContain('Kategorie;Wert;Hinweis');
    expect(csv).toContain('Gewinne Aktien;');
    expect(csv).toContain('Steuer ohne Kirchensteuer;');
  });

  it('sollte Trades-CSV exportieren', async () => {
    const engine = new TaxReportEngine({
      report: { jahr: 2026, steuerpflichtiger: 'Max Mustermann' },
    });

    const report = await engine.generiereReport(mockXml);
    const csv = engine.exportiere(report, 'csv-trades');

    expect(csv).toContain('Datum;Symbol;ISIN');
    expect(csv).toContain('AAPL');
  });
});
