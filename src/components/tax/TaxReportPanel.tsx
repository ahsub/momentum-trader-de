// src/components/tax/TaxReportPanel.tsx
import React from 'react';
import type { TaxResult, TaxSummary } from '@/types/tax';

interface TaxReportPanelProps {
  results: TaxResult[];
  summary: TaxSummary | null;
  onExport: () => void;
  onClear: () => void;
}

export const TaxReportPanel: React.FC<TaxReportPanelProps> = ({
  results,
  summary,
  onExport,
  onClear,
}) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 2,
    }).format(value);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Steuerbericht</h2>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            disabled={results.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            📥 Export JSON
          </button>
          <button
            onClick={onClear}
            disabled={results.length === 0}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          >
            🗑️ Leeren
          </button>
        </div>
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Realisierter P&L</p>
            <p className={`text-lg font-bold ${summary.totalRealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalRealizedPnl)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Steuerpflichtig</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(summary.totalTaxableAmount)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Steuerlast</p>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(summary.totalTaxOwed)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Trades</p>
            <p className="text-lg font-bold text-gray-900">
              {summary.numberOfTrades}
            </p>
          </div>
        </div>
      )}

      {Object.entries(summary?.byAssetClass ?? {}).length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Nach Steuerart
          </h3>
          <div className="space-y-2">
            {Object.entries(summary.byAssetClass).map(([type, data]) => (
              <div
                key={type}
                className="flex items-center justify-between rounded-md bg-gray-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-700">{type}</span>
                <div className="flex gap-6 text-sm">
                  <span>P&L: {formatCurrency(data.pnl)}</span>
                  <span>Steuer: {formatCurrency(data.taxOwed)}</span>
                  <span className="text-gray-400">({data.trades} Trades)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Einzeltrades
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2">Symbol</th>
                  <th className="px-4 py-2">Datum</th>
                  <th className="px-4 py-2">Menge</th>
                  <th className="px-4 py-2">P&L</th>
                  <th className="px-4 py-2">Steuerpflichtig</th>
                  <th className="px-4 py-2">Steuer</th>
                  <th className="px-4 py-2">Satz</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((result, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{result.symbol}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(result.sellDate).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-2">{result.quantity}</td>
                    <td className={`px-4 py-2 ${result.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(result.realizedPnl)}
                    </td>
                    <td className="px-4 py-2">{formatCurrency(result.taxableAmount)}</td>
                    <td className="px-4 py-2 text-red-600">{formatCurrency(result.taxOwed)}</td>
                    <td className="px-4 py-2">{formatPercent(result.taxRateApplied)}</td>
                    <td className="px-4 py-2">
                      {result.holdingPeriodMet ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Frei
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Pflicht
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <p className="text-lg">Noch keine Trades berechnet</p>
          <p className="text-sm">Füge Positionen hinzu und berechne Steuern für Verkäufe</p>
        </div>
      )}
    </div>
  );
};
