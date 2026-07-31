// src/components/__tests__/CapTraderImport.test.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// CapTraderImport Tests — Formular-Validierung, Gemeinschaftskonto, Upload
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import CapTraderImport from '../CapTraderImport';

// Mock TaxReportEngine
vi.mock('../modules/tax/report/TaxReportEngine.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    generiereReport: vi.fn().mockResolvedValue({
      meta: { jahr: 2025, steuerpflichtiger: 'Test' },
      zusammenfassung: {
        gewinne: { gesamt: 1000, aktien: { betrag: 500, anzahl: 2 }, termingeschaefte: { betrag: 500, anzahl: 1 }, allgemein: { betrag: 0, anzahl: 0 } },
        verluste: { gesamt: 200, aktien: { betrag: 200, anzahl: 1 }, termingeschaefte: { betrag: 0, anzahl: 0 }, allgemein: { betrag: 0, anzahl: 0 } },
        saldo: 800,
        steuer: {
          ohneKirchensteuer: { betrag: 211.00, satz: '26.375%' },
          mitKirchensteuer9: { betrag: 223.78, satz: '27.99%' },
          mitKirchensteuer8: { betrag: 221.42, satz: '27.82%' },
        },
        verlustvortraege: { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 },
      },
      anlageKAP: { zeile7: { wert: 1000, beschreibung: 'Kapitalerträge' } },
      detailDaten: { trades: { aktien: { gewinne: [], verluste: [] } } },
      warnings: [],
      errors: [],
      waehrungsAnalyse: { benoetigtEZB: false, fremdwaehrungen: [] },
    })),
  })),
}));

const MOCK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse><FlexStatements count="1"><FlexStatement>
  <Trades><Trade symbol="AAPL" buySell="SELL" quantity="10" /></Trades>
</FlexStatement></FlexStatements></FlexQueryResponse>`;

describe('CapTraderImport', () => {
  const mockOnReportGenerated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('sollte den Wizard mit 4 Schritten rendern', () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      expect(screen.getByText('XML')).toBeInTheDocument();
      expect(screen.getByText('EZB')).toBeInTheDocument();
      expect(screen.getByText('Angaben')).toBeInTheDocument();
      expect(screen.getByText('Fertig')).toBeInTheDocument();
    });

    it('sollte den XML-Upload-Schritt als erstes anzeigen', () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      expect(screen.getByText('FlexQuery XML hochladen')).toBeInTheDocument();
      expect(screen.getByText('XML-Datei hier ablegen oder klicken')).toBeInTheDocument();
    });
  });

  describe('XML-Upload', () => {
    it('sollte XML-Datei akzeptieren', async () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const input = screen.getByLabelText(/XML-Datei/i) || screen.getByRole('button');

      // Simuliere Datei-Upload
      const fileInput = document.querySelector('input[type="file"]');
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('test.xml')).toBeInTheDocument();
      });
    });

    it('sollte den Weiter-Button aktivieren nach Upload', async () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const fileInput = document.querySelector('input[type="file"]');

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        const weiterButton = screen.getByText('Weiter zu EZB-Kursen');
        expect(weiterButton).not.toBeDisabled();
      });
    });
  });

  describe('Gemeinschaftskonto', () => {
    it('sollte den Toggle für Gemeinschaftskonto anzeigen', () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      // Gehe zu Schritt 3 (Angaben)
      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByText('Weiter zu EZB-Kursen'));
      fireEvent.click(screen.getByText('Überspringen'));

      expect(screen.getByText('Gemeinschaftskonto')).toBeInTheDocument();
    });

    it('sollte Person B anzeigen wenn Gemeinschaftskonto aktiviert', () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      // Gehe zu Schritt 3
      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByText('Weiter zu EZB-Kursen'));
      fireEvent.click(screen.getByText('Überspringen'));

      // Aktiviere Gemeinschaftskonto
      const toggle = screen.getByRole('button', { name: /Gemeinschaftskonto/i });
      fireEvent.click(toggle);

      expect(screen.getByText('Person B')).toBeInTheDocument();
    });

    it('sollte Anteile validieren (müssen 100% ergeben)', () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      // Gehe zu Schritt 3
      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByText('Weiter zu EZB-Kursen'));
      fireEvent.click(screen.getByText('Überspringen'));

      // Aktiviere Gemeinschaftskonto
      const toggle = screen.getByRole('button', { name: /Gemeinschaftskonto/i });
      fireEvent.click(toggle);

      // Ändere Anteile auf 60/40 (ungültig)
      const anteilA = screen.getAllByRole('spinbutton')[0];
      fireEvent.change(anteilA, { target: { value: '60' } });

      fireEvent.click(screen.getByText('Report generieren'));

      expect(screen.getByText(/Anteile müssen zusammen 100% ergeben/i)).toBeInTheDocument();
    });
  });

  describe('Kirchensteuer-Optionen', () => {
    it('sollte alle KS-Optionen anzeigen', () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      // Gehe zu Schritt 3
      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByText('Weiter zu EZB-Kursen'));
      fireEvent.click(screen.getByText('Überspringen'));

      expect(screen.getByText('Keine Kirchensteuer')).toBeInTheDocument();
      expect(screen.getByText('9% Kirchensteuer (Restliches Bundesland)')).toBeInTheDocument();
      expect(screen.getByText('8% Kirchensteuer (BW / Bayern)')).toBeInTheDocument();
    });
  });

  describe('Report-Generierung', () => {
    it('sollte onReportGenerated aufrufen nach erfolgreicher Generierung', async () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      // Schritt 1: XML hochladen
      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Schritt 2: EZB überspringen
      fireEvent.click(screen.getByText('Weiter zu EZB-Kursen'));
      fireEvent.click(screen.getByText('Überspringen'));

      // Schritt 3: Angaben ausfüllen
      const nameInput = screen.getByPlaceholderText('Name');
      fireEvent.change(nameInput, { target: { value: 'Max Mustermann' } });

      // Report generieren
      fireEvent.click(screen.getByText('Report generieren'));

      await waitFor(() => {
        expect(mockOnReportGenerated).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    it('sollte zwischen Schritten navigieren können', () => {
      render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);

      const file = new File([MOCK_XML], 'test.xml', { type: 'text/xml' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByText('Weiter zu EZB-Kursen'));
      expect(screen.getByText('EZB-Wechselkurse (optional)')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Zurück'));
      expect(screen.getByText('FlexQuery XML hochladen')).toBeInTheDocument();
    });
  });
});
