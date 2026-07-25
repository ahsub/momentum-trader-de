import { useState, useCallback } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import { parseCapTraderCSV, validateTrades } from '../utils/csvParser';
import { aggregatePositions, calculatePortfolioSummary } from '../utils/positionsEngine';

export default function ImportWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [csvContent, setCsvContent] = useState('');
  const [parsedTrades, setParsedTrades] = useState([]);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const setTrades = usePortfolioStore(s => s.setTrades);
  const setPositions = usePortfolioStore(s => s.setPositions);
  const setImportStatus = usePortfolioStore(s => s.setImportStatus);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.csv')) {
      setError('Bitte eine CSV-Datei hochladen');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result);
      setStep(2);
      setError(null);
    };
    reader.readAsText(file);
  }, []);

  const handleParse = useCallback(() => {
    setImportStatus('importing');
    setError(null);

    try {
      const trades = parseCapTraderCSV(csvContent);
      const validationResult = validateTrades(trades);

      setParsedTrades(trades);
      setValidation(validationResult);
      setStep(3);
      setImportStatus('success');
    } catch (err) {
      setError(`Parse-Fehler: ${err.message}`);
      setImportStatus('error', err.message);
    }
  }, [csvContent, setImportStatus]);

  const handleImport = useCallback(() => {
    // Mock market prices for calculation
    const marketPrices = {
      AAPL: 210.50,
      NVDA: 395.00,
      TSLA: 240.00,
      AMD: 148.00,
      JPM: 165.00,
      XOM: 115.00,
      PLTR: 28.50,
      MSFT: 350.00
    };

    const positions = aggregatePositions(parsedTrades, marketPrices);
    const summary = calculatePortfolioSummary(positions, 50000);

    setTrades(parsedTrades);
    setPositions(positions, summary);
    setStep(4);

    if (onComplete) onComplete();
  }, [parsedTrades, setTrades, setPositions, onComplete]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {['Datei', 'Validierung', 'Vorschau', 'Fertig'].map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
              ${step > i + 1 ? 'bg-emerald-500 text-white' : 
                step === i + 1 ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`ml-2 text-sm ${step >= i + 1 ? 'text-white' : 'text-slate-500'}`}>
              {label}
            </span>
            {i < 3 && <div className={`w-12 h-0.5 mx-2 ${step > i + 1 ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 bg-slate-800/50'}`}
        >
          <svg className="w-12 h-12 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-white font-medium mb-2">CapTrader CSV hierher ziehen</p>
          <p className="text-slate-400 text-sm mb-4">oder klicken zum Auswählen</p>
          <p className="text-slate-500 text-xs">Unterstützt: Activity Statement, Flex Query CSV</p>

          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => { setCsvContent(ev.target.result); setStep(2); };
                reader.readAsText(file);
              }
            }}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 
            text-white rounded-lg cursor-pointer transition-colors text-sm">
            Datei auswählen
          </label>
        </div>
      )}

      {/* Step 2: Validation */}
      {step === 2 && (
        <div className="bg-slate-800 rounded-xl p-6">
          <p className="text-white mb-4">CSV geladen. {csvContent.split('\n').length} Zeilen gefunden.</p>
          <button
            onClick={handleParse}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            Parsen & Validieren
          </button>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && validation && (
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Validierungsergebnis</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase">Gesamt Trades</p>
              <p className="text-2xl font-bold text-white">{validation.stats.total}</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase">Status</p>
              <p className={`text-lg font-bold ${validation.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {validation.valid ? '✓ Gültig' : '✗ Fehler'}
              </p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase">Aktien</p>
              <p className="text-xl font-bold text-white">{validation.stats.stocks}</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase">Optionen</p>
              <p className="text-xl font-bold text-white">{validation.stats.options}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              Importieren
            </button>
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Zurück
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && (
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Import erfolgreich!</h3>
          <p className="text-slate-400">{parsedTrades.length} Trades importiert.</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
