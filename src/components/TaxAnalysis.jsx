import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CapTraderImport from '../CapTraderImport.jsx';

// Mock TaxReportEngine
vi.mock('../../modules/tax/report/TaxReportEngine.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    generiereReport: vi.fn().mockResolvedValue({
      meta: { jahr: 2025, steuerpflichtiger: 'Test', broker: 'CapTrader' },
      zusammenfassung: {
        gewinne: { gesamt: 1000, aktien: { betrag: 1000, anzahl: 1 }, termingeschaefte: { betrag: 0, anzahl: 0 }, allgemein: { betrag: 0, anzahl: 0 } },
        verluste: { gesamt: 0, aktien: { betrag: 0, anzahl: 0 }, termingeschaefte: { betrag: 0, anzahl: 0 }, allgemein: { betrag: 0, anzahl: 0 } },
        saldo: 1000,
        steuer: {
          ohneKirchensteuer: { betrag: 263.75, satz: '26,375%' },
          mitKirchensteuer9: { betrag: 279.9, satz: '27,99%' },
          mitKirchensteuer8: { betrag: 278.2, satz: '27,82%' },
        },
        verlustvortraege: { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 },
      },
      anlageKAP: {
        zeile7: { beschreibung: 'Kapitalerträge', wert: 1000, pflichtfeld: true },
        zeile19: { beschreibung: 'Kapitalerträge Auslandsdepot', wert: 1000, wichtig: true },
      },
      detailDaten: { trades: { aktien: { gewinne: [], verluste: [] }, termingeschaefte: { gewinne: [], verluste: [] }, allgemein: { gewinne: [], verluste: [] } }, dividends: [], interests: [] },
      warnings: [],
      errors: [],
      fifoValidation: { valid: true, warnings: [], errors: [], positionen: {} },
    }),
    exportiere: vi.fn().mockReturnValue('test-csv'),
  })),
}));

// Mock jsPDF
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    autoTable: vi.fn(),
    save: vi.fn(),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  })),
}));

describe('CapTraderImport', () => {
  const mockOnReportGenerated = vi.fn();

  beforeEach(() => {
    mockOnReportGenerated.mockClear();
  });

  it('sollte initial den Schritt 1 anzeigen', () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    expect(screen.getByText('FlexQuery XML hochladen')).toBeInTheDocument();
    expect(screen.getByText(/XML-Datei hier ablegen/)).toBeInTheDocument();
  });

  it('sollte Steuerliche Angaben anzeigen', () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    expect(screen.getByText('Steuerliche Angaben')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Max Mustermann')).toBeInTheDocument();
  });

  it('sollte Kirchensteuer-Info anzeigen', () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    expect(screen.getByText('Kirchensteuer')).toBeInTheDocument();
    expect(screen.getByText(/alle drei Varianten/)).toBeInTheDocument();
  });

  it('sollte EZB-Upload optional anzeigen', () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    expect(screen.getByText(/EZB-Wechselkurse/)).toBeInTheDocument();
    expect(screen.getByText(/optional/)).toBeInTheDocument();
  });
});
