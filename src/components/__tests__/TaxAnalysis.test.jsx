// src/components/__tests__/TaxAnalysis.test.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// TaxAnalysis Tests — Render-Logik, Tabs, Gemeinschaftskonto, Export
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaxAnalysis from '../TaxAnalysis';

// Mock jsPDF
vi.mock('../../utils/taxReportPDF.js', () => ({
  generateTaxPDF: vi.fn().mockResolvedValue(undefined),
}));

const MOCK_REPORT_SINGLE = {
  year: 2025,
  taxpayer: 'Max Mustermann',
  isGemeinschaftskonto: false,
  stockPnL: 573.13,
  optionsPnL: 6469.96,
  etfPnL: 0,
  summary: {
    totalGewinn: 20606.03,
    totalVerlust: 13562.95,
    saldo: 7043.08,
    steuerOhneKirche: 1857.61,
    steuerMitKirche9: 1970.00,
    steuerMitKirche8: 1959.29,
  },
  anlageKAP: {
    zeile7: { wert: 20606.03, beschreibung: 'Kapitalerträge' },
    zeile8: { wert: 573.13, beschreibung: 'Gewinne Aktien' },
    zeile19: { wert: 20606.03, beschreibung: 'Kapitalerträge Auslandsdepot' },
    zeile25: { wert: -13562.95, beschreibung: 'Sonstige Verluste' },
  },
  verlustToepfe: { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 },
  dailyReport: [
    { date: '2025-01-15', trades: [{ symbol: 'AAPL', buySell: 'SELL', quantity: 10, tradePrice: 180.50, fifoPnlRealizedEUR: 150.00 }], pnl: 150.00 },
    { date: '2025-02-20', trades: [{ symbol: 'TSLA', buySell: 'SELL', quantity: 5, tradePrice: 250.00, fifoPnlRealizedEUR: -75.00 }], pnl: -75.00 },
  ],
  warnings: [
    { type: 'FX_NICHT_VALIDIERT', waehrung: 'USD', datum: '2025-01-15', gruppiert: true, anzahl: 3 },
  ],
  errors: [],
  raw: { meta: { jahr: 2025 } },
};

const MOCK_REPORT_GEMEINSCHAFT = {
  year: 2025,
  taxpayer: 'Person A',
  isGemeinschaftskonto: true,
  personen: [
    {
      person: { name: 'Person A', anteil: 0.5, kirchensteuerSatz: 'rest' },
      zusammenfassung: {
        gewinne: { gesamt: 10303.02 },
        verluste: { gesamt: 6781.48 },
        saldo: 3521.54,
        steuer: {
          ohneKirchensteuer: { betrag: 928.81 },
          mitKirchensteuer9: { betrag: 985.00 },
          mitKirchensteuer8: { betrag: 979.65 },
        },
      },
      anlageKAP: { zeile7: { wert: 10303.02, beschreibung: 'Kapitalerträge' } },
    },
    {
      person: { name: 'Person B', anteil: 0.5, kirchensteuerSatz: 'bwBayern' },
      zusammenfassung: {
        gewinne: { gesamt: 10303.01 },
        verluste: { gesamt: 6781.47 },
        saldo: 3521.54,
        steuer: {
          ohneKirchensteuer: { betrag: 928.80 },
          mitKirchensteuer9: { betrag: 985.00 },
          mitKirchensteuer8: { betrag: 979.64 },
        },
      },
      anlageKAP: { zeile7: { wert: 10303.01, beschreibung: 'Kapitalerträge' } },
    },
  ],
  stockPnL: 573.13,
  optionsPnL: 6469.96,
  etfPnL: 0,
  summary: {
    totalGewinn: 20606.03,
    totalVerlust: 13562.95,
    saldo: 7043.08,
    steuerOhneKirche: 1857.61,
    steuerMitKirche9: 1970.00,
    steuerMitKirche8: 1959.29,
  },
  anlageKAP: {
    zeile7: { wert: 20606.03, beschreibung: 'Kapitalerträge' },
  },
  verlustToepfe: { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 },
  dailyReport: [],
  warnings: [],
  errors: [],
  raw: { meta: { jahr: 2025 }, personen: [] },
};

describe('TaxAnalysis', () => {
  describe('Rendering ohne Report', () => {
    it('sollte "Kein Steuerreport geladen" anzeigen', () => {
      render(<TaxAnalysis report={null} />);

      expect(screen.getByText('Kein Steuerreport geladen')).toBeInTheDocument();
      expect(screen.getByText('Importiere zuerst dein CapTrader Activity Statement.')).toBeInTheDocument();
    });
  });

  describe('Rendering mit Einzelkonto', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={MOCK_REPORT_SINGLE} />);
    });

    it('sollte den Steuerpflichtigen anzeigen', () => {
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
    });

    it('sollte das Steuerjahr anzeigen', () => {
      expect(screen.getByText(/Steuerreport 2025/)).toBeInTheDocument();
    });

    it('sollte alle Tabs anzeigen', () => {
      expect(screen.getByText('Übersicht')).toBeInTheDocument();
      expect(screen.getByText('Anlage KAP')).toBeInTheDocument();
      expect(screen.getByText('Tagesbericht')).toBeInTheDocument();
      expect(screen.getByText('Warnungen')).toBeInTheDocument();
    });

    it('sollte den Übersicht-Tab als aktiv anzeigen', () => {
      const overviewTab = screen.getByText('Übersicht').closest('button');
      expect(overviewTab).toHaveClass('bg-emerald-500/10');
    });

    it('sollte Summary Cards anzeigen', () => {
      expect(screen.getByText('Gesamtergebnis')).toBeInTheDocument();
      expect(screen.getByText('Gewinne')).toBeInTheDocument();
      expect(screen.getByText('Verluste')).toBeInTheDocument();
      expect(screen.getByText('Trades')).toBeInTheDocument();
    });

    it('sollte Steuerberechnung anzeigen', () => {
      expect(screen.getByText('Ohne Kirchensteuer')).toBeInTheDocument();
      expect(screen.getByText('Mit Kirchensteuer (9%)')).toBeInTheDocument();
      expect(screen.getByText('Mit Kirchensteuer (8%)')).toBeInTheDocument();
    });

    it('sollte Verlusttöpfe anzeigen', () => {
      expect(screen.getByText('Aktien')).toBeInTheDocument();
      expect(screen.getByText('Allgemein')).toBeInTheDocument();
      expect(screen.getByText('Termingeschäfte')).toBeInTheDocument();
    });

    it('sollte Export-Buttons anzeigen', () => {
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });
  });

  describe('Tab-Navigation', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={MOCK_REPORT_SINGLE} />);
    });

    it('sollte zum Anlage KAP Tab wechseln', () => {
      fireEvent.click(screen.getByText('Anlage KAP'));

      expect(screen.getByText('Anlage KAP — Zeilen-Mapping')).toBeInTheDocument();
      expect(screen.getByText('zeile7')).toBeInTheDocument();
    });

    it('sollte zum Tagesbericht Tab wechseln', () => {
      fireEvent.click(screen.getByText('Tagesbericht'));

      expect(screen.getByText(/15\. Januar 2025/)).toBeInTheDocument();
    });

    it('sollte zum Warnungen Tab wechseln', () => {
      fireEvent.click(screen.getByText('Warnungen'));

      expect(screen.getByText(/Warnungen/)).toBeInTheDocument();
    });
  });

  describe('Gemeinschaftskonto', () => {
    it('sollte Gemeinschaftskonto-Badge anzeigen', () => {
      render(<TaxAnalysis report={MOCK_REPORT_GEMEINSCHAFT} />);

      expect(screen.getByText('Gemeinschaftskonto')).toBeInTheDocument();
    });

    it('sollte Personen-Tabs anzeigen', () => {
      render(<TaxAnalysis report={MOCK_REPORT_GEMEINSCHAFT} />);

      expect(screen.getByText('Person A')).toBeInTheDocument();
      expect(screen.getByText('Person B')).toBeInTheDocument();
    });

    it('sollte zwischen Personen wechseln', () => {
      render(<TaxAnalysis report={MOCK_REPORT_GEMEINSCHAFT} />);

      fireEvent.click(screen.getByText('Person B'));

      expect(screen.getByText('Person B')).toBeInTheDocument();
    });

    it('sollte Anteile anzeigen', () => {
      render(<TaxAnalysis report={MOCK_REPORT_GEMEINSCHAFT} />);

      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });
  });

  describe('Tagesbericht', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={MOCK_REPORT_SINGLE} />);
      fireEvent.click(screen.getByText('Tagesbericht'));
    });

    it('sollte Trading-Tage anzeigen', () => {
      expect(screen.getByText(/15\. Januar 2025/)).toBeInTheDocument();
      expect(screen.getByText(/20\. Februar 2025/)).toBeInTheDocument();
    });

    it('sollte Trades expandieren/collapsen', () => {
      const dayButton = screen.getByText(/15\. Januar 2025/).closest('button');
      fireEvent.click(dayButton);

      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('sollte P&L korrekt formatieren', () => {
      const dayButton = screen.getByText(/15\. Januar 2025/).closest('button');
      fireEvent.click(dayButton);

      expect(screen.getByText('+150,00 €')).toBeInTheDocument();
    });
  });

  describe('Warnungen', () => {
    it('sollte gruppierte Warnungen anzeigen', () => {
      render(<TaxAnalysis report={MOCK_REPORT_SINGLE} />);
      fireEvent.click(screen.getByText('Warnungen'));

      expect(screen.getByText(/Warnungen \(1\)/)).toBeInTheDocument();
    });

    it('sollte "Keine Warnungen" anzeigen wenn leer', () => {
      const reportOhneWarnungen = { ...MOCK_REPORT_SINGLE, warnings: [] };
      render(<TaxAnalysis report={reportOhneWarnungen} />);
      fireEvent.click(screen.getByText('Warnungen'));

      expect(screen.getByText('Keine Warnungen')).toBeInTheDocument();
    });
  });

  describe('Rohdaten', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={MOCK_REPORT_SINGLE} />);
    });

    it('sollte Rohdaten-Toggle anzeigen', () => {
      expect(screen.getByText('Rohdaten anzeigen')).toBeInTheDocument();
    });

    it('sollte Rohdaten anzeigen wenn geklickt', () => {
      fireEvent.click(screen.getByText('Rohdaten anzeigen'));

      expect(screen.getByText('Rohdaten ausblenden')).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={MOCK_REPORT_SINGLE} />);
    });

    it('sollte CSV-Export-Button haben', () => {
      const csvButton = screen.getByText('CSV');
      expect(csvButton).toBeInTheDocument();
    });

    it('sollte PDF-Export-Button haben', () => {
      const pdfButton = screen.getByText('PDF');
      expect(pdfButton).toBeInTheDocument();
    });
  });

  describe('Währungsformatierung', () => {
    it('sollte Euro korrekt formatieren', () => {
      render(<TaxAnalysis report={MOCK_REPORT_SINGLE} />);

      // Suche nach formatierten Beträgen
      expect(screen.getByText('7.043,08 €')).toBeInTheDocument();
    });

    it('sollte negative Beträge rot anzeigen', () => {
      const reportMitVerlust = {
        ...MOCK_REPORT_SINGLE,
        summary: { ...MOCK_REPORT_SINGLE.summary, saldo: -1000 },
      };
      render(<TaxAnalysis report={reportMitVerlust} />);

      const saldoElement = screen.getByText('-1.000,00 €');
      expect(saldoElement).toHaveClass('text-red-400');
    });
  });
});
