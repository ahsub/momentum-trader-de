import { useState, useCallback, useMemo } from 'react';
import { parseMultipleFlexQueries, extractUnderlyings } from '../services/capTraderParser';
import { savePortfolioData, getCCScreenerInput, calculatePortfolioMetrics } from '../services/portfolioBridge';
import { generateAnnualReport, exportTaxCSV, exportTaxJSON } from '../services/taxReportService';

export default function CapTraderImport({ onImport, onClose }) {
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  const [taxpayerInfo, setTaxpayerInfo] = useState({
    name: '', taxId: '', isJoint: false, spouseName: ''
  });

  const handleFile = useCallback((file) => {
    if (!file.name.endsWith('.xml')) {
      setError('Nur .xml Dateien werden unterstützt');
      return;
    }
    setFiles(prev => [...prev, file]);
    setError(null);
  }, []);

  const parseFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fileContents = await Promise.all(
        files.map(f => f.text())
      );
      const parsed = parseMultipleFlexQueries(fileContents);
      
      // Portfolio-Metriken
      const metrics = calculatePortfolioMetrics(parsed);
      const ccPositions = getCCScreenerInput(parsed);
      
      // Steuerberichte pro Jahr generieren
      const years = [...new Set([
        ...(parsed.allTrades?.map(t => new Date(t.tradeDate).getFullYear()) || []),
        ...(parsed.allDividends?.map(d => new Date(d.date).getFullYear()) || [])
      ])].sort((a, b) => b - a);

      const taxReports = {};
      for (const year of years) {
        try {
          taxReports[year] = generateAnnualReport(parsed, year, {
            kirchensteuer: false,
            sparerPauschbetrag: 1000,
            isJoint: taxpayerInfo.isJoint
          });
        } catch (e) {
          console.warn(`Steuerbericht für ${year} fehlgeschlagen:`, e);
        }
      }

      const previewData = {
        accountId: parsed.accountId || 'Unbekannt',
        metrics,
        positions: ccPositions,
        taxReports,
        years,
        raw: parsed
      };

      setPreview(previewData);
      setSelectedYear(years[0] || null);
      savePortfolioData(parsed);
    } catch (err) {
      setError(err.message || 'Fehler beim Parsen der XML-Dateien');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [files, taxpayerInfo]);

  const taxPreview = useMemo(() => {
    if (!preview?.taxReports || !selectedYear) return null;
    return preview.taxReports[selectedYear] || null;
  }, [preview, selectedYear]);

  const dailyReport = useMemo(() => {
    return taxPreview?.dailyBreakdown || [];
  }, [taxPreview]);

  const handleImport = useCallback(() => {
    if (!preview) return;
    onImport?.({
      portfolio: preview.raw,
      metrics: preview.metrics,
      positions: preview.positions,
      taxReports: preview.taxReports,
      taxpayerInfo
    });
  }, [preview, taxpayerInfo, onImport]);

  const handleExportCSV = useCallback(() => {
    if (!taxPreview) return;
    const csv = exportTaxCSV(taxPreview, taxpayerInfo);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Steuerbericht_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [taxPreview, selectedYear, taxpayerInfo]);

  const handleExportJSON = useCallback(() => {
    if (!taxPreview) return;
    const json = exportTaxJSON(taxPreview, taxpayerInfo);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `Steuerbericht_${selectedYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [taxPreview, selectedYear, taxpayerInfo]);

  // Gespeicherte Jahre aus localStorage
  const savedYears = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem('captrader_tax_years') || '{}');
      return Object.keys(data).map(Number).sort((a, b) => b - a);
    } catch {
      return [];
    }
  }, []);

  const isYearLocked = useCallback((year) => {
    try {
      const data = JSON.parse(localStorage.getItem('captrader_tax_years') || '{}');
      return data[year]?.locked || false;
    } catch {
      return false;
    }
  }, []);

  const loadAllYearData = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('captrader_tax_years') || '{}');
    } catch {
      return {};
    }
  }, []);

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
      {/* Taxpayer Info */}
      <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">📝 Steuerpflichtiger</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Name"
            value={taxpayerInfo.name}
            onChange={e => setTaxpayerInfo(p => ({ ...p, name: e.target.value }))}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="Steuer-ID"
            value={taxpayerInfo.taxId}
            onChange={e => setTaxpayerInfo(p => ({ ...p, taxId: e.target.value }))}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={taxpayerInfo.isJoint}
            onChange={e => setTaxpayerInfo(p => ({ ...p, isJoint: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-600"
          />
          Gemeinschaftskonto
        </label>
        {taxpayerInfo.isJoint && (
          <input
            type="text"
            placeholder="Name Ehegatte"
            value={taxpayerInfo.spouseName}
            onChange={e => setTaxpayerInfo(p => ({ ...p, spouseName: e.target.value }))}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full"
          />
        )}
      </div>

      {/* Saved Years Overview */}
      {savedYears.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📁 Gespeicherte Steuerjahre</h3>
          <div className="flex flex-wrap gap-2">
            {savedYears.map(year => {
              const isLocked = isYearLocked(year);
              const data = loadAllYearData()[year];
              return (
                <div key={year} className={`px-3 py-2 rounded-lg text-sm ${isLocked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  <div className="font-semibold">{year}</div>
                  <div className="text-xs opacity-75">{isLocked ? '🔒 Abgeschlossen' : '📝 Aktuell'}</div>
                  {data?.summary && (
                    <div className="text-xs mt-1">
                      Gewinn: €{(data.summary.totalRealizedPnL_EUR || 0).toFixed(0)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            🔒 Abgeschlossene Jahre werden bei neuen Imports nicht überschrieben – nur ergänzt.
            📝 Das aktuelle Jahr wird bei jedem Import aktualisiert.
          </p>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(handleFile); }}
        onDragOver={e => e.preventDefault()}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          files.length > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/30 hover:border-slate-600'
        }`}
      >
        <input
          type="file"
          accept=".xml"
          multiple
          onChange={e => Array.from(e.target.files).forEach(handleFile)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="text-slate-400 text-sm">
          {files.length > 0 ? `${files.length} Datei(en) ausgewählt` : 'Flex-Query XML hierher ziehen oder klicken'}
        </div>
        <div className="text-xs text-slate-600 mt-1">Nur .xml Dateien von CapTrader/IBKR</div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2 text-sm">
              <span className="text-slate-300">{f.name}</span>
              <span className="text-slate-500 text-xs">{(f.size / 1024).toFixed(1)} KB</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Parse Button */}
      {files.length > 0 && !preview && (
        <button
          onClick={parseFiles}
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-medium py-3 rounded-xl transition-colors"
        >
          {isLoading ? 'Wird verarbeitet...' : 'XML Parsen & Vorschau'}
        </button>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-6">
          {/* Portfolio Summary */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 Portfolio-Vorschau</h3>
            <div className="text-xs text-slate-500 mb-2">{preview.accountId}</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Depotwert</div>
                <div className="text-lg font-semibold text-slate-200">
                  €{(preview.metrics?.totalValue || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Positionen</div>
                <div className="text-lg font-semibold text-slate-200">{preview.metrics?.positionCount || 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">CC-fähig (≥100 Shares)</div>
                <div className="text-lg font-semibold text-emerald-400">{preview.positions?.length || 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Unrealisiert</div>
                <div className={`text-lg font-semibold ${(preview.metrics?.totalUnrealized || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(preview.metrics?.totalUnrealized || 0) >= 0 ? '+' : ''}
                  €{(preview.metrics?.totalUnrealized || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* CC-Ready Positions */}
            {preview.positions && preview.positions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">CC-Positionen</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {preview.positions.map((pos, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 font-medium">{pos.symbol}</span>
                      <span className="text-slate-400">{pos.shares} Shares</span>
                      <span className="text-emerald-400">€{(pos.marketPrice || 0).toFixed(2)}</span>
                      <span className="text-slate-500 text-xs">Ø €{(pos.avgCost || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tax Preview */}
          {preview.taxReports && preview.years && preview.years.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 Steuer-Vorschau</h3>
              
              {/* Year Selector */}
              <div className="flex gap-2 mb-4">
                {preview.years.map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedYear === year
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>

              {taxPreview && (
                <div className="space-y-4">
                  {/* KAP Zeilen */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Z. 7 – Dividenden</span>
                      <span className="text-slate-200">€{((taxPreview.kapZeilen?.z7) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Z. 8 – Aktiengewinne</span>
                      <span className="text-slate-200">€{((taxPreview.kapZeilen?.z8) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Z. 9 – Aktienverluste</span>
                      <span className="text-slate-200">€{((taxPreview.kapZeilen?.z9) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Z. 12 – Optionsgewinne</span>
                      <span className="text-slate-200">€{((taxPreview.kapZeilen?.z12) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Z. 13 – Optionsverluste</span>
                      <span className="text-slate-200">€{((taxPreview.kapZeilen?.z13) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Z. 14 – Zinsen</span>
                      <span className="text-slate-200">€{((taxPreview.kapZeilen?.z14) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-900/30 rounded-lg px-3 py-2 col-span-2">
                      <span className="text-slate-400">Z. 41 – Anrechenbare Quellensteuer</span>
                      <span className="text-slate-200">€{((taxPreview.kapZeilen?.z41) || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Steuerzusammenfassung */}
                  <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">💰 Steuerliche Zusammenfassung</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">Gesamte Erträge:</span><span className="text-slate-200">€{((taxPreview.tax?.totalGains) || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Sparer-Pauschbetrag:</span><span className="text-slate-200">€{((taxPreview.tax?.usedAllowance) || 0).toFixed(2)} / €{taxPreview.tax?.sparerPauschbetrag || 1000}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Steuerpflichtig:</span><span className="text-slate-200">€{((taxPreview.tax?.taxableGains) || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Abgeltungsteuer (25%):</span><span className="text-slate-200">€{((taxPreview.tax?.abgeltungsteuer) || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Soli (5,5%):</span><span className="text-slate-200">€{((taxPreview.tax?.soli) || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Kirchensteuer:</span><span className="text-slate-200">€{((taxPreview.tax?.kirchensteuer) || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-700 pt-2 mt-2"><span className="text-slate-300 font-medium">Gesamtsteuer:</span><span className="text-red-400 font-medium">€{((taxPreview.tax?.totalTax) || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-300 font-medium">Netto:</span><span className="text-emerald-400 font-medium">€{((taxPreview.tax?.netGain) || 0).toFixed(2)}</span></div>
                    </div>
                  </div>

                  {/* Verlustvortrag Warnung */}
                  {(taxPreview.toepfe?.termin?.vortrag || 0) > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-400">
                      <strong>⚠️ Verlustvortrag:</strong>{' '}
                      €{(taxPreview.toepfe.termin.vortrag || 0).toFixed(2)} Termingeschäftsverlust werden ins Folgejahr übertragen
                      (§20 Abs. 6 Satz 5 EStG – max. €20.000/Jahr).
                    </div>
                  )}

                  {/* Tagesgenaue Aufstellung Toggle */}
                  <button
                    onClick={() => setShowTaxDetails(!showTaxDetails)}
                    className="w-full text-sm text-slate-400 hover:text-slate-300 py-2 border border-slate-700 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    {showTaxDetails ? '▼ Details ausblenden' : '▶ Tagesgenaue Aufstellung'}
                  </button>

                  {showTaxDetails && dailyReport.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {dailyReport.map((day, idx) => (
                        <div key={idx} className="bg-slate-900/30 rounded-lg p-3 text-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400 font-medium">{day.date || day.dateFormatted || 'Unbekannt'}</span>
                            <span className={`font-semibold ${(day.total || day.totalDay || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              €{((day.total || day.totalDay || 0)).toFixed(2)}
                            </span>
                          </div>
                          {(day.stockTrades?.length > 0 || (day.stockPnL || 0) !== 0) && (
                            <div className="text-xs text-slate-500">
                              📈 Aktien: €{((day.stockPnL) || 0).toFixed(2)}
                            </div>
                          )}
                          {(day.optionTrades?.length > 0 || (day.optionsPnL || 0) !== 0) && (
                            <div className="text-xs text-slate-500">
                              🎯 Optionen: €{((day.optionsPnL) || 0).toFixed(2)}
                            </div>
                          )}
                          {(day.dividends?.length > 0 || (day.dividendIncome || 0) !== 0) && (
                            <div className="text-xs text-slate-500">
                              💵 Dividenden: €{((day.dividendIncome) || 0).toFixed(2)}
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
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      📄 CSV Export
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors"
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
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              ✅ Importieren & Speichern
            </button>
            <button
              onClick={onClose}
              className="px-6 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 rounded-xl transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
