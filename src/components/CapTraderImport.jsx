import { useState, useCallback, useEffect } from 'react';
import { parseMultipleFlexQueries, extractUnderlyings } from '../services/capTraderParser';
import { savePortfolioData, getCCScreenerInput, calculatePortfolioMetrics } from '../services/portfolioBridge';
import { 
  generateAnnualReport, 
  exportTaxCSV, 
  exportTaxJSON, 
  exportTaxReportHTML,
  loadAllYearData,
  isYearLocked,
  clearAllYearData,
} from '../services/taxReportService';

export default function CapTraderImport({ onImport, onClose }) {
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  const [savedYears, setSavedYears] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [taxpayerInfo, setTaxpayerInfo] = useState(() => {
    const saved = localStorage.getItem('mt_taxpayer_info');
    return saved ? JSON.parse(saved) : { name: '', taxId: '', churchTax: 'none', isJoint: false, spouseName: '' };
  });

  // Load saved years on mount
  useEffect(() => {
    const allData = loadAllYearData();
    const years = Object.keys(allData).map(Number).sort((a, b) => b - a);
    setSavedYears(years);
  }, []);

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
      const texts = await Promise.all(files.map(f => f.text()));
      const parsedData = parseMultipleFlexQueries(texts);

      const metrics = calculatePortfolioMetrics(parsedData);
      const ccPositions = getCCScreenerInput(parsedData);

      const years = [...new Set([
        ...(parsedData.allTrades?.map(t => new Date(t.tradeDate).getFullYear()) || []),
        ...(parsedData.allDividends?.map(d => new Date(d.date).getFullYear()) || [])
      ])].sort((a, b) => b - a);

      const taxReports = {};
      years.forEach(year => {
        taxReports[year] = generateAnnualReport(parsedData, year, {
          churchTaxKey: taxpayerInfo.churchTax,
          isJointAccount: taxpayerInfo.isJoint,
        });
      });

      // Refresh saved years
      const allData = loadAllYearData();
      const allYears = Object.keys(allData).map(Number).sort((a, b) => b - a);
      setSavedYears(allYears);

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
  }, [files, taxpayerInfo]);

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
    downloadBlob(csv, `Steuer_${selectedYear}.csv`, 'text/csv;charset=utf-8;');
  }, [preview, selectedYear]);

  const handleExportJSON = useCallback(() => {
    if (!preview?.taxReports || !selectedYear) return;
    const report = preview.taxReports[selectedYear];
    const json = exportTaxJSON(report);
    downloadBlob(json, `Steuer_${selectedYear}.json`, 'application/json');
  }, [preview, selectedYear]);

  const handleExportHTML = useCallback(() => {
    if (!preview?.taxReports || !selectedYear) return;
    const report = preview.taxReports[selectedYear];
    const html = exportTaxReportHTML(report, {
      taxpayerName: taxpayerInfo.name,
      taxId: taxpayerInfo.taxId,
      churchTaxKey: taxpayerInfo.churchTax,
      isJointAccount: taxpayerInfo.isJoint,
      spouseName: taxpayerInfo.spouseName,
    });
    downloadBlob(html, `Steuerbericht_${selectedYear}.html`, 'text/html;charset=utf-8');
  }, [preview, selectedYear, taxpayerInfo]);

  const handlePrintReport = useCallback(() => {
    if (!preview?.taxReports || !selectedYear) return;
    const report = preview.taxReports[selectedYear];
    const html = exportTaxReportHTML(report, {
      taxpayerName: taxpayerInfo.name,
      taxId: taxpayerInfo.taxId,
      churchTaxKey: taxpayerInfo.churchTax,
      isJointAccount: taxpayerInfo.isJoint,
      spouseName: taxpayerInfo.spouseName,
    });
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }, [preview, selectedYear, taxpayerInfo]);

  const handleSaveTaxpayerInfo = useCallback(() => {
    localStorage.setItem('mt_taxpayer_info', JSON.stringify(taxpayerInfo));
  }, [taxpayerInfo]);

  const handleClearAllData = useCallback(() => {
    if (confirm('⚠️ Alle gespeicherten Steuerdaten löschen? Dies kann nicht rückgängig gemacht werden.')) {
      clearAllYearData();
      setSavedYears([]);
      setPreview(null);
    }
  }, []);

  const taxPreview = selectedYear && preview?.taxReports ? preview.taxReports[selectedYear] : null;
  const currentYear = new Date().getFullYear();

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
    <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
      {/* Taxpayer Info */}
      <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">📝 Steuerpflichtiger</h3>
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
          <select
            value={taxpayerInfo.churchTax}
            onChange={e => setTaxpayerInfo(p => ({ ...p, churchTax: e.target.value }))}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="none">Keine Kirchensteuer</option>
            <option value="bw_bayern">Kirchensteuer 8% (BW/Bayern)</option>
            <option value="other">Kirchensteuer 9% (andere BL)</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isJoint"
              checked={taxpayerInfo.isJoint}
              onChange={e => setTaxpayerInfo(p => ({ ...p, isJoint: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-600"
            />
            <label htmlFor="isJoint" className="text-sm text-slate-300">Gemeinschaftskonto</label>
          </div>
          {taxpayerInfo.isJoint && (
            <input
              type="text"
              placeholder="Ehegatte Name"
              value={taxpayerInfo.spouseName}
              onChange={e => setTaxpayerInfo(p => ({ ...p, spouseName: e.target.value }))}
              className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          )}
        </div>
        <button
          onClick={handleSaveTaxpayerInfo}
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          💾 Steuerpflichtiger speichern
        </button>
      </div>

      {/* Saved Years Overview */}
      {savedYears.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">📁 Gespeicherte Steuerjahre</h3>
            <button
              onClick={handleClearAllData}
              className="text-xs text-red-400 hover:text-red-300"
            >
              🗑️ Alle löschen
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {savedYears.map(year => {
              const isLocked = isYearLocked(year);
              const data = loadAllYearData()[year];
              return (
                <div
                  key={year}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    isLocked 
                      ? 'bg-slate-700/50 text-slate-400 border border-slate-600' 
                      : 'bg-amber-900/30 text-amber-300 border border-amber-700/50'
                  }`}
                >
                  <div className="font-semibold">{year}</div>
                  <div className="text-xs opacity-70">
                    {isLocked ? '🔒 Abgeschlossen' : '📝 Aktuell'}
                  </div>
                  {data?.summary && (
                    <div className="text-xs mt-1">
                      Gewinn: €{data.summary.totalRealizedPnL_EUR?.toFixed(0) || 0}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-slate-500">
            🔒 Abgeschlossene Jahre werden bei neuen Imports nicht überschrieben – nur ergänzt.
            📝 Das aktuelle Jahr wird bei jedem Import aktualisiert.
          </div>
        </div>
      )}

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
                    {year} {isYearLocked(year) ? '🔒' : year === currentYear ? '📝' : ''}
                  </button>
                ))}
              </div>

              {taxPreview && (
                <div className="space-y-3">
                  {/* KAP Zeilen */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Z. 7 – Dividenden</div>
                      <div className="text-sm font-semibold text-slate-200">
                        €{(taxPreview.kapZeilen?.z7 || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Z. 8 – Aktiengewinne</div>
                      <div className="text-sm font-semibold text-emerald-400">
                        €{(taxPreview.kapZeilen?.z8 || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Z. 9 – Aktienverluste</div>
                      <div className="text-sm font-semibold text-rose-400">
                        €{(taxPreview.kapZeilen?.z9 || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Z. 12 – Optionsgewinne</div>
                      <div className="text-sm font-semibold text-emerald-400">
                        €{(taxPreview.kapZeilen?.z12 || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Z. 13 – Optionsverluste</div>
                      <div className="text-sm font-semibold text-rose-400">
                        €{(taxPreview.kapZeilen?.z13 || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Z. 14 – Zinsen</div>
                      <div className="text-sm font-semibold text-slate-200">
                        €{(taxPreview.kapZeilen?.z14 || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 col-span-2 border border-emerald-500/30">
                      <div className="text-xs text-slate-500">Z. 41 – Anrechenbare Quellensteuer</div>
                      <div className="text-lg font-semibold text-emerald-400">
                        €{(taxPreview.kapZeilen?.z41 || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Steuerzusammenfassung */}
                  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-emerald-300">💰 Steuerliche Zusammenfassung</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-slate-400">Gesamte Erträge:</span>
                      <span className="text-slate-200 text-right">€{(taxPreview.tax?.totalGains || 0).toFixed(2)}</span>
                      <span className="text-slate-400">Sparer-Pauschbetrag:</span>
                      <span className="text-slate-200 text-right">€{(taxPreview.tax?.usedAllowance || 0).toFixed(2)} / €{taxPreview.tax?.sparerPauschbetrag || 1000}</span>
                      <span className="text-slate-400">Steuerpflichtig:</span>
                      <span className="text-slate-200 text-right">€{(taxPreview.tax?.taxableGains || 0).toFixed(2)}</span>
                      <span className="text-slate-400">Abgeltungsteuer (25%):</span>
                      <span className="text-slate-200 text-right">€{(taxPreview.tax?.abgeltungsteuer || 0).toFixed(2)}</span>
                      <span className="text-slate-400">Soli (5,5%):</span>
                      <span className="text-slate-200 text-right">€{(taxPreview.tax?.soli || 0).toFixed(2)}</span>
                      <span className="text-slate-400">Kirchensteuer:</span>
                      <span className="text-slate-200 text-right">€{(taxPreview.tax?.kirchensteuer || 0).toFixed(2)}</span>
                      <span className="text-slate-400 font-semibold">Gesamtsteuer:</span>
                      <span className="text-rose-400 text-right font-semibold">€{(taxPreview.tax?.totalTax || 0).toFixed(2)}</span>
                      <span className="text-slate-400 font-semibold">Netto:</span>
                      <span className="text-emerald-400 text-right font-semibold text-lg">€{(taxPreview.tax?.netGain || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Verlustvortrag Warnung */}
                  {taxPreview.toepfe?.termin?.vortrag > 0 && (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 text-sm">
                      <strong className="text-amber-400">⚠️ Verlustvortrag:</strong>{' '}
                      <span className="text-slate-300">
                        €{taxPreview.toepfe.termin.vortrag.toFixed(2)} Termingeschäftsverlust werden ins Folgejahr übertragen 
                        (§20 Abs. 6 Satz 5 EStG – max. €20.000/Jahr).
                      </span>
                    </div>
                  )}

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
                              📈 Aktien: €{day.stockPnL.toFixed(2)}
                            </div>
                          )}
                          {day.optionTrades.length > 0 && (
                            <div className="text-xs text-slate-500">
                              🎯 Optionen: €{day.optionsPnL.toFixed(2)}
                            </div>
                          )}
                          {day.dividends.length > 0 && (
                            <div className="text-xs text-slate-500">
                              💵 Dividenden: €{day.dividendIncome.toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Export Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={handleExportCSV}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      📄 CSV Export
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      📋 JSON Export
                    </button>
                    <button
                      onClick={handleExportHTML}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      🌐 HTML Export
                    </button>
                    <button
                      onClick={handlePrintReport}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      🖨️ Drucken / PDF
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

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
