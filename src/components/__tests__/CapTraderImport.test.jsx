import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CapTraderImport from '../CapTraderImport';

const mockOnReportGenerated = vi.fn();

describe('CapTraderImport v2.0', () => {
  it('sollte initial den Schritt 1 anzeigen', () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    expect(screen.getByText('XML hochladen')).toBeInTheDocument();
  });

  it('sollte Steuerliche Angaben anzeigen', async () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    // FIX: Use getByText instead of getByLabelText (no label/aria-label on input)
    const file = new File(['<xml>test</xml>'], 'test.xml', { type: 'application/xml' });
    const input = screen.getByText(/XML-Datei/i).closest('div').querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Max Mustermann')).toBeInTheDocument();
    });
  });

  it('sollte Kirchensteuer-Info anzeigen', async () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    // Advance to step 2
    const file = new File(['<xml>test</xml>'], 'test.xml', { type: 'application/xml' });
    const input = screen.getByText(/XML-Datei/i).closest('div').querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Kirchensteuer')).toBeInTheDocument();
      expect(screen.getByText(/Varianten/)).toBeInTheDocument();
    });
  });

  it('sollte EZB-Upload optional anzeigen', () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    expect(screen.getByText(/EZB-Wechselkurse/i)).toBeInTheDocument();
    // FIX: Use getAllByText since "optional" appears twice
    expect(screen.getAllByText(/optional/i).length).toBeGreaterThanOrEqual(1);
  });

  it('sollte Gemeinschaftskonto-Toggle anzeigen', async () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    // Advance to step 3 (Kontotyp)
    const file = new File(['<xml>test</xml>'], 'test.xml', { type: 'application/xml' });
    const input = screen.getByText(/XML-Datei/i).closest('div').querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    // Fill step 2 and advance
    await waitFor(() => screen.getByPlaceholderText('Max Mustermann'));
    fireEvent.change(screen.getByPlaceholderText('Max Mustermann'), { 
      target: { value: 'Test User' } 
    });
    fireEvent.click(screen.getByRole('button', { name: /Weiter/i }));

    await waitFor(() => {
      expect(screen.getByText(/Gemeinschaftskonto/i)).toBeInTheDocument();
    });
  });
});
