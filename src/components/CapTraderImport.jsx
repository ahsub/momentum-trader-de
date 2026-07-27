import { useState, useCallback } from 'react';
import { parseMultipleFlexQueries, extractUnderlyings } from '../services/capTraderParser';
import { savePortfolioData, getCCScreenerInput, calculatePortfolioMetrics } from '../services/portfolioBridge';
import { generateAnnualReport, exportTaxCSV, exportTaxJSON } from '../services/taxReportService';

export default function CapTraderImport({ onImport, onClose }) {
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showTaxDetails, setShowTaxDetails] = useState(false);

  const handleFile = useCallback((file) => {
    if (!file.name.endsWith('.xml')) {
      setError('Nur .xml Dateien erlaubt');
      return;
    }
    setFiles(prev => [...prev, file]);
    setError(null);
  }, []);

  const parseFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const texts = await Promise.all(
        files.map(f => f.text())
      );
      const parsedData = parseMultipleFlexQueries(texts);

      // Portfolio-Metriken
      const metrics = calculatePortfolioMetrics(parsedData);
      const ccPositions = getCCScreenerInput(parsedData);

      // Steuerberichte für alle Jahre
      const years = [...new Set([
        ...(parsedData.allTrades?.map(t => new Date(t.tradeDate).getFullYear()) || []),
        ...(parsedData.allDividends?.map(d => new Date(d.date).getFullYear()) || [])
      ])].sort((a, b) => b - a);

      const taxReports = {};
      years.forEach(year => {
        taxReports[year] = generateAnnualReport(parsedData, year);
      });

      const previewData = {
        accountId: parsedData.accountInformation?.[0]?.accountId || 'Unbekannt',
        metrics: {
          totalValue: metrics.totalValue || 0,
          positionCount: metrics.positionCount || 0,
          totalUnrealized: metrics.totalUnrealized || 0,
        },
        positions: ccPositions || [],
        taxReports,
        years,
        parsedData,
      };

      setPreview(previewData);
      if (years.length > 0) setSelectedYear(years[0]);
    } catch (err) {
      console.error('Parse error:', err);
      setError('Fehler beim Parsen: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [files]);

  const handleImport = useCallback(() => {
    if (!preview) return;
    savePortfolioData(preview.parsedData);
    onImport?.(preview.parsedData);
    onClose?.();
  }, [preview, onImport, onClose]);

  const handleExportCSV = useCallback(() => {
    if (!preview?.taxReports || !selectedYear) return;
    const report = preview.taxReports[selectedYear];
    const csv = exportTaxCSV(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Steuer_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preview, selectedYear]);

  const handleExportJSON = useCallback(() => {
    if (!preview?.taxReports || !selectedYear) return;
    const report = preview.taxReports[selectedYear];
    const json = exportTaxJSON(report);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Steuer_${selectedYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preview, selectedYear]);

  const taxPreview = selectedYear && preview?.taxReports ? preview.taxReports[selectedYear] : null;

  // Hilfsfunktion: dailyBreakdown in dailyReport-Format umwandeln
  const getDailyReport = (report) => {
    if (!report?.dailyBreakdown) return [];
    return report.dailyBreakdown.map(day => ({
      dateFormatted: day.date ? new Date(day.date).toLocaleDateString('de-DE') : '',
      totalDay: day.total || 0,
      stockPnL: day.stockPnL || 0,
      optionsPnL: day.optionsPnL || 0,
      dividendIncome: day.dividends || 0,
      stockTrades: day.stockPnL !== 0 ? [{ pnl: day.stockPnL }] : [],
      optionTrades: day.optionsPnL !== 0 ? [{ premium: day.optionsPnL }] : [],
      dividends: day.dividends !== 0 ? [{ amount: day.dividends }] : [],
    }));
  };

  const dailyReport = taxPreview ? getDailyReport(taxPreview) : [];

  return (
    <div className="space-y-4">
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
        <div className="text-slate-400">
          {files.length > 0 ? `${files.length} Datei(en) ausgewählt` : 'Flex-Query XML hierher ziehen oder klicken'}
        </div>
        <div className="text-xs text-slate-500 mt-1">Nur .xml Dateien von CapTrader/IBKR</div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
              <span className="text-slate-300">{f.name}</span>
              <span className="text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Parse Button */}
      {files.length > 0 && !preview && (
        <button
          onClick={parseFiles}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Verarbeite...' : 'XML Parsen & Vorschau'}
        </button>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          {/* Portfolio Summary */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Portfolio-Vorschau</h3>
            <div className="text-xs text-slate-500">{preview.accountId}</div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Depotwert</div>
                <div className="text-lg font-semibold text-slate-200">
                  €{preview.metrics.totalValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Positionen</div>
                <div className="text-lg font-semibold text-slate-200">{preview.metrics.positionCount}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">CC-fähig (≥100 Shares)</div>
                <div className="text-lg font-semibold text-slate-200">{preview.positions.length}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Unrealisiert</div>
                <div className={`text-lg font-semibold ${preview.metrics.totalUnrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {preview.metrics.totalUnrealized >= 0 ? '+' : ''}
                  €{preview.metrics.totalUnrealized.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          {/* CC-Ready Positions */}
          {preview.positions.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-200">CC-Positionen</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {preview.positions.map(pos => (
                  <div key={pos.symbol} className="flex items-center justify-between text-sm bg-slate-900/50 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium text-slate-200">{pos.symbol}</span>
                      <span className="text-slate-500 ml-2">{pos.shares} Shares</span>
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

          {/* Tax Preview */}
          {preview.taxReports && preview.years.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">📊 Steuer-Vorschau</h3>

              {/* Year Selector */}
              <div className="flex gap-2 flex-wrap">
                {preview.years.map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedYear === year
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>

              {taxPreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Kapitalerträge</div>
                      <div className="text-sm font-semibold text-slate-200">
                        €{(taxPreview.summary?.stockPnL_EUR || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Optionsprämien</div>
                      <div className="text-sm font-semibold text-slate-200">
                        €{(taxPreview.summary?.optionsPnL_EUR || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Dividenden</div>
                      <div className="text-sm font-semibold text-slate-200">
                        €{(taxPreview.summary?.dividendIncome_EUR || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Gesamtsteuer</div>
                      <div className="text-sm font-semibold text-red-400">
                        €{(taxPreview.tax?.totalTax || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 col-span-2">
                      <div className="text-xs text-slate-500">Netto</div>
                      <div className="text-lg font-semibold text-emerald-400">
                        €{(taxPreview.tax?.netGain || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Tagesgenaue Aufstellung Toggle */}
                  <button
                    onClick={() => setShowTaxDetails(!showTaxDetails)}
                    className="w-full text-sm text-slate-400 hover:text-slate-200 py-2 border-t border-slate-700/50"
                  >
                    {showTaxDetails ? '▼' : '▶'} Tagesgenaue Aufstellung
                  </button>

                  {showTaxDetails && dailyReport.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {dailyReport.map((day, idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded-lg p-3 text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-slate-300">{day.dateFormatted}</span>
                            <span className={`font-semibold ${day.totalDay >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              €{day.totalDay.toFixed(2)}
                            </span>
                          </div>
                          {day.stockTrades.length > 0 && (
                            <div className="text-xs text-slate-500">
                              {day.stockTrades.length} Aktienverkäufe: €{day.stockPnL.toFixed(2)}
                            </div>
                          )}
                          {day.optionTrades.length > 0 && (
                            <div className="text-xs text-slate-500">
                              {day.optionTrades.length} Optionen: €{day.optionsPnL.toFixed(2)}
                            </div>
                          )}
                          {day.dividends.length > 0 && (
                            <div className="text-xs text-slate-500">
                              {day.dividends.length} Dividenden: €{day.dividendIncome.toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Export Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleExportCSV}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      📄 CSV Export
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      📋 JSON Export
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleImport}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              ✅ In Portfolio übernehmen
            </button>
            <button
              onClick={onClose}
              className="px-6 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2.5 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
