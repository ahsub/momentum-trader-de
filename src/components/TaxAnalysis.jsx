import React, { useState, useEffect, useCallback } from 'react';
import { loadPortfolioData } from '../services/portfolioBridge';
import { generateAnnualReport, generateMultiYearReport, exportTaxCSV, calculateGermanTaxes } from '../services/taxReportService';

const CHURCH_TAX_RATES = {
  none: { label: 'Keine', rate: 0 },
  bw_bayern: { label: 'Baden-Württemberg / Bayern (8%)', rate: 0.08 },
  other: { label: 'Andere Bundesländer (9%)', rate: 0.09 },
};

export default function TaxAnalysis() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [reports, setReports] = useState({});
  const [activeYear, setActiveYear] = useState(2024);
  const [churchTaxKey, setChurchTaxKey] = useState('none');
  const [isJointAccount, setIsJointAccount] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = loadPortfolioData();
    if (data) {
      setPortfolioData(data);
      // Generate reports for all available years
      const years = [2023, 2024];
      const multiYear = generateMultiYearReport(data, years, { churchTaxKey, isJointAccount });
      const reportMap = {};
      multiYear.forEach(r => { reportMap[r.year] = r; });
      setReports(reportMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!portfolioData) return;
    const years = [2023, 2024];
    const multiYear = generateMultiYearReport(portfolioData, years, { churchTaxKey, isJointAccount });
    const reportMap = {};
    multiYear.forEach(r => { reportMap[r.year] = r; });
    setReports(reportMap);
  }, [churchTaxKey, isJointAccount, portfolioData]);

  const downloadCSV = useCallback((year) => {
    const report = reports[year];
    if (!report) return;
    const csv = exportTaxCSV(report);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Steuerreport_${year}_tagesgenau.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [reports]);

  const downloadAllCSV = useCallback(() => {
    let allCSV = '\uFEFF';
    Object.values(reports).forEach(report => {
      allCSV += `=== JAHR ${report.year} ===\n`;
      allCSV += exportTaxCSV(report);
      allCSV += '\n\n';
    });
    const blob = new Blob([allCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Steuerreport_alle_Jahre_tagesgenau.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [reports]);

  if (loading) {
    return <div className="text-slate-400 text-center py-12">Lade Steuerdaten...</div>;
  }

  if (!portfolioData) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-lg font-semibold text-slate-200 mb-2">Kein Portfolio importiert</h3>
        <p className="text-slate-400 text-sm">
          Importiere zuerst deine CapTrader Flex-Query XML unter "Portfolio" → "CapTrader Import"
        </p>
      </div>
    );
  }

  const activeReport = reports[activeYear];
  if (!activeReport) {
    return <div className="text-slate-400 text-center py-12">Keine Daten für {activeYear}</div>;
  }

  const { tax, summary, dailyBreakdown, fifoDetails, optionsDetails, dividends } = activeReport;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Steuerreport Kapitalerträge</h2>
          <p className="text-sm text-slate-400">Tagesgenaue Aufstellung aller realisierten Erträge in EUR</p>
        </div>
        <div className="flex gap-2">
          {[2023, 2024].map(year => (
            <button
              key={year}
              onClick={() => setActiveYear(year)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeYear === year
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Tax Settings */}
      <div className="bg-slate-800/50 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-200">Steuerliche Einstellungen</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Kirchensteuer</label>
            <select
              value={churchTaxKey}
              onChange={(e) => setChurchTaxKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              {Object.entries(CHURCH_TAX_RATES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="joint"
              checked={isJointAccount}
              onChange={(e) => setIsJointAccount(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-emerald-500 w-4 h-4"
            />
            <label htmlFor="joint" className="text-sm text-slate-300">
              Gemeinschaftskonto (€2.000 Sparer-Pauschbetrag)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCSV(activeYear)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              📥 CSV {activeYear}
            </button>
            <button
              onClick={downloadAllCSV}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              📥 Alle Jahre
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Sparer-Pauschbetrag: €{isJointAccount ? '2.000' : '1.000'} 
          {churchTaxKey !== 'none' && ` | Kirchensteuer: ${CHURCH_TAX_RATES[churchTaxKey].label}`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TaxCard
          label="Realisiert Gesamt"
          value={`€${summary.totalRealizedPnL_EUR.toFixed(2)}`}
          positive={summary.totalRealizedPnL_EUR >= 0}
        />
        <TaxCard
          label="Aktien P&L"
          value={`€${summary.stockPnL_EUR.toFixed(2)}`}
          positive={summary.stockPnL_EUR >= 0}
        />
        <TaxCard
          label="Optionen P&L"
          value={`€${summary.optionsPnL_EUR.toFixed(2)}`}
          positive={summary.optionsPnL_EUR >= 0}
        />
        <TaxCard
          label="Dividenden"
          value={`€${summary.dividendIncome_EUR.toFixed(2)}`}
          positive={true}
        />
      </div>

      {/* Tax Calculation */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">Steuerberechnung</h3>
        <div className="space-y-2 text-sm">
          <TaxRow label="Steuerpflichtige Erträge" value={tax.remainingTaxable} />
          <TaxRow label="Sparer-Pauschbetrag (genutzt)" value={tax.usedAllowance} color="text-emerald-400" />
          <div className="border-t border-slate-700 my-2" />
          <TaxRow label="Abgeltungsteuer (25%)" value={-tax.abgeltungsteuer} />
          <TaxRow label="Solidaritätszuschlag (5,5%)" value={-tax.soli} />
          {tax.kirchensteuer > 0 && (
            <TaxRow label={`Kirchensteuer (${(CHURCH_TAX_RATES[churchTaxKey].rate * 100).toFixed(0)}%)`} value={-tax.kirchensteuer} />
          )}
          <div className="border-t border-slate-700 my-2" />
          <TaxRow label="Gesamtsteuer" value={-tax.totalTax} bold />
          <TaxRow label="Netto nach Steuern" value={tax.netGain} bold positive={tax.netGain >= 0} />
          <div className="text-xs text-slate-500 mt-2">
            Effektiver Steuersatz: {tax.effectiveTaxRate.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h3 className="font-semibold text-slate-200 mb-3">
          Tagesgenaue Aufstellung ({dailyBreakdown.length} Tage)
        </h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-800">
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left py-2 px-3">Datum</th>
                <th className="text-right py-2 px-3">Aktien</th>
                <th className="text-right py-2 px-3">Optionen</th>
                <th className="text-right py-2 px-3">Dividenden</th>
                <th className="text-right py-2 px-3">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {dailyBreakdown.map((day, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-mono text-slate-300">{day.date}</td>
                  <td className={`py-2 px-3 text-right ${day.stockPnL !== 0 ? (day.stockPnL > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>
                    {day.stockPnL !== 0 ? (day.stockPnL > 0 ? '+' : '') + day.stockPnL.toFixed(2) : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right ${day.optionsPnL !== 0 ? (day.optionsPnL > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>
                    {day.optionsPnL !== 0 ? (day.optionsPnL > 0 ? '+' : '') + day.optionsPnL.toFixed(2) : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right ${day.dividends !== 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {day.dividends !== 0 ? '+' + day.dividends.toFixed(2) : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right font-semibold ${day.total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {day.total >= 0 ? '+' : ''}{day.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FIFO Details */}
      {fifoDetails.realizedTrades.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="font-semibold text-slate-200 mb-3">FIFO Details – Aktienverkäufe</h3>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left py-2 px-3">Datum</th>
                  <th className="text-left py-2 px-3">Symbol</th>
                  <th className="text-right py-2 px-3">Menge</th>
                  <th className="text-right py-2 px-3">Verkauf €</th>
                  <th className="text-right py-2 px-3">Kosten €</th>
                  <th className="text-right py-2 px-3">Realisiert €</th>
                  <th className="text-right py-2 px-3">Haltedauer</th>
                </tr>
              </thead>
              <tbody>
                {fifoDetails.realizedTrades.map((t, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 px-3 font-mono text-slate-300">{t.sellDate}</td>
                    <td className="py-2 px-3 font-semibold text-slate-200">{t.symbol}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{t.quantity}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{t.proceedsEUR.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{t.totalCostEUR.toFixed(2)}</td>
                    <td className={`py-2 px-3 text-right font-semibold ${t.realizedPnlEUR >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.realizedPnlEUR >= 0 ? '+' : ''}{t.realizedPnlEUR.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{t.holdingPeriodDays} Tage</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Options Details */}
      {optionsDetails.positions.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="font-semibold text-slate-200 mb-3">Options-Details</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {optionsDetails.positions.map((pos, i) => (
              <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-semibold text-slate-200">
                    {pos.underlying} {pos.putCall} {pos.strike} {pos.expiry}
                  </span>
                  <span className={`text-sm font-medium ${pos.netPremiumEUR >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pos.netPremiumEUR >= 0 ? '+' : ''}€{pos.netPremiumEUR.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  {pos.tradeDetails.map((td, j) => (
                    <div key={j} className="flex justify-between">
                      <span>{td.date} – {td.buySell} {td.quantity} @ {td.price.toFixed(2)}</span>
                      <span className={td.premiumEUR >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {td.premiumEUR >= 0 ? '+' : ''}€{td.premiumEUR.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dividends */}
      {dividends.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="font-semibold text-slate-200 mb-3">Dividenden</h3>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left py-2 px-3">Datum</th>
                  <th className="text-left py-2 px-3">Symbol</th>
                  <th className="text-right py-2 px-3">Betrag €</th>
                  <th className="text-right py-2 px-3">Original</th>
                  <th className="text-right py-2 px-3">FX-Rate</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-2 px-3 font-mono text-slate-300">{d.date}</td>
                    <td className="py-2 px-3 font-semibold text-slate-200">{d.symbol}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">€{d.amountEUR.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{d.amountOriginal.toFixed(2)} {d.currency}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{d.fxRate.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxCard({ label, value, positive }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold ${positive === undefined ? 'text-slate-200' : positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {value}
      </div>
    </div>
  );
}

function TaxRow({ label, value, bold, positive, color }) {
  const cls = bold ? 'font-semibold' : '';
  const valCls = color || (positive !== undefined ? (positive ? 'text-emerald-400' : 'text-red-400') : value >= 0 ? 'text-emerald-400' : 'text-red-400');
  return (
    <div className={`flex justify-between ${cls}`}>
      <span className="text-slate-400">{label}</span>
      <span className={valCls}>
        {value >= 0 ? '+' : ''}€{Math.abs(value).toFixed(2)}
      </span>
    </div>
  );
}
