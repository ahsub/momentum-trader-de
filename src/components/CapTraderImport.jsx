import React, { useState, useCallback } from 'react';
import { FileText, Upload, Download, Users, ChevronRight, Check } from 'lucide-react';
import { TaxReportEngine } from '../modules/tax/report/TaxReportEngine';

const STEPS = [
  { id: 1, label: 'XML hochladen' },
  { id: 2, label: 'Steuerliche Angaben' },
  { id: 3, label: 'Kontotyp' },
  { id: 4, label: 'Report erstellen' },
  { id: 5, label: 'Fertig' },
];

export default function CapTraderImport({ onReportGenerated }) {
  const [step, setStep] = useState(1);
  const [xmlContent, setXmlContent] = useState(null);
  const [ezbContent, setEzbContent] = useState(null);
  const [steuerpflichtiger, setSteuerpflichtiger] = useState('');
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [kirchensteuer, setKirchensteuer] = useState(false);
  const [kirchensteuerSatz, setKirchensteuerSatz] = useState(0.09);
  const [isGemeinschaft, setIsGemeinschaft] = useState(false);
  const [personen, setPersonen] = useState([
    { name: '', anteil: 0.5, kirchensteuerSatz: 0.09 },
    { name: '', anteil: 0.5, kirchensteuerSatz: 0.08 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleXmlUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setXmlContent(event.target.result);
      setStep(2);
    };
    reader.readAsText(file);
  }, []);

  const handleEzbUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEzbContent(event.target.result);
    };
    reader.readAsText(file);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const engine = new TaxReportEngine();
      const options = {
        steuerpflichtiger: steuerpflichtiger || 'Unbekannt',
        jahr: parseInt(jahr),
        kirchensteuer,
        kirchensteuerSatz,
        gemeinschaftskonto: isGemeinschaft,
        personen: isGemeinschaft ? personen.filter(p => p.name && p.anteil > 0) : undefined,
        ezbKurse: ezbContent
      };
      const report = await engine.generiereReport(xmlContent, options);
      onReportGenerated(report);
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 2) return steuerpflichtiger.length > 0;
    if (step === 3) return true;
    if (step === 4) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        {STEPS.map((s, idx) => (
          <React.Fragment key={s.id}>
            <div className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  step > s.id ? 'bg-emerald-500/20 text-emerald-400' :
                  step === s.id ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  {step > s.id ? '✓' : s.id}
                </div>
                <span className={`mt-1 text-xs ${step >= s.id ? 'text-slate-300' : 'text-slate-600'}`}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 w-8 ${step > s.id ? 'bg-emerald-500/50' : 'bg-slate-800'}`} />
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: XML Upload */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
              <FileText className="h-5 w-5 text-emerald-400" />
              FlexQuery XML hochladen
            </h3>
            <label className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all border-slate-700 bg-slate-900/50 hover:border-slate-600 block">
              <input 
                type="file" 
                accept=".xml" 
                className="hidden" 
                onChange={handleXmlUpload}
                aria-label="XML-Datei"
              />
              <Upload className="mx-auto mb-2 h-8 w-8 text-slate-500" />
              <p className="text-sm text-slate-400">XML-Datei hier ablegen oder klicken</p>
              <p className="mt-1 text-xs text-slate-600">FlexQuery Activity Statement (.xml)</p>
            </label>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Download className="h-5 w-5 text-blue-400" />
              EZB-Wechselkurse
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              Optional. Für präzisere Umrechnungen kannst du die EZB-Referenzkurse hochladen.
            </p>
            <label className="cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all border-slate-700 bg-slate-900/50 hover:border-slate-600 block">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleEzbUpload}
                aria-label="EZB-CSV"
              />
              <Download className="mx-auto mb-2 h-6 w-6 text-slate-500" />
              <p className="text-sm text-slate-400">EZB-CSV hier ablegen oder klicken</p>
              <p className="mt-1 text-xs text-slate-600">eurofxref-hist.csv (optional)</p>
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Steuerliche Angaben */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Steuerliche Angaben</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-400">Name des Steuerpflichtigen</label>
                <input
                  type="text"
                  placeholder="Max Mustermann"
                  value={steuerpflichtiger}
                  onChange={(e) => setSteuerpflichtiger(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Steuerjahr</label>
                <input
                  type="number"
                  value={jahr}
                  onChange={(e) => setJahr(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Kirchensteuer</label>
                <p className="mb-2 text-xs text-slate-500">
                  Wähle eine der drei Varianten: 9% (Rest-DE), 8% (BW/BY), oder keine Kirchensteuer.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setKirchensteuer(false); setKirchensteuerSatz(0); }}
                    className={`rounded-lg px-4 py-2 text-sm ${!kirchensteuer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Keine
                  </button>
                  <button
                    onClick={() => { setKirchensteuer(true); setKirchensteuerSatz(0.09); }}
                    className={`rounded-lg px-4 py-2 text-sm ${kirchensteuer && kirchensteuerSatz === 0.09 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}
                  >
                    9%
                  </button>
                  <button
                    onClick={() => { setKirchensteuer(true); setKirchensteuerSatz(0.08); }}
                    className={`rounded-lg px-4 py-2 text-sm ${kirchensteuer && kirchensteuerSatz === 0.08 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}
                  >
                    8%
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceed()}
              className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
            >
              Weiter <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Kontotyp */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Kontotyp</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsGemeinschaft(false)}
                className={`flex-1 rounded-lg border p-4 text-center transition-all ${
                  !isGemeinschaft ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                <p className="text-sm font-medium text-slate-200">Einzelkonto</p>
              </button>
              <button
                onClick={() => setIsGemeinschaft(true)}
                className={`flex-1 rounded-lg border p-4 text-center transition-all ${
                  isGemeinschaft ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                <Users className="mx-auto mb-2 h-5 w-5 text-slate-400" />
                <p className="text-sm font-medium text-slate-200">Gemeinschaftskonto</p>
              </button>
            </div>

            {isGemeinschaft && (
              <div className="mt-6 space-y-4">
                {personen.map((person, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <p className="mb-2 text-sm font-medium text-slate-300">Person {idx + 1}</p>
                    <div className="grid grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="Name"
                        value={person.name}
                        onChange={(e) => {
                          const newPersonen = [...personen];
                          newPersonen[idx].name = e.target.value;
                          setPersonen(newPersonen);
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                      />
                      <input
                        type="number"
                        placeholder="Anteil %"
                        value={person.anteil * 100}
                        onChange={(e) => {
                          const newPersonen = [...personen];
                          newPersonen[idx].anteil = parseFloat(e.target.value) / 100;
                          setPersonen(newPersonen);
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                      />
                      <select
                        value={person.kirchensteuerSatz}
                        onChange={(e) => {
                          const newPersonen = [...personen];
                          newPersonen[idx].kirchensteuerSatz = parseFloat(e.target.value);
                          setPersonen(newPersonen);
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                      >
                        <option value={0}>Keine</option>
                        <option value={0.08}>8% (BW/BY)</option>
                        <option value={0.09}>9% (Rest-DE)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setStep(4)}
              className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500"
            >
              Weiter <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Report erstellen */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Zusammenfassung</h3>
            <div className="space-y-2 text-sm text-slate-400">
              <p>Steuerpflichtiger: <span className="text-slate-200">{steuerpflichtiger}</span></p>
              <p>Steuerjahr: <span className="text-slate-200">{jahr}</span></p>
              <p>Kirchensteuer: <span className="text-slate-200">{kirchensteuer ? `${(kirchensteuerSatz * 100).toFixed(0)}%` : 'Nein'}</span></p>
              <p>Kontotyp: <span className="text-slate-200">{isGemeinschaft ? 'Gemeinschaftskonto' : 'Einzelkonto'}</span></p>
            </div>
            {error && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? 'Wird erstellt...' : 'Report erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Fertig */}
      {step === 5 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <Check className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
          <h3 className="text-lg font-semibold text-emerald-400">Report erstellt!</h3>
          <p className="mt-2 text-sm text-slate-400">Der Steuerreport wurde erfolgreich generiert.</p>
        </div>
      )}
    </div>
  );
}
