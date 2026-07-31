import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TaxAnalysis from '../TaxAnalysis';

const mockReport = {
  meta: {
    jahr: 2025,
    steuerpflichtiger: 'Max Mustermann',
    broker: 'CapTrader (Interactive Brokers)',
    version: '2.0.0'
  },
  zusammenfassung: {
    gewinne: { gesamt: 5000, aktien: { betrag: 5000, anzahl: 2 }, allgemein: { betrag: 0, anzahl: 0 }, termingeschaefte: { betrag: 0, anzahl: 0 } },
    verluste: { gesamt: 1000, aktien: { betrag: 1000, anzahl: 1 }, allgemein: { betrag: 0, anzahl: 0 }, termingeschaefte: { betrag: 0, anzahl: 0 } },
    saldo: 4000,
    steuer: {
      ohneKirchensteuer: { betrag: 1055, satz: '26,375%' },
      mitKirchensteuer9: { betrag: 1119.60, satz: '27,99%' },
      mitKirchensteuer8: { betrag: 1112.80, satz: '27,82%' }
    },
    verlustvortraege: { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 }
  },
  detailDaten: {
    trades: {
      aktien: {
        gewinne: [
          { datum: '2025-01-15', symbol: 'AAPL', pnl: 2500, waehrung: 'EUR' }
        ],
        verluste: [
          { datum: '2025-02-20', symbol: 'TSLA', pnl: -500, waehrung: 'EUR' }
        ]
      }
    },
    verlusttoepfe: { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 }
  },
  anlageKAP: {},
  warnings: [],
  errors: []
};

const mockGemeinschaftReport = {
  ...mockReport,
  meta: {
    ...mockReport.meta,
    gemeinschaftskonto: true,
    personen: [
      { name: 'Max Mustermann', anteil: 0.5, kirchensteuerSatz: 0.09 },
      { name: 'Erika Mustermann', anteil: 0.5, kirchensteuerSatz: 0.08 }
    ]
  }
};

describe('TaxAnalysis v2.0', () => {
  describe('Rendering ohne Report', () => {
    it('sollte leeren State anzeigen', () => {
      render(<TaxAnalysis />);
      expect(screen.getByText(/Kein Steuerreport verfügbar/i)).toBeInTheDocument();
    });
  });

  describe('Rendering mit Einzelkonto', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={mockReport} />);
    });

    it('sollte den Steuerpflichtigen anzeigen', () => {
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
    });

    it('sollte das Steuerjahr anzeigen', () => {
      expect(screen.getByText(/2025/)).toBeInTheDocument();
    });

    it('sollte alle Tabs anzeigen', () => {
      const tabs = screen.getAllByRole('button');
      const tabTexts = tabs.map(t => t.textContent);
      expect(tabTexts.some(t => t.includes('Übersicht'))).toBe(true);
      expect(tabTexts.some(t => t.includes('Anlage KAP'))).toBe(true);
      expect(tabTexts.some(t => t.includes('Tagesbericht'))).toBe(true);
      expect(tabTexts.some(t => t.includes('Warnungen'))).toBe(true);
    });

    it('sollte den Übersicht-Tab als aktiv anzeigen', () => {
      const overviewTab = screen.getByRole('button', { name: /Übersicht/i });
      expect(overviewTab).toHaveClass('bg-emerald-500/10');
    });

    it('sollte Summary Cards anzeigen', () => {
      expect(screen.getByText('Gesamtergebnis')).toBeInTheDocument();
      expect(screen.getByText('Gewinne')).toBeInTheDocument();
      expect(screen.getByText('Verluste')).toBeInTheDocument();
    });

    it('sollte Steuerberechnung anzeigen', () => {
      expect(screen.getByText(/Ohne Kirchensteuer/)).toBeInTheDocument();
      expect(screen.getByText(/Mit Kirchensteuer \(9%\)/)).toBeInTheDocument();
      expect(screen.getByText(/Mit Kirchensteuer \(8%\)/)).toBeInTheDocument();
    });

    it('sollte Verlusttöpfe anzeigen', () => {
      expect(screen.getAllByText('Aktien').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Allgemein').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Termingeschäfte/i).length).toBeGreaterThanOrEqual(1);
    });

    it('sollte Export-Buttons anzeigen', () => {
      expect(screen.getByRole('button', { name: /CSV/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /PDF/i })).toBeInTheDocument();
    });
  });

  describe('Tab-Navigation', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={mockReport} />);
    });

    it('sollte zum Anlage KAP Tab wechseln', () => {
      fireEvent.click(screen.getByRole('button', { name: /Anlage KAP/i }));
      const kapTab = screen.getByRole('button', { name: /Anlage KAP/i });
      expect(kapTab).toHaveClass('bg-emerald-500/10');
    });

    it('sollte zum Tagesbericht Tab wechseln', () => {
      fireEvent.click(screen.getByRole('button', { name: /Tagesbericht/i }));
      const dailyTab = screen.getByRole('button', { name: /Tagesbericht/i });
      expect(dailyTab).toHaveClass('bg-emerald-500/10');
    });

    it('sollte zum Warnungen Tab wechseln', () => {
      fireEvent.click(screen.getByRole('button', { name: /Warnungen/i }));
      const warnTab = screen.getByRole('button', { name: /Warnungen/i });
      expect(warnTab).toHaveClass('bg-emerald-500/10');
    });
  });

  describe('Gemeinschaftskonto', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={mockGemeinschaftReport} />);
    });

    it('sollte Gemeinschaftskonto-Badge anzeigen', () => {
      expect(screen.getByText('Gemeinschaftskonto')).toBeInTheDocument();
    });

    it('sollte Personen-Tabs anzeigen', () => {
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
      expect(screen.getByText('Erika Mustermann')).toBeInTheDocument();
    });

    it('sollte zwischen Personen wechseln', () => {
      fireEvent.click(screen.getByText('Erika Mustermann'));
      expect(screen.getByText('Erika Mustermann')).toHaveClass('bg-emerald-500/10');
    });

    it('sollte Anteile anzeigen', () => {
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('sollte Aufteilungstabelle anzeigen', () => {
      expect(screen.getByText(/Aufteilung/)).toBeInTheDocument();
    });
  });

  describe('Tagesbericht', () => {
    beforeEach(() => {
      render(<TaxAnalysis report={mockReport} />);
      fireEvent.click(screen.getByRole('button', { name: /Tagesbericht/i }));
    });

    it('sollte Trading-Tage anzeigen', () => {
      const dailyTab = screen.getByRole('button', { name: /Tagesbericht/i });
      expect(dailyTab).toHaveClass('bg-emerald-500/10');
    });

    it('sollte Trades expandieren/collapsen', () => {
      const tradeButton = screen.getByText('2025-01-15');
      fireEvent.click(tradeButton);
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('sollte P&L korrekt formatieren', () => {
      expect(screen.getByText(/2\.500,00/)).toBeInTheDocument();
    });
  });

  describe('Warnungen', () => {
    it('sollte Warnungen anzeigen', () => {
      const reportWithWarnings = {
        ...mockReport,
        warnings: [{ type: 'FX_NICHT_VALIDIERT', message: 'Nicht validierter Kurs: USD am 2025-03-11' }]
      };
      render(<TaxAnalysis report={reportWithWarnings} />);
      fireEvent.click(screen.getByRole('button', { name: /Warnungen/i }));
      expect(screen.getByText(/Nicht validierter Kurs/)).toBeInTheDocument();
    });

    it('sollte "Keine Warnungen" anzeigen wenn leer', () => {
      render(<TaxAnalysis report={mockReport} />);
      fireEvent.click(screen.getByRole('button', { name: /Warnungen/i }));
      expect(screen.getByText(/Keine Warnungen vorhanden/)).toBeInTheDocument();
    });
  });
});
