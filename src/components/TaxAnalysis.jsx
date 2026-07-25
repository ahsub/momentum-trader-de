import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Euro, Calendar, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { parseTaxCSV, mergeTaxCSVs, getYearlyOverview, TAX_CATEGORIES } from '../services/taxParser';
import { calculateGermanTax, getRefundDeadline, WITHHOLDING_RATES } from '../services/taxRules';

export default function TaxAnalysis() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [merged, setMerged] = useState(null);
  const [yearly, setYearly] = useState(null);
  const [activeYear, setActiveYear] = useState(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.csv')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseTaxCSV(e.target.result, file.name);
      setResults(prev => [...prev, parsed]);
      setFiles(prev => [...prev, file.name]);
    };
    reader.readAsText(file);
  }, []);

  const analyzeAll = () => {
    const mergedResult = mergeTaxCSVs(results);
    setMerged(mergedResult);
    const years = getYearlyOverview(mergedResult.transactions);
    setYearly(years);
    const latestYear = Object.keys(years).sort().pop();
    setActiveYear(latestYear);
  };

  const currentYearData = activeYear && yearly ? yearly[activeYear] : null;
  const taxCalc = currentYearData ? calculateGermanTax(currentYearData.summary.capitalGains + currentYearData.summary.investmentIncome) : null;

  const catColors = {
    [TAX_CATEGORIES.DIVIDEND]: 'text-emerald-400',
    [TAX_CATEGORIES.INTEREST]: 'text-blue-400',
    [TAX_CATEGORIES.CAP_GAIN]: 'text-emerald-400',
    [TAX_CATEGORIES.CAP_LOSS]: 'text-rose-400',
    [TAX_CATEGORIES.OPTION_PREMIUM]: 'text-amber-400',
    [TAX_CATEGORIES.TAX_WITHHELD]: 'text-rose-400',
    [TAX_CATEGORIES.TAX_REFUND]: 'text-emerald-400',
    [TAX_CATEGORIES.FEE]: 'text-slate-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Steueranalyse</h2>
        <p className="text-sm text-slate-500">CapTrader Kontoauszüge (CSV) — Kapitalerträge & Quellensteuer</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onDrop={(e) => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(handleFile); }}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 p-6 text-center hover:border-slate-600 transition-colors"
        >
          <input type="file" accept=".csv" multiple onChange={(e) => Array.from(e.target.files).forEach(handleFile)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <Upload className="mx-auto h-8 w-8 text-slate-500 mb-2" />
          <p className="text-sm text-slate-300">CSV-Kontoauszüge hierher ziehen</p>
          <p className="text-xs text-slate-500 mt-1">Mehrere Dateien möglich</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" /> Geladene Dateien
          </h3>
          {files.length === 0 ? (
            <p className="text-xs text-slate-500">Noch keine Dateien</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-400" /> {f}
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <button onClick={analyzeAll}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-md transition-colors">
              Analyse starten
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {merged && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Jahres-Selektor */}
            {yearly && Object.keys(yearly).length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Jahr:</span>
                {Object.keys(yearly).sort().map(year => (
                  <button key={year} onClick={() => setActiveYear(year)}
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${
                      activeYear === year ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {year}
                  </button>
                ))}
              </div>
            )}

            {/* Übersichtskarten */}
            {currentYearData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                    <p className="text-xs text-slate-500">Kapitalerträge</p>
                    <p className={`text-lg font-bold ${currentYearData.summary.capitalGains >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      €{currentYearData.summary.capitalGains.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                    <p className="text-xs text-slate-500">Dividenden/Zinsen</p>
                    <p className="text-lg font-bold text-blue-400">€{currentYearData.summary.investmentIncome.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                    <p className="text-xs text-slate-500">Einbeh. Steuer</p>
                    <p className="text-lg font-bold text-rose-400">€{currentYearData.summary.totalTaxWithheld.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                    <p className="text-xs text-slate-500">Gebühren</p>
                    <p className="text-lg font-bold text-slate-300">€{currentYearData.summary.totalFees.toFixed(2)}</p>
                  </div>
                </div>

                {/* Dt. Steuerberechnung */}
                {taxCalc && (
                  <div className="rounded-xl bg-slate-800/30 border border-slate-700 p-4">
                    <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <Euro className="h-4 w-4 text-emerald-400" />
                      Deutsche Steuerberechnung ({activeYear})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-slate-500 text-xs">Kapitalerträge</p><p className="font-semibold text-slate-200">€{taxCalc.capitalIncome.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Sparer-Pauschbetrag</p><p className="font-semibold text-emerald-400">€{taxCalc.freibetrag.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Steuerpflichtig</p><p className="font-semibold text-amber-400">€{taxCalc.taxable.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Abgeltungsteuer (26,375%)</p><p className="font-semibold text-rose-400">€{taxCalc.tax.toFixed(2)}</p></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Effektiver Steuersatz: {taxCalc.effectiveRate.toFixed(2)}%</p>
                  </div>
                )}

                {/* Kategorie-Übersicht */}
                <div className="rounded-xl bg-slate-800/30 border border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-200">Kategorien ({activeYear})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/50 text-slate-400">
                        <tr><th className="px-4 py-2">Kategorie</th><th className="px-4 py-2">Anzahl</th><th className="px-4 py-2">Betrag (EUR)</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {Object.entries(currentYearData.summary.byCategory)
                          .filter(([_, data]) => data.count > 0)
                          .sort((a, b) => Math.abs(b[1].eurTotal) - Math.abs(a[1].eurTotal))
                          .map(([cat, data]) => (
                            <tr key={cat} className="hover:bg-slate-800/30">
                              <td className={`px-4 py-2 font-medium ${catColors[cat] || 'text-slate-300'}`}>{cat}</td>
                              <td className="px-4 py-2 text-slate-400">{data.count}</td>
                              <td className={`px-4 py-2 font-medium ${data.eurTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                €{data.eurTotal.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fristen-Warnung */}
                {activeYear && (
                  <div className={`rounded-lg p-4 flex items-start gap-3 ${
                    getRefundDeadline(activeYear).isExpired ? 'bg-rose-500/10 border border-rose-500/20' :
                    getRefundDeadline(activeYear).isUrgent ? 'bg-amber-500/10 border border-amber-500/20' :
                    'bg-emerald-500/10 border border-emerald-500/20'
                  }`}>
                    <Calendar className={`h-5 w-5 shrink-0 mt-0.5 ${
                      getRefundDeadline(activeYear).isExpired ? 'text-rose-400' :
                      getRefundDeadline(activeYear).isUrgent ? 'text-amber-400' : 'text-emerald-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Erstattungsfrist für {activeYear}: {getRefundDeadline(activeYear).deadline}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {getRefundDeadline(activeYear).isExpired 
                          ? 'Frist abgelaufen — Erstattung nicht mehr möglich'
                          : `Noch ${getRefundDeadline(activeYear).daysLeft} Tage`}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
