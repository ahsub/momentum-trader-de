import React, { useState } from 'react';
import { Download, FileText, AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';

const TaxAnalysis = ({ report }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [showRawData, setShowRawData] = useState(false);

  if (!report) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-500">Kein Steuerreport verfügbar</p>
        </div>
      </div>
    );
  }

  const { meta, detailDaten, warnings, errors, isGemeinschaftskonto, personen } = report;

  // FIX: Null-safe zusammenfassung
  const zusammenfassung = report.zusammenfassung || {
    gewinne: { gesamt: 0, aktien: { betrag: 0, anzahl: 0 }, termingeschaefte: { betrag: 0, anzahl: 0 }, allgemein: { betrag: 0, anzahl: 0 } },
    verluste: { gesamt: 0, aktien: { betrag: 0, anzahl: 0 }, termingeschaefte: { betrag: 0, anzahl: 0 }, allgemein: { betrag: 0, anzahl: 0 } },
    saldo: 0,
    steuer: { ohneKirchensteuer: { betrag: 0, satz: '26,375%' }, mitKirchensteuer9: { betrag: 0, satz: '27,99%' }, mitKirchensteuer8: { betrag: 0, satz: '27,82%' } },
    verlustvortraege: { AKTIEN: 0, ALLGEMEIN: 0, TERMINESCHAEFTE: 0 }
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '0,00 €';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [date] = dateStr.split(';');
    const year = date.slice(0, 4);
    const month = date.slice(4, 6);
    const day = date.slice(6, 8);
    return `${day}.${month}.${year}`;
  };

  const toggleDay = (day) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-500">Gesamtergebnis</p>
          <p className={`mt-2 text-2xl font-bold font-mono ${(zusammenfassung.saldo || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(zusammenfassung.saldo)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-500">Gewinne</p>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {formatCurrency(zusammenfassung.gewinne?.gesamt)}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {zusammenfassung.gewinne?.aktien?.anzahl || 0} Aktien / {zusammenfassung.gewinne?.termingeschaefte?.anzahl || 0} Termin
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-500">Verluste</p>
          <p className="mt-2 text-2xl font-bold font-mono text-red-400">
            {formatCurrency(zusammenfassung.verluste?.gesamt)}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {zusammenfassung.verluste?.aktien?.anzahl || 0} Aktien / {zusammenfassung.verluste?.termingeschaefte?.anzahl || 0} Termin
          </p>
        </div>
      </div>

      {/* Tax Calculation */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Steuerberechnung</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-slate-800">
            <span className="text-slate-400">Ohne Kirchensteuer (26,375%)</span>
            <span className="font-mono text-white">{formatCurrency(zusammenfassung.steuer?.ohneKirchensteuer?.betrag)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-800">
            <span className="text-slate-400">Mit Kirchensteuer 9% (27,99%)</span>
            <span className="font-mono text-white">{formatCurrency(zusammenfassung.steuer?.mitKirchensteuer9?.betrag)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-400">Mit Kirchensteuer 8% (27,82%)</span>
            <span className="font-mono text-white">{formatCurrency(zusammenfassung.steuer?.mitKirchensteuer8?.betrag)}</span>
          </div>
        </div>
      </div>

      {/* Loss Pots */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Verlusttöpfe</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-slate-500">Aktien</p>
            <p className="text-xl font-mono text-white">{formatCurrency(zusammenfassung.verlustvortraege?.AKTIEN)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500">Allgemein</p>
            <p className="text-xl font-mono text-white">{formatCurrency(zusammenfassung.verlustvortraege?.ALLGEMEIN)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500">Termingeschäfte</p>
            <p className="text-xl font-mono text-white">{formatCurrency(zusammenfassung.verlustvortraege?.TERMINESCHAEFTE)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderKap = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Anlage KAP — Zeilen-Mapping</h3>
      {report.anlageKAP && Object.entries(report.anlageKAP).map(([zeile, data]) => (
        <div key={zeile} className={`rounded-xl border p-4 ${data.wichtig ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-900/50'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-white">Zeile {zeile}</p>
              <p className="text-sm text-slate-400">{data.beschreibung}</p>
              {data.hinweis && (
                <p className="text-xs text-slate-500 mt-1">{data.hinweis}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-lg font-mono text-white">
                {typeof data.wert === 'boolean' ? (data.wert ? 'Ja' : 'Nein') : formatCurrency(data.wert)}
              </p>
              {data.pflichtfeld && (
                <span className="text-xs text-amber-400">Pflichtfeld</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDayReport = () => {
    const trades = detailDaten?.trades;
    if (!trades) return <p className="text-slate-500">Keine Trades vorhanden</p>;

    const allTrades = [];
    ['aktien', 'termingeschaefte', 'allgemein'].forEach(cat => {
      if (trades[cat]) {
        if (trades[cat].gewinne) allTrades.push(...trades[cat].gewinne);
        if (trades[cat].verluste) allTrades.push(...trades[cat].verluste);
      }
    });

    const tradesByDay = allTrades.reduce((acc, trade) => {
      const day = trade.date?.split(';')[0] || 'unknown';
      if (!acc[day]) acc[day] = [];
      acc[day].push(trade);
      return acc;
    }, {});

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Tagesbericht</h3>
        {Object.entries(tradesByDay).sort().map(([day, dayTrades]) => {
          const isExpanded = expandedDays.has(day);
          const dayPnl = dayTrades.reduce((sum, t) => sum + (t.fifoPnlRealizedEUR || 0), 0);

          return (
            <div key={day} className="rounded-xl border border-slate-800 bg-slate-900/50">
              <button
                onClick={() => toggleDay(day)}
                className="w-full flex justify-between items-center p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className="font-medium">{formatDate(day)}</span>
                  <span className="text-sm text-slate-500">({dayTrades.length} Trades)</span>
                </div>
                <span className={`font-mono ${dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(dayPnl)}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-800 p-4 space-y-2">
                  {dayTrades.map((trade, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${trade.buySell === 'SELL' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {trade.buySell}
                        </span>
                        <span>{trade.symbol}</span>
                        <span className="text-slate-500">{trade.quantity} @ {trade.tradePrice}</span>
                      </div>
                      <span className={`font-mono ${(trade.fifoPnlRealizedEUR || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(trade.fifoPnlRealizedEUR)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderWarnings = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Warnungen</h3>
      {warnings && warnings.length > 0 ? (
        <div className="space-y-2">
          {warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm text-amber-200">{w.message || w}</p>
                {w.gruppiert && (
                  <p className="text-xs text-amber-400/70 mt-1">Gruppierte Warnung</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">Keine Warnungen</p>
      )}
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'kap', label: 'Anlage KAP' },
    { id: 'dayreport', label: 'Tagesbericht' },
    { id: 'warnings', label: `Warnungen (${warnings?.length || 0})` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Steuerreport {meta?.jahr}</h2>
          <p className="text-slate-400">{meta?.steuerpflichtiger} · {meta?.broker}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const csv = report.exportiere ? report.exportiere(report, 'csv') : '';
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `steuerreport_${meta?.jahr}.csv`;
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            <FileText size={16} />
            PDF
          </button>
        </div>
      </div>

      {/* Gemeinschaftskonto Badge */}
      {isGemeinschaftskonto && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <Info size={16} />
          <span>Gemeinschaftskonto</span>
          {personen && personen.map((p, idx) => (
            <span key={idx} className="text-sm">
              {p.name || p.person?.name} ({((p.anteil || p.person?.anteil || 0.5) * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'kap' && renderKap()}
        {activeTab === 'dayreport' && renderDayReport()}
        {activeTab === 'warnings' && renderWarnings()}
      </div>

      {/* Raw Data Toggle */}
      <div className="pt-6 border-t border-slate-800">
        <button
          onClick={() => setShowRawData(!showRawData)}
          className="text-sm text-slate-500 hover:text-white transition-colors"
        >
          {showRawData ? 'Rohdaten ausblenden' : 'Rohdaten anzeigen'}
        </button>
        {showRawData && (
          <pre className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800 overflow-auto text-xs text-slate-400">
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default TaxAnalysis;
