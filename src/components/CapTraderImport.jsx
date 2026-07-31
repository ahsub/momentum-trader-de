// src/components/CapTraderImport.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// CapTrader FlexQuery Import + EZB-Kurs-Upload v2.0
// ═══════════════════════════════════════════════════════════════════════════════
// NEU: Gemeinschaftskonto-Support, Währungsanalyse, deduplizierte Warnungen

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Download, AlertTriangle, CheckCircle, X,
  Euro, Calendar, User, ChevronRight, Loader2, FileSpreadsheet,
  Users, UserCheck, Percent
} from 'lucide-react';
import TaxReportEngine from '../modules/tax/report/TaxReportEngine.js';

const EZB_CSV_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip';

export default function CapTraderImport({ onReportGenerated }) {
  const [step, setStep] = useState(1);
  const [xmlContent, setXmlContent] = useState(null);
  const [xmlFileName, setXmlFileName] = useState('');
  const [ezbContent, setEzbContent] = useState(null);
  const [ezbFileName, setEzbFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [dragOver, setDragOver] = useState({ xml: false, ezb: false });

  // Steuerliche Angaben
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [isGemeinschaftskonto, setIsGemeinschaftskonto] = useState(false);

  // Person A
  const [personA, setPersonA] = useState({
    name: '',
    anteil: 50,
    kirchensteuer: 'none', // none, rest, bwBayern
  });

  // Person B
  const [personB, setPersonB] = useState({
    name: '',
    anteil: 50,
    kirchensteuer: 'none',
  });

  const xmlInputRef = useRef(null);
  const ezbInputRef = useRef(null);

  // ─── File Handlers ───
  const handleXmlDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, xml: false }));
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xml') || file.name.endsWith('.csv'))) {
      readFile(file, 'xml');
    } else {
      setError('Bitte eine FlexQuery XML-Datei hochladen (.xml oder .csv)');
    }
  }, []);

  const handleEzbDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, ezb: false }));
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      readFile(file, 'ezb');
    } else {
      setError('Bitte eine EZB-Kurs CSV-Datei hochladen (.csv)');
    }
  }, []);

  const readFile = (file, type) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (type === 'xml') {
        setXmlContent(content);
        setXmlFileName(file.name);
        setError(null);
      } else {
        setEzbContent(content);
        setEzbFileName(file.name);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  // ─── Generate Report ───
  const handleGenerateReport = async () => {
    if (!xmlContent) {
      setError('Bitte zuerst die FlexQuery XML hochladen');
      return;
    }

    // Validierung: Anteile müssen 100% ergeben
    if (isGemeinschaftskonto && (parseInt(personA.anteil) + parseInt(personB.anteil) !== 100)) {
      setError('Die Anteile müssen zusammen 100% ergeben');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setWarnings([]);

    try {
      const personen = isGemeinschaftskonto
        ? [
            { name: personA.name || 'Person A', anteil: parseInt(personA.anteil) / 100, kirchensteuerSatz: personA.kirchensteuer === 'none' ? null : personA.kirchensteuer },
            { name: personB.name || 'Person B', anteil: parseInt(personB.anteil) / 100, kirchensteuerSatz: personB.kirchensteuer === 'none' ? null : personB.kirchensteuer },
          ]
        : [
            { name: personA.name || 'Steuerpflichtiger', anteil: 1.0, kirchensteuerSatz: personA.kirchensteuer === 'none' ? null : personA.kirchensteuer },
          ];

      const engine = new TaxReportEngine({
        report: {
          jahr: taxYear,
          steuerpflichtiger: personA.name || 'Steuerpflichtiger',
          broker: 'CapTrader (Interactive Brokers)',
        },
        fx: { toleranz: 0.01, useIBKRRate: true },
        fifo: { toleranzCostBasis: 0.001 },
        isGemeinschaftskonto,
        personen,
      });

      const report = await engine.generiereReport(xmlContent, {
        ezbKurseCsv: ezbContent || undefined,
      });

      setWarnings(report.warnings || []);

      // Map to legacy format
      const legacyReport = mapToLegacyFormat(report, isGemeinschaftskonto);
      legacyReport.raw = report;
      legacyReport.engine = engine;
      legacyReport.isGemeinschaftskonto = isGemeinschaftskonto;
      legacyReport.personen = personen;

      if (onReportGenerated) {
        onReportGenerated(legacyReport);
      }

      setStep(5);
    } catch (err) {
      console.error('Tax report generation failed:', err);
      setError(`Fehler bei der Steuerberechnung: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Render Steps ───
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
          <FileText className="h-8 w-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-100">FlexQuery XML hochladen</h3>
        <p className="mt-2 text-sm text-slate-400">
          Lade deinen CapTrader Activity Statement (FlexQuery XML) hoch.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(prev => ({ ...prev, xml: true })); }}
        onDragLeave={() => setDragOver(prev => ({ ...prev, xml: false }))}
        onDrop={handleXmlDrop}
        onClick={() => xmlInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          dragOver.xml ? 'border-emerald-500 bg-emerald-500/5' : xmlContent ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
        }`}
      >
        <input ref={xmlInputRef} type="file" accept=".xml,.csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], 'xml')} />
        {xmlContent ? (
          <div className="flex items-center justify-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">{xmlFileName}</span>
            <button onClick={(e) => { e.stopPropagation(); setXmlContent(null); setXmlFileName(''); }} className="rounded p-1 hover:bg-slate-800">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-3 h-8 w-8 text-slate-500" />
            <p className="text-sm font-medium text-slate-300">XML-Datei hier ablegen oder klicken</p>
            <p className="mt-1 text-xs text-slate-500">FlexQuery Activity Statement (.xml)</p>
          </>
        )}
      </div>

      <button onClick={() => xmlContent && setStep(2)} disabled={!xmlContent}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
        Weiter zu EZB-Kursen <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
          <Euro className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-100">EZB-Wechselkurse (optional)</h3>
        <p className="mt-2 text-sm text-slate-400">
          Für präzisere Umrechnungen kannst du die EZB-Referenzkurse hochladen.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div className="text-sm text-amber-200/80">
            <p className="font-medium text-amber-200">Währungsanalyse:</p>
            <p className="mt-1">CapTrader gibt Realized P&L in der Basiswährung (EUR) aus. EZB-Kurse sind nur nötig, wenn du die IBKR-Kurse validieren möchtest.</p>
            <p className="mt-2">
              <a href={EZB_CSV_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-300 underline hover:text-amber-200">
                <Download className="h-3 w-3" /> EZB-Kurse als ZIP herunterladen
              </a>
            </p>
          </div>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(prev => ({ ...prev, ezb: true })); }}
        onDragLeave={() => setDragOver(prev => ({ ...prev, ezb: false }))}
        onDrop={handleEzbDrop}
        onClick={() => ezbInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          dragOver.ezb ? 'border-blue-500 bg-blue-500/5' : ezbContent ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
        }`}
      >
        <input ref={ezbInputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], 'ezb')} />
        {ezbContent ? (
          <div className="flex items-center justify-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">{ezbFileName}</span>
            <button onClick={(e) => { e.stopPropagation(); setEzbContent(null); setEzbFileName(''); }} className="rounded p-1 hover:bg-slate-800">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        ) : (
          <>
            <FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-slate-500" />
            <p className="text-sm font-medium text-slate-300">EZB-CSV hier ablegen oder klicken</p>
            <p className="mt-1 text-xs text-slate-500">eurofxref-hist.csv (optional)</p>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800">Zurück</button>
        <button onClick={() => setStep(3)} className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-emerald-500">
          {ezbContent ? 'Weiter' : 'Überspringen'}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10">
          <User className="h-8 w-8 text-purple-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-100">Steuerliche Angaben</h3>
        <p className="mt-2 text-sm text-slate-400">Konfiguriere die Steuerberechnung.</p>
      </div>

      {/* Gemeinschaftskonto Toggle */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-300">Gemeinschaftskonto</p>
              <p className="text-xs text-slate-500">Ehepaar oder Partner mit gemeinsamem Depot</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsGemeinschaftskonto(!isGemeinschaftskonto);
              if (!isGemeinschaftskonto) {
                setPersonA(prev => ({ ...prev, anteil: 50 }));
                setPersonB(prev => ({ ...prev, anteil: 50 }));
              } else {
                setPersonA(prev => ({ ...prev, anteil: 100 }));
              }
            }}
            className={`relative h-6 w-11 rounded-full transition-colors ${isGemeinschaftskonto ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isGemeinschaftskonto ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Person A */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-slate-300">{isGemeinschaftskonto ? 'Person A' : 'Steuerpflichtiger'}</h4>
        </div>
        <div className="space-y-3">
          <input type="text" value={personA.name} onChange={(e) => setPersonA(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Name" className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none" />

          {isGemeinschaftskonto && (
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-slate-500" />
              <input type="number" value={personA.anteil} onChange={(e) => setPersonA(prev => ({ ...prev, anteil: e.target.value }))}
                min="1" max="99" className="w-20 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 text-center" />
              <span className="text-sm text-slate-500">% Anteil</span>
            </div>
          )}

          <select value={personA.kirchensteuer} onChange={(e) => setPersonA(prev => ({ ...prev, kirchensteuer: e.target.value }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100">
            <option value="none">Keine Kirchensteuer</option>
            <option value="rest">9% Kirchensteuer (Restliches Bundesland)</option>
            <option value="bwBayern">8% Kirchensteuer (BW / Bayern)</option>
          </select>
        </div>
      </div>

      {/* Person B (nur bei Gemeinschaftskonto) */}
      {isGemeinschaftskonto && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-slate-300">Person B</h4>
          </div>
          <div className="space-y-3">
            <input type="text" value={personB.name} onChange={(e) => setPersonB(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Name" className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none" />

            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-slate-500" />
              <input type="number" value={personB.anteil} onChange={(e) => setPersonB(prev => ({ ...prev, anteil: e.target.value }))}
                min="1" max="99" className="w-20 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 text-center" />
              <span className="text-sm text-slate-500">% Anteil</span>
            </div>

            <select value={personB.kirchensteuer} onChange={(e) => setPersonB(prev => ({ ...prev, kirchensteuer: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100">
              <option value="none">Keine Kirchensteuer</option>
              <option value="rest">9% Kirchensteuer (Restliches Bundesland)</option>
              <option value="bwBayern">8% Kirchensteuer (BW / Bayern)</option>
            </select>
          </div>
        </div>
      )}

      {/* Tax Year */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">
          <Calendar className="mr-1 inline h-3.5 w-3.5" /> Steuerjahr
        </label>
        <input type="number" value={taxYear} onChange={(e) => setTaxYear(parseInt(e.target.value))}
          min={2020} max={new Date().getFullYear()}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-100" />
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800">Zurück</button>
        <button onClick={handleGenerateReport} disabled={isProcessing}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
          {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Berechne...</> : <>Report generieren <ChevronRight className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle className="h-10 w-10 text-emerald-400" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-slate-100">Steuerreport erstellt!</h3>
        <p className="mt-2 text-sm text-slate-400">
          {isGemeinschaftskonto 
            ? `Reports für ${personA.name} und ${personB.name} wurden generiert.`
            : 'Der Report wurde erfolgreich generiert.'}
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-left">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-200">{warnings.length} Warnung(en)</span>
          </div>
          <ul className="space-y-1">
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i} className="text-xs text-amber-200/70">
                • {w.message || (w.type === 'FX_ABWEICHUNG'
                  ? `Wechselkurs-Abweichung: ${w.waehrung} am ${w.datum}`
                  : w.type === 'FX_NICHT_VALIDIERT'
                  ? `Nicht validierter Kurs: ${w.waehrung} am ${w.datum?.split(';')[0]} (${w.anzahl || 1}x)`
                  : JSON.stringify(w))}
              </li>
            ))}
            {warnings.length > 5 && <li className="text-xs text-amber-200/50">... und {warnings.length - 5} weitere</li>}
          </ul>
        </div>
      )}

      <button onClick={() => { setStep(1); setXmlContent(null); setEzbContent(null); setWarnings([]); setError(null); }}
        className="rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800">
        Neuen Report erstellen
      </button>
    </div>
  );

  const renderError = () => error && (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div>
          <p className="text-sm font-medium text-red-300">Fehler</p>
          <p className="mt-1 text-sm text-red-200/70">{error}</p>
        </div>
      </div>
    </motion.div>
  );

  const steps = [
    { num: 1, label: 'XML' },
    { num: 2, label: 'EZB' },
    { num: 3, label: 'Angaben' },
    { num: 5, label: 'Fertig' },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step >= s.num ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
              {step > s.num ? <CheckCircle className="h-4 w-4" /> : s.num === 5 ? '✓' : s.num}
            </div>
            <span className={`text-xs ${step >= s.num ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`mx-1 h-px w-8 ${step > s.num ? 'bg-emerald-500/30' : 'bg-slate-800'}`} />}
          </div>
        ))}
      </div>

      {renderError()}

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 5 && renderStep5()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Helper: Map new report format to legacy UI format ───
function mapToLegacyFormat(report, isGemeinschaftskonto) {
  // Bei Gemeinschaftskonto: Person A als Hauptreport, Person B als Zusatz
  const mainReport = report.personen?.[0] || report;
  const z = mainReport.zusammenfassung || report.zusammenfassung;

  return {
    year: report.meta?.jahr,
    taxpayer: report.meta?.steuerpflichtiger,
    isGemeinschaftskonto,
    personen: report.personen,

    stockPnL: (z?.gewinne?.aktien?.betrag || 0) - (z?.verluste?.aktien?.betrag || 0),
    optionsPnL: (z?.gewinne?.termingeschaefte?.betrag || 0) - (z?.verluste?.termingeschaefte?.betrag || 0),
    etfPnL: (z?.gewinne?.allgemein?.betrag || 0) - (z?.verluste?.allgemein?.betrag || 0),

    dailyReport: buildDailyReport(report),

    summary: {
      totalGewinn: z?.gewinne?.gesamt || 0,
      totalVerlust: z?.verluste?.gesamt || 0,
      saldo: z?.saldo || 0,
      steuerOhneKirche: z?.steuer?.ohneKirchensteuer?.betrag || 0,
      steuerMitKirche9: z?.steuer?.mitKirchensteuer9?.betrag || 0,
      steuerMitKirche8: z?.steuer?.mitKirchensteuer8?.betrag || 0,
    },

    anlageKAP: mainReport.anlageKAP || report.anlageKAP,
    verlustToepfe: z?.verlustvortraege || { AKTIEN: 0, ALLGEMEIN: 0, TERMINGESCHAEFTE: 0 },
    warnings: report.warnings || [],
    errors: report.errors || [],
    raw: report,
  };
}

function buildDailyReport(report) {
  const daily = {};
  const tradeData = report.detailDaten?.trades || (report.personen?.[0]?.detailDaten?.trades);

  if (tradeData) {
    ['aktien', 'termingeschaefte', 'allgemein'].forEach(cat => {
      if (tradeData[cat]) {
        [...(tradeData[cat].gewinne || []), ...(tradeData[cat].verluste || [])].forEach(trade => {
          const date = trade.date;
          if (!daily[date]) daily[date] = { date, trades: [], pnl: 0 };
          daily[date].trades.push(trade);
          daily[date].pnl += trade.fifoPnlRealizedEUR || 0;
        });
      }
    });
  }

  return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
}
