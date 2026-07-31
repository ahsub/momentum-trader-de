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
    // Simulate XML upload to advance wizard
    const file = new File(['<xml>test</xml>'], 'test.xml', { type: 'application/xml' });
    const input = screen.getByLabelText(/XML-Datei/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Max Mustermann')).toBeInTheDocument();
    });
  });

  it('sollte Kirchensteuer-Info anzeigen', async () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    // Advance to step 2
    const file = new File(['<xml>test</xml>'], 'test.xml', { type: 'application/xml' });
    const input = screen.getByLabelText(/XML-Datei/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Kirchensteuer')).toBeInTheDocument();
      expect(screen.getByText(/Varianten/)).toBeInTheDocument();
    });
  });

  it('sollte EZB-Upload optional anzeigen', () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    expect(screen.getByText(/EZB-Wechselkurse/i)).toBeInTheDocument();
    expect(screen.getByText(/Optional\. Für präzisere Umrechnungen/i)).toBeInTheDocument();
  });

  it('sollte Gemeinschaftskonto-Toggle anzeigen', async () => {
    render(<CapTraderImport onReportGenerated={mockOnReportGenerated} />);
    // Advance to step 3 (Kontotyp)
    const file = new File(['<xml>test</xml>'], 'test.xml', { type: 'application/xml' });
    const input = screen.getByLabelText(/XML-Datei/i);
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
