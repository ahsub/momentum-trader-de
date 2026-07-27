import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { parseMultipleFlexQueries, extractUnderlyings } from '../services/capTraderParser';
import { savePortfolioData, getCCScreenerInput, calculatePortfolioMetrics } from '../services/portfolioBridge';
import { generateAnnualReport, exportTaxCSV, exportTaxJSON } from '../services/taxReportService';

export default function CapTraderImport({ onImport, onClose }) {
  const [files, setFiles] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [taxPreview, setTaxPreview] = useState(null);
  const [showTaxDetails, setShowTaxDetails] = useState(false);

  const handleFile = useCallback(async (file) => {
    if (!file.name.endsWith('.xml')) {
      setError('Nur .xml Dateien von CapTrader/IBKR Flex Query');
      return;
    }

    try {
      const text = await file.text();
      setFiles(prev => [...prev, { name: file.name, content: text, size: file.size }]);
      setError(null);
    } catch (err) {
      setError('Fehler beim Lesen: ' + err.message);
    }
  }, []);

  const parseFiles = useCallback(() => {
    if (files.length === 0) return;
    setParsing(true);
    setError(null);

    try {
      const xmlStrings = files.map(f => f.content);
      const parsed = parseMultipleFlexQueries(xmlStrings);
      
      const positions = getCCScreenerInput(parsed);
      const metrics = calculatePortfolioMetrics(parsed);
      const underlyings = extractUnderlyings(parsed);

      // Tax preview for available years
      const years = [...new Set(parsed.allTrades?.map(t => new Date(t.tradeDate).getFullYear()) || [])].sort();
      const taxReports = {};
      years.forEach(year => {
        taxReports[year] = generateAnnualReport(parsed, year);
      });

      setPreview({
        positions,
        metrics,
        underlyings,
        fileCount: files.length,
        accountId: parsed.meta[0]?.accountId,
        dateRange: `${parsed.meta[0]?.fromDate} – ${parsed.meta[parsed.meta.length - 1]?.toDate}`,
        taxReports,
        years,
      });
      
      setTaxPreview(taxReports[years[years.length - 1]]);
    } catch (err) {
      setError('Parse-Fehler: ' + err.message);
    } finally {
      setParsing(false);
    }
  }, [files]);

  const confirmImport = useCallback(() => {
    if (!preview) return;
    
    const xmlStrings = files.map(f => f.content);
    const parsed = parseMultipleFlexQueries(xmlStrings);
    savePortfolioData(parsed);
    
    onImport?.({
      portfolio: parsed,
      ccInput: getCCScreenerInput(parsed),
      metrics: calculatePortfolioMetrics(parsed),
    });
    
    onClose?.();
  }, [files, preview, onImport, onClose]);

  const downloadTaxCSV = () => {
    if (!taxPreview) return;
    const csv = exportTaxCSV(taxPreview);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Steuerreport_${taxPreview.year}.csv`;
    link.click();
  };

  const downloadTaxJSON = () => {
    if (!taxPreview) return;
    const json = exportTaxJSON(taxPreview);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Steuerreport_${taxPreview.year}.json`;
    link.click();
  };

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
      {/* Upload Zone */}
      <div
        onDrop={(e) => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(handleFile); }}
        onDragOver={(e) => e.preventDefault()}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          files.length > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/30 hover:border-slate-600'
        }`}
      >
        <input
          type="file"
          accept=".xml"
          multiple
          onChange={(e) => Array.from(e.target.files).forEach(handleFile)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className="mx-auto h-8 w-8 text-slate-500 mb-2" />
        <p className="text-slate-300 font-medium">
          {files.length > 0 ? `${files.length} Datei(en) ausgewählt` : 'Flex-Query XML hierher ziehen oder klicken'}
        </p>
        <p className="text-slate-500 text-sm mt-1">Nur .xml Dateien von CapTrader/IBKR</p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">{f.name}</span>
              </div>
              <span className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Parse Button */}
      {files.length > 0 && !preview && (
        <button
          onClick={parseFiles}
          disabled={parsing}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {parsing ? 'Parse...' : 'XML Parsen & Vorschau'}
        </button>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          {/* Portfolio Summary */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" /> Portfolio-Vorschau
              </h3>
              <span className="text-xs text-slate-500 font-mono">{preview.accountId}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs">Depotwert</div>
                <div className="text-emerald-400 font-mono text-lg">
                  €{preview.metrics.totalValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs">Positionen</div>
                <div className="text-slate-200 font-mono text-lg">{preview.metrics.positionCount}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs">CC-fähig (≥100 Shares)</div>
                <div className="text-purple-400 font-mono text-lg">{preview.positions.length}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs">Unrealisiert</div>
                <div className={`font-mono text-lg ${preview.metrics.totalUnrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {preview.metrics.totalUnrealized >= 0 ? '+' : ''}
                  €{preview.metrics.totalUnrealized.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* CC-Ready Positions */}
            {preview.positions.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">CC-Positionen</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {preview.positions.map(pos => (
                    <div key={pos.symbol} className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-200">{pos.symbol}</span>
                        <span className="text-xs text-slate-500">{pos.shares} Shares</span>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-300">€{pos.marketPrice.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">Ø €{pos.avgCost.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tax Preview */}
          {preview.taxReports && preview.years.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-200">📊 Steuer-Vorschau</h3>
                <div className="flex gap-1">
                  {preview.years.map(year => (
                    <button
                      key={year}
                      onClick={() => setTaxPreview(preview.taxReports[year])}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        taxPreview?.year === year ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              {taxPreview && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-900/50 rounded p-2">
                      <div className="text-slate-500">Kapitalerträge</div>
                      <div className="font-mono text-emerald-400">€{taxPreview.summary.stockPnL.toFixed(2)}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded p-2">
                      <div className="text-slate-500">Optionsprämien</div>
                      <div className="font-mono text-amber-400">€{taxPreview.summary.optionsPnL.toFixed(2)}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded p-2">
                      <div className="text-slate-500">Dividenden</div>
                      <div className="font-mono text-blue-400">€{taxPreview.summary.dividendIncome.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/50 rounded p-2">
                      <div className="text-slate-500">Gesamtsteuer</div>
                      <div className="font-mono text-rose-400">€{taxPreview.tax.totalTax.toFixed(2)}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded p-2">
                      <div className="text-slate-500">Netto</div>
                      <div className="font-mono text-emerald-400">€{taxPreview.tax.netGain.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Tagesgenaue Aufstellung Toggle */}
                  <button
                    onClick={() => setShowTaxDetails(!showTaxDetails)}
                    className="w-full text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded transition-colors"
                  >
                    {showTaxDetails ? '▼' : '▶'} Tagesgenaue Aufstellung ({taxPreview.dailyReport?.length} Tage)
                  </button>

                  {showTaxDetails && taxPreview.dailyReport && (
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {taxPreview.dailyReport.map(day => (
                        <div key={day.date} className="bg-slate-900/30 rounded p-2 text-xs">
                          <div className="flex items-center justify-between font-medium text-slate-300">
                            <span>{day.dateFormatted}</span>
                            <span className={day.totalDay >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              €{day.totalDay.toFixed(2)}
                            </span>
                          </div>
                          {day.stockTrades.length > 0 && (
                            <div className="text-slate-500 mt-1">
                              {day.stockTrades.length} Aktienverkäufe: €{day.stockPnL.toFixed(2)}
                            </div>
                          )}
                          {day.optionTrades.length > 0 && (
                            <div className="text-slate-500">
                              {day.optionTrades.length} Optionen: €{day.optionPremium.toFixed(2)}
                            </div>
                          )}
                          {day.dividends.length > 0 && (
                            <div className="text-slate-500">
                              {day.dividends.length} Dividenden: €{day.dividendIncome.toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Export Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={downloadTaxCSV}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-2 rounded transition-colors"
                    >
                      📄 CSV Export
                    </button>
                    <button
                      onClick={downloadTaxJSON}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-2 rounded transition-colors"
                    >
                      📋 JSON Export
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={confirmImport}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg transition-colors"
            >
              ✅ Importieren & Speichern
            </button>
            <button
              onClick={() => { setFiles([]); setPreview(null); setTaxPreview(null); }}
              className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              Zurück
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
