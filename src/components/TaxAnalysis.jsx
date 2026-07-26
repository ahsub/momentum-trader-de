import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Euro, Calendar, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Activity, Users, Church, User, Printer } from 'lucide-react';
import { parseTaxCSV, mergeTaxCSVs, getYearlyOverview, TAX_CATEGORIES } from '../services/taxParser';
import { calculateGermanTax, getRefundDeadline, CHURCH_TAX_RATES } from '../services/taxRules';
import { printTaxReport } from '../services/taxExport';

export default function TaxAnalysis() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [merged, setMerged] = useState(null);
  const [yearly, setYearly] = useState(null);
  const [activeYear, setActiveYear] = useState(null);

  // Steuer-Einstellungen
  const [isJointAccount, setIsJointAccount] = useState(false);
  const [churchTaxKey, setChurchTaxKey] = useState('none');
  const [personAChurch, setPersonAChurch] = useState(false);
  const [personBChurch, setPersonBChurch] = useState(false);

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

  const taxCalc = currentYearData ? calculateGermanTax({
    capitalIncome: currentYearData.summary.capitalGains + currentYearData.summary.investmentIncome,
    isJointAccount,
    churchTaxKey,
    personAChurch,
    personBChurch,
  }) : null;

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

      {/* Steuer-Einstellungen */}
      <div className="rounded-xl bg-slate-800/30 border border-slate-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" /> Kontoinhaber & Steuerpflicht
        </h3>

        {/* Einzel- / Gemeinschaftskonto */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Konto:</span>
          <button
            onClick={() => setIsJointAccount(false)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
              !isJointAccount ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <User className="h-3 w-3" /> Einzelkonto
          </button>
          <button
            onClick={() => setIsJointAccount(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
              isJointAccount ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Users className="h-3 w-3" /> Gemeinschaftskonto
          </button>
        </div>

        {/* Kirchensteuer */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500">Kirchensteuer:</span>
          {Object.entries(CHURCH_TAX_RATES).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setChurchTaxKey(key)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                churchTaxKey === key ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Kirchensteuerpflicht pro Person */}
        {churchTaxKey !== 'none' && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={personAChurch}
                onChange={(e) => setPersonAChurch(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <Church className="h-3 w-3 text-slate-400" />
              Person A kirchensteuerpflichtig
            </label>
            {isJointAccount && (
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={personBChurch}
                  onChange={(e) => setPersonBChurch(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <Church className="h-3 w-3 text-slate-400" />
                Person B kirchensteuerpflichtig
              </label>
            )}
          </div>
        )}

        {/* Hinweis */}
        <p className="text-[10px] text-slate-500">
          {isJointAccount 
            ? `Sparer-Pauschbetrag: €2.000 (€1.000 pro Person) | Aufteilung 50/50`
            : `Sparer-Pauschbetrag: €1.000`}
          {churchTaxKey !== 'none' && ` | Kirchensteuer: ${CHURCH_TAX_RATES[churchTaxKey].label}`}
        </p>
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
            <>
            <button onClick={analyzeAll}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-md transition-colors">
              Analyse starten
            </button>
            {merged && activeYear && (
              <button
                onClick={() => printTaxReport(
                  currentYearData?.transactions || [],
                  currentYearData?.summary || merged.summary,
                  { isJointAccount, churchTaxKey, personAChurch, personBChurch },
                  activeYear
                )}
                className="mt-2 w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-2 rounded-md transition-colors flex items-center justify-center gap-2">
                <Printer className="h-3 w-3" /> Steuererläuterung drucken (PDF)
              </button>
            )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {merged && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

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
                      {isJointAccount && <span className="text-xs text-slate-500 font-normal">— Gemeinschaftskonto</span>}
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-slate-500 text-xs">Kapitalerträge</p><p className="font-semibold text-slate-200">€{taxCalc.capitalIncome.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Sparer-Pauschbetrag</p><p className="font-semibold text-emerald-400">€{taxCalc.freibetrag.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Steuerpflichtig</p><p className="font-semibold text-amber-400">€{taxCalc.taxable.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Abgeltungsteuer (25%)</p><p className="font-semibold text-slate-300">€{taxCalc.abgeltungsteuer.toFixed(2)}</p></div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm border-t border-slate-700 pt-3">
                      <div><p className="text-slate-500 text-xs">Soli (5,5%)</p><p className="font-semibold text-slate-300">€{taxCalc.soli.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Kirchensteuer</p><p className="font-semibold text-slate-300">€{taxCalc.kirchensteuer.toFixed(2)}</p></div>
                      <div><p className="text-slate-500 text-xs">Gesamtsteuer</p><p className="font-semibold text-rose-400">€{taxCalc.totalTax.toFixed(2)}</p></div>
                    </div>

                    <p className="text-xs text-slate-500 mt-2">
                      Effektiver Steuersatz: <span className="font-semibold text-slate-300">{taxCalc.effectiveRate.toFixed(2)}%</span>
                      {taxCalc.churchTaxNote && <span className="ml-2 text-slate-400">| {taxCalc.churchTaxNote}</span>}
                    </p>

                    {taxCalc.perPerson && (
                      <div className="mt-3 p-2 bg-slate-900/30 rounded-lg text-xs">
                        <p className="text-slate-500 mb-1">Pro Person (50/50 Aufteilung):</p>
                        <div className="grid grid-cols-3 gap-2">
                          <span>Anteil: €{taxCalc.perPerson.share.toFixed(2)}</span>
                          <span>Steuerpflichtig: €{taxCalc.perPerson.taxableShare.toFixed(2)}</span>
                          <span>Steuer: €{taxCalc.perPerson.taxShare.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                
                {/* ⚠️ Nicht-deutscher Broker Hinweis */}
                <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">Nicht-deutscher Broker (CapTrader/IBKR/Lynx)</p>
                      <p className="text-xs text-amber-300/80 mt-1">
                        Bei nicht-deutschen Brokern wird <strong>keine deutsche Kapitalertragsteuer einbehalten</strong>. 
                        Der Sparer-Pauschbetrag (€1.000/€2.000) wird <strong>nicht automatisch angewendet</strong>.
                      </p>
                      <p className="text-xs text-amber-300/80 mt-1">
                        <strong>Was Sie tun müssen:</strong>
                      </p>
                      <ul className="text-xs text-amber-300/70 mt-1 ml-4 list-disc">
                        <li>Die berechnete Steuer von <strong>€{taxCalc.totalTax.toFixed(2)}</strong> ist in der Einkommensteuererklärung <strong>nachzuzahlen</strong></li>
                        <li>Die einbehaltene Quellensteuer (€{currentYearData.summary.totalTaxWithheld.toFixed(2)}) wird <strong>angerechnet</strong></li>
                        <li>Den Sparer-Pauschbetrag (€{taxCalc.freibetrag.toFixed(2)}) müssen Sie <strong>selbst geltend machen</strong> (Anlage KAP)</li>
                        <li>Quellensteuer-Erstattungen müssen <strong>separat beantragt</strong> werden (nicht über ELSTER)</li>
                      </ul>
                      <p className="text-xs text-amber-300/60 mt-2">
                        <strong>Hinweis:</strong> Diese Berechnung dient der Orientierung. Die tatsächliche Steuerfestsetzung erfolgt durch das Finanzamt.
                      </p>
                    </div>
                  </div>
                </div>

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
                          ? 'Frist abgelaufen — Erstatung nicht mehr moglich'
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
