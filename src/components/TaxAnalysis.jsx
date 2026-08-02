import React, { useState } from 'react';
import { 
  ChartPie, 
  FileText, 
  Calendar, 
  TriangleAlert, 
  Download, 
  Printer, 
  Eye, 
  ChevronDown
} from 'lucide-react';

// Use inline SVG components for icons that might not exist in this lucide version
const CheckCircleIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
  </svg>
);

const UsersIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const TABS = [
  { id: 'overview', label: 'Übersicht', icon: ChartPie },
  { id: 'anlage', label: 'Anlage KAP', icon: FileText },
  { id: 'daily', label: 'Tagesbericht', icon: Calendar },
  { id: 'warnings', label: 'Warnungen', icon: TriangleAlert },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

export default function TaxAnalysis({ report }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedDays, setExpandedDays] = useState({});
  const [showRaw, setShowRaw] = useState(false);
  const [activePerson, setActivePerson] = useState(0);

  if (!report) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-500">Kein Steuerreport verfügbar</p>
        </div>
      </div>
    );
  }

  const { meta, zusammenfassung, detailDaten, warnings, errors } = report;
  const isGemeinschaft = report.isGemeinschaftskonto;
  const personen = report.personen || [];

  const toggleDay = (date) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-6 border-emerald-500/20 bg-emerald-500/5">
          <p className="text-sm text-slate-500">Gesamtergebnis</p>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {formatCurrency(zusammenfassung.saldo)}
          </p>
        </div>
        <div className="rounded-xl border p-6 border-slate-800 bg-slate-900/50">
          <p className="text-sm text-slate-500">Gewinne</p>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {formatCurrency(zusammenfassung.gewinne.gesamt)}
          </p>
        </div>
        <div className="rounded-xl border p-6 border-slate-800 bg-slate-900/50">
          <p className="text-sm text-slate-500">Verluste</p>
          <p className="mt-2 text-2xl font-bold font-mono text-red-400">
            {formatCurrency(-zusammenfassung.verluste.gesamt)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Steuerberechnung</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-3">
            <span className="text-sm text-slate-400">Ohne Kirchensteuer</span>
            <span className="font-mono text-sm text-slate-200">
              {formatCurrency(zusammenfassung.steuer.ohneKirchensteuer.betrag)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-3">
            <span className="text-sm text-slate-400">Mit Kirchensteuer (9%)</span>
            <span className="font-mono text-sm text-slate-200">
              {formatCurrency(zusammenfassung.steuer.mitKirchensteuer9.betrag)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-3">
            <span className="text-sm text-slate-400">Mit Kirchensteuer (8%)</span>
            <span className="font-mono text-sm text-slate-200">
              {formatCurrency(zusammenfassung.steuer.mitKirchensteuer8.betrag)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Verlusttöpfe</h3>
        <div className="space-y-3">
          {Object.entries(zusammenfassung.verlustvortraege || {}).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <span className="text-sm text-slate-400">
                {key === 'AKTIEN' ? 'Aktien' : key === 'ALLGEMEIN' ? 'Allgemein' : 'Termingeschäfte'}
              </span>
              <span className="font-mono text-sm text-slate-200">{formatCurrency(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAnlageKAP = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-100">Anlage KAP</h3>
      <div className="space-y-2">
        {report.anlageKAP && Object.entries(report.anlageKAP).map(([key, zeile]) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-3">
            <div>
              <span className="text-sm text-slate-300">{zeile.beschreibung}</span>
              {zeile.hinweis && <p className="text-xs text-slate-500">{zeile.hinweis}</p>}
            </div>
            <span className="font-mono text-sm text-slate-200">
              {typeof zeile.wert === 'boolean' ? (zeile.wert ? 'Ja' : 'Nein') : formatCurrency(zeile.wert)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDailyReport = () => {
    const trades = detailDaten?.trades?.aktien || {};
    const allTrades = [...(trades.gewinne || []), ...(trades.verluste || [])];
    const groupedByDay = allTrades.reduce((acc, trade) => {
      const date = trade.datum;
      if (!acc[date]) acc[date] = [];
      acc[date].push(trade);
      return acc;
    }, {});

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Tagesbericht</h3>
        <div className="space-y-2">
          {Object.entries(groupedByDay).map(([date, dayTrades]) => {
            const dayTotal = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            return (
              <div key={date} className="rounded-xl border border-slate-800 bg-slate-900/50">
                <button 
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => toggleDay(date)}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-200">{date}</span>
                    <span className={`text-sm font-mono ${dayTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(dayTotal)}
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expandedDays[date] ? 'rotate-180' : ''}`} />
                </button>
                {expandedDays[date] && (
                  <div className="border-t border-slate-800 px-4 pb-4">
                    {dayTrades.map((trade, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2">
                        <span className="text-sm text-slate-300">{trade.symbol}</span>
                        <span className={`font-mono text-sm ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(trade.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWarnings = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-100">
        Warnungen {warnings.length > 0 && <span className="text-sm text-amber-400">({warnings.length})</span>}
      </h3>
      {warnings.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-emerald-400">Keine Warnungen vorhanden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm text-amber-300">{warning.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderGemeinschaft = () => {
    if (!isGemeinschaft || personen.length === 0) return null;
    const currentPerson = personen[activePerson];

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {personen.map((person, idx) => (
            <button
              key={idx}
              onClick={() => setActivePerson(idx)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activePerson === idx 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {person.name}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Aufteilung</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Anteil</span>
              <span className="font-mono text-sm text-slate-200">{(currentPerson.anteil * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Kirchensteuer</span>
              <span className="font-mono text-sm text-slate-200">{(currentPerson.kirchensteuerSatz * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tabContent = {
    overview: renderOverview(),
    anlage: renderAnlageKAP(),
    daily: renderDailyReport(),
    warnings: renderWarnings(),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            Steuerreport {meta.jahr}
          </h2>
          <p className="text-sm text-slate-500">
            {meta.steuerpflichtiger} · {meta.broker}
            {isGemeinschaft && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                <UsersIcon className="h-3 w-3" />
                Gemeinschaftskonto
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800">
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500">
            <Printer className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {isGemeinschaft && renderGemeinschaft()}

      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'warnings' && warnings.length > 0 && (
                <span className="ml-1 text-xs">({warnings.length})</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-[300px]">
        {tabContent[activeTab]}
      </div>

      {errors && errors.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-400">Fehler</h3>
          {errors.map((err, idx) => (
            <p key={idx} className="text-xs text-red-300">{err.message}</p>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-slate-800">
        <button 
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
        >
          <Eye className="h-4 w-4" />
          {showRaw ? 'Rohdaten ausblenden' : 'Rohdaten anzeigen'}
        </button>
        {showRaw && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-400">
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
