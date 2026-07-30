// src/components/TaxAnalysis.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// Tax Analysis Dashboard — Steuerreport Visualisierung
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Euro,
  Calendar,
  PieChart,
  BarChart3,
  Eye,
  EyeOff,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
 CheckCircle
} from 'lucide-react';
import { generateTaxPDF } from '../utils/taxReportPDF.js';

export default function TaxAnalysis({ report }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, anlagekap, daily, trades, warnings
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [showRaw, setShowRaw] = useState(false);

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 py-20">
        <FileText className="mb-4 h-12 w-12 text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-400">Kein Steuerreport geladen</h3>
        <p className="mt-2 text-sm text-slate-500">
          Importiere zuerst dein CapTrader Activity Statement über den Import-Wizard.
        </p>
      </div>
    );
  }

  const { summary, anlageKAP, dailyReport, verlustToepfe, warnings, errors, year, taxpayer } = report;

  // ─── Derived Data ───
  const totalTrades = useMemo(() => {
    if (!dailyReport) return 0;
    return dailyReport.reduce((sum, d) => sum + d.trades.length, 0);
  }, [dailyReport]);

  const winDays = useMemo(() => dailyReport?.filter(d => d.pnl > 0).length || 0, [dailyReport]);
  const lossDays = useMemo(() => dailyReport?.filter(d => d.pnl < 0).length || 0, [dailyReport]);
  const flatDays = useMemo(() => dailyReport?.filter(d => d.pnl === 0).length || 0, [dailyReport]);

  const pnlByCategory = [
    { name: 'Aktien', value: report.stockPnL || 0, color: 'bg-blue-500', textColor: 'text-blue-400' },
    { name: 'Termingeschäfte', value: report.optionsPnL || 0, color: 'bg-purple-500', textColor: 'text-purple-400' },
    { name: 'Allgemein (ETF)', value: report.etfPnL || 0, color: 'bg-amber-500', textColor: 'text-amber-400' },
  ];

  // ─── Handlers ───
  const toggleDay = (date) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleExportPDF = async () => {
    try {
      await generateTaxPDF(report);
    } catch (err) {
      console.error('PDF Export failed:', err);
      alert('PDF-Export fehlgeschlagen: ' + err.message);
    }
  };

  const handleExportCSV = () => {
    if (!report.raw) return;
    const engine = report.engine || report.raw._engine;
    // Use the engine's export method if available, otherwise fallback
    let csv;
    if (report.raw && typeof report.raw === 'object') {
      // Simple CSV export from raw data
      csv = generateCSVFromReport(report);
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steuerreport-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render: Overview Tab ───
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Gesamtergebnis"
          value={summary?.saldo || 0}
          icon={summary?.saldo >= 0 ? TrendingUp : TrendingDown}
          iconColor={summary?.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}
          bgColor={summary?.saldo >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
        />
        <SummaryCard
          title="Gewinne"
          value={summary?.totalGewinn || 0}
          icon={ArrowUpRight}
          iconColor="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <SummaryCard
          title="Verluste"
          value={-(summary?.totalVerlust || 0)}
          icon={ArrowDownRight}
          iconColor="text-red-400"
          bgColor="bg-red-500/10"
        />
        <SummaryCard
          title="Trades"
          value={totalTrades}
          suffix=""
          icon={BarChart3}
          iconColor="text-blue-400"
          bgColor="bg-blue-500/10"
        />
      </div>

      {/* P&L by Category */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <PieChart className="h-4 w-4 text-slate-500" />
          Ergebnis nach Kategorie
        </h3>
        <div className="space-y-3">
          {pnlByCategory.map((cat) => (
            <div key={cat.name} className="flex items-center gap-4">
              <div className="w-32 text-sm text-slate-400">{cat.name}</div>
              <div className="flex-1">
                <div className="h-6 overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(Math.abs(cat.value) / Math.max(...pnlByCategory.map(c => Math.abs(c.value))) * 100, 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full ${cat.color} ${cat.value < 0 ? 'opacity-60' : ''}`}
                  />
                </div>
              </div>
              <div className={`w-28 text-right text-sm font-mono font-medium ${cat.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(cat.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Calculation */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Euro className="h-4 w-4 text-slate-500" />
          Steuerberechnung
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TaxCard
            title="Ohne Kirchensteuer"
            amount={summary?.steuerOhneKirche || 0}
            rate="26,375%"
            highlight={true}
          />
          <TaxCard
            title="Mit Kirchensteuer (9%)"
            amount={summary?.steuerMitKirche9 || 0}
            rate="~27,99%"
          />
          <TaxCard
            title="Mit Kirchensteuer (8%)"
            amount={summary?.steuerMitKirche8 || 0}
            rate="~27,82%"
          />
        </div>
      </div>

      {/* Verlusttöpfe */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <TrendingDown className="h-4 w-4 text-slate-500" />
          Verlusttöpfe (Verlustvorträge)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <VerlusttopfCard title="Aktien" value={verlustToepfe?.AKTIEN || 0} />
          <VerlusttopfCard title="Allgemein" value={verlustToepfe?.ALLGEMEIN || 0} />
          <VerlusttopfCard title="Termingeschäfte" value={verlustToepfe?.TERMINGESCHAEFTE || 0} />
        </div>
      </div>

      {/* Trading Stats */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          Trading-Statistik
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox label="Plus-Tage" value={winDays} color="text-emerald-400" />
          <StatBox label="Minus-Tage" value={lossDays} color="text-red-400" />
          <StatBox label="Flat-Tage" value={flatDays} color="text-slate-400" />
          <StatBox label="Gesamt-Tage" value={dailyReport?.length || 0} color="text-blue-400" />
        </div>
      </div>
    </div>
  );

  // ─── Render: Anlage KAP Tab ───
  const renderAnlageKap = () => {
    if (!anlageKAP) return null;

    const zeilen = Object.entries(anlageKAP)
      .filter(([_, data]) => data.wert !== undefined && data.wert !== 0)
      .sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <FileText className="h-4 w-4 text-slate-500" />
            Anlage KAP — Zeilen-Mapping
          </h3>
          <span className="text-xs text-slate-500">
            Für die Steuererklärung beim Finanzamt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-4 text-left font-medium text-slate-500">Zeile</th>
                <th className="py-2 pr-4 text-left font-medium text-slate-500">Beschreibung</th>
                <th className="py-2 text-right font-medium text-slate-500">Betrag (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {zeilen.map(([zeile, data]) => (
                <tr key={zeile} className="hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-400">{zeile}</td>
                  <td className="py-2.5 pr-4 text-slate-300">{data.beschreibung}</td>
                  <td className={`py-2.5 text-right font-mono font-medium ${
                    typeof data.wert === 'number' && data.wert < 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {typeof data.wert === 'number' ? formatCurrency(data.wert) : data.wert}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {zeilen.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            Keine Anlage KAP Zeilen mit Werten vorhanden.
          </p>
        )}
      </div>
    );
  };

  // ─── Render: Daily Tab ───
  const renderDaily = () => (
    <div className="space-y-4">
      {dailyReport?.map((day) => {
        const isExpanded = expandedDays.has(day.date);
        const isWin = day.pnl > 0;
        const isLoss = day.pnl < 0;

        return (
          <motion.div
            key={day.date}
            layout
            className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"
          >
            <button
              onClick={() => toggleDay(day.date)}
              className="flex w-full items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-300">
                  {new Date(day.date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                  {day.trades.length} Trade{day.trades.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-sm font-medium ${
                  isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {isWin ? '+' : ''}{formatCurrency(day.pnl)}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-800 px-6 py-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800/50">
                          <th className="pb-2 pr-3 text-left text-slate-500">Symbol</th>
                          <th className="pb-2 pr-3 text-left text-slate-500">Typ</th>
                          <th className="pb-2 pr-3 text-right text-slate-500">Menge</th>
                          <th className="pb-2 pr-3 text-right text-slate-500">Preis</th>
                          <th className="pb-2 text-right text-slate-500">P&L (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {day.trades.map((trade, i) => (
                          <tr key={i} className="hover:bg-slate-800/20">
                            <td className="py-2 pr-3 font-mono text-slate-300">{trade.symbol}</td>
                            <td className="py-2 pr-3">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                trade.buySell === 'BUY' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {trade.buySell}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono text-slate-400">{trade.quantity}</td>
                            <td className="py-2 pr-3 text-right font-mono text-slate-400">{trade.tradePrice?.toFixed(2)}</td>
                            <td className={`py-2 text-right font-mono font-medium ${
                              (trade.fifoPnlRealizedEUR || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {(trade.fifoPnlRealizedEUR || 0) >= 0 ? '+' : ''}
                              {formatCurrency(trade.fifoPnlRealizedEUR || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      }) || (
        <p className="py-8 text-center text-sm text-slate-500">Keine Tagesdaten vorhanden.</p>
      )}
    </div>
  );

  // ─── Render: Warnings Tab ───
  const renderWarnings = () => (
    <div className="space-y-4">
      {errors?.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-300">
            <AlertTriangle className="h-4 w-4" />
            Fehler ({errors.length})
          </h3>
          <ul className="space-y-2">
            {errors.map((err, i) => (
              <li key={i} className="text-sm text-red-200/70">• {err.message || JSON.stringify(err)}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings?.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Warnungen ({warnings.length})
          </h3>
          <ul className="space-y-2">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-200/70">
                • {w.type === 'FX_ABWEICHUNG'
                  ? `Wechselkurs-Abweichung: ${w.waehrung} am ${w.datum} (EZB: ${w.ezbKurs?.toFixed(6)}, IBKR: ${w.ibkrKurs?.toFixed(6)})`
                  : w.type === 'FX_NICHT_VALIDIERT'
                  ? `Nicht validierter Kurs: ${w.waehrung} am ${w.datum}`
                  : w.type === 'FX_FEHLEND'
                  ? `Fehlender Kurs: ${w.waehrung} am ${w.datum}`
                  : JSON.stringify(w)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
          <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-300">Keine Warnungen</p>
          <p className="text-xs text-emerald-200/60">Alle Wechselkurse wurden erfolgreich validiert.</p>
        </div>
      )}
    </div>
  );

  // ─── Tabs ───
  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: PieChart },
    { id: 'anlagekap', label: 'Anlage KAP', icon: FileText },
    { id: 'daily', label: 'Tagesbericht', icon: Calendar },
    { id: 'warnings', label: 'Warnungen', icon: AlertTriangle, badge: warnings?.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            Steuerreport {year}
          </h2>
          <p className="text-sm text-slate-500">
            {taxpayer} · CapTrader (Interactive Brokers)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500"
          >
            <Printer className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'anlagekap' && renderAnlageKap()}
          {activeTab === 'daily' && renderDaily()}
          {activeTab === 'warnings' && renderWarnings()}
        </motion.div>
      </AnimatePresence>

      {/* Raw Data Toggle */}
      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          {showRaw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showRaw ? 'Rohdaten ausblenden' : 'Rohdaten anzeigen'}
        </button>
        <AnimatePresence>
          {showRaw && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-500"
            >
              {JSON.stringify(report.raw || report, null, 2)}
            </motion.pre>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-Components ───

function SummaryCard({ title, value, icon: Icon, iconColor, bgColor, suffix = '€' }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgColor}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <span className="text-xs font-medium text-slate-500">{title}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${value >= 0 ? 'text-slate-100' : 'text-red-400'}`}>
        {suffix === '€' ? formatCurrency(value) : value}
      </p>
    </div>
  );
}

function TaxCard({ title, amount, rate, highlight = false }) {
  return (
    <div className={`rounded-lg border p-4 ${
      highlight ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/30'
    }`}>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-bold font-mono text-slate-100">{formatCurrency(amount)}</p>
      <p className="mt-1 text-xs text-slate-500">Satz: {rate}</p>
    </div>
  );
}

function VerlusttopfCard({ title, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className={`mt-1 text-lg font-bold font-mono ${value > 0 ? 'text-red-400' : 'text-slate-400'}`}>
        {formatCurrency(value)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {value > 0 ? 'Verlustvortrag vorhanden' : 'Kein Verlustvortrag'}
      </p>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-center">
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ─── Helpers ───

function formatCurrency(value) {
  if (value === undefined || value === null) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function generateCSVFromReport(report) {
  const lines = ['Kategorie;Wert;Hinweis'];
  if (report.summary) {
    lines.push(`Jahr;${report.year};`);
    lines.push(`Steuerpflichtiger;${report.taxpayer};`);
    lines.push(`Gesamtergebnis;${report.summary.saldo?.toFixed(2) || 0};`);
    lines.push(`Gewinne;${report.summary.totalGewinn?.toFixed(2) || 0};`);
    lines.push(`Verluste;${report.summary.totalVerlust?.toFixed(2) || 0};`);
    lines.push(`Steuer ohne KS;${report.summary.steuerOhneKirche?.toFixed(2) || 0};`);
    lines.push(`Steuer mit KS 9%;${report.summary.steuerMitKirche9?.toFixed(2) || 0};`);
    lines.push(`Steuer mit KS 8%;${report.summary.steuerMitKirche8?.toFixed(2) || 0};`);
  }
  if (report.anlageKAP) {
    for (const [zeile, data] of Object.entries(report.anlageKAP)) {
      if (data.wert !== undefined) {
        lines.push(`Anlage KAP ${zeile};${typeof data.wert === 'number' ? data.wert.toFixed(2) : data.wert};${data.beschreibung}`);
      }
    }
  }
  return lines.join('\n');
}

