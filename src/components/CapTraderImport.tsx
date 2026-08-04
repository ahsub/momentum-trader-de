// src/components/CapTraderImport.tsx
import React, { useState, useRef } from 'react';
import { Upload, FileText, Calculator, Download, AlertCircle } from 'lucide-react';
import { useTaxEngine } from '@/hooks/useTaxEngine';
import { CapTraderImportService } from '@/services/tax/report/CapTraderImportService';
import { TaxReportPanel } from './tax/TaxReportPanel';

export default function CapTraderImport() {
  const [step, setStep] = useState(1);
  const [xmlContent, setXmlContent] = useState('');
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    results,
    summary,
    addPositions,
    calculateTrades,
    clear,
    exportReport,
  } = useTaxEngine();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setXmlContent(event.target?.result as string);
      setStep(2);
      setError('');
    };
    reader.onerror = () => setError('Fehler beim Lesen der Datei');
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!xmlContent) {
      setError('Bitte zuerst eine FlexQuery-XML Datei hochladen');
      return;
    }

    setIsLoading(true);
    setError('');
    clear();

    try {
      const service = new CapTraderImportService({
        taxYear,
        steuerpflichtiger: 'Steuerpflichtiger',
        broker: 'CapTrader (Interactive Brokers)',
        isGemeinschaftskonto: false,
      });

      await service.initialize();
      const report = await service.processFlexQuery(xmlContent);

      addPositions(report.positions);
      calculateTrades(report.trades);

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Upload className="h-5 w-5 text-emerald-400" />
          CapTrader / Interactive Brokers Import
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Importiere FlexQuery-XML und berechne Steuern mit der neuen Engine
        </p>
      </div>

      {step === 1 && (
        <div className="rounded-lg border border-dashed border-slate-600 bg-slate-900/30 p-8 text-center">
          <input ref={fileInputRef} type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="mx-auto flex flex-col items-center gap-3 rounded-lg border border-slate-600 bg-slate-800/50 px-8 py-6 transition-all hover:border-emerald-500 hover:bg-slate-800">
            <Upload className="h-10 w-10 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">FlexQuery-XML hochladen</span>
            <span className="text-xs text-slate-500">Oder per Drag & Drop</span>
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <FileText className="h-5 w-5" />
            <span className="text-sm font-medium">{xmlContent.length.toLocaleString()} Zeichen geladen</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Steuerjahr</label>
            <input type="number" value={taxYear} onChange={(e) => setTaxYear(parseInt(e.target.value))} className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleProcess} disabled={isLoading} className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              <Calculator className="h-4 w-4" />
              {isLoading ? 'Berechne...' : 'Steuern berechnen'}
            </button>
            <button onClick={() => { setStep(1); setXmlContent(''); }} className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Zurück</button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 flex items-center gap-2 text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Steuerbericht {taxYear}</h3>
            <div className="flex gap-2">
              <button onClick={() => exportReport(`steuerbericht-captrader-${taxYear}.json`)} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Download className="h-4 w-4" /> Export JSON
              </button>
              <button onClick={() => { setStep(1); clear(); setXmlContent(''); }} className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Neu importieren</button>
            </div>
          </div>
          <TaxReportPanel results={results} summary={summary} onExport={() => exportReport(`steuerbericht-captrader-${taxYear}.json`)} onClear={clear} />
        </div>
      )}
    </div>
  );
}
