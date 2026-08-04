// src/components/tax/TaxDemoPage.tsx
import React, { useState } from 'react';
import { AssetClass } from '@/types/tax';
import { useTaxEngine } from '@/hooks/useTaxEngine';
import { TaxReportPanel } from './TaxReportPanel';

export const TaxDemoPage: React.FC = () => {
  const {
    results,
    summary,
    isCalculating,
    addPositions,
    calculateTrade,
    clear,
    exportReport,
  } = useTaxEngine();

  const [status, setStatus] = useState('');

  const runDemo = () => {
    clear();
    setStatus('🔄 Berechne Demo-Trades...');

    const now = new Date().toISOString();
    const oneYearAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const elevenYearsAgo = new Date(Date.now() - 4015 * 24 * 60 * 60 * 1000).toISOString();

    // Positionen hinzufügen
    addPositions([
      {
        id: 'pos-sap-1',
        assetClass: AssetClass.EQUITY,
        symbol: 'SAP',
        buyDate: oneYearAgo,
        quantity: 100,
        buyPrice: 120,
        fees: 5,
      },
      {
        id: 'pos-sap-2',
        assetClass: AssetClass.EQUITY,
        symbol: 'SAP',
        buyDate: sixMonthsAgo,
        quantity: 50,
        buyPrice: 130,
        fees: 3,
      },
      {
        id: 'pos-btc-1',
        assetClass: AssetClass.CRYPTO,
        symbol: 'BTC',
        buyDate: elevenYearsAgo,
        quantity: 2.5,
        buyPrice: 500,
        fees: 10,
      },
      {
        id: 'pos-gold-1',
        assetClass: AssetClass.PRECIOUS_METAL,
        symbol: 'GOLD',
        buyDate: sixMonthsAgo,
        quantity: 50,
        buyPrice: 55,
        fees: 15,
      },
      {
        id: 'pos-ko-1',
        assetClass: AssetClass.DERIVATIVE,
        symbol: 'TSLA-KO',
        buyDate: oneYearAgo,
        quantity: 1000,
        buyPrice: 2.5,
        fees: 5,
      },
    ]);

    // Trades berechnen
    setTimeout(() => {
      calculateTrade({
        id: 'trade-sap-1',
        assetClass: AssetClass.EQUITY,
        symbol: 'SAP',
        sellDate: now,
        quantity: 120,
        sellPrice: 150,
        fees: 8,
      });

      calculateTrade({
        id: 'trade-btc-1',
        assetClass: AssetClass.CRYPTO,
        symbol: 'BTC',
        sellDate: now,
        quantity: 2.0,
        sellPrice: 60000,
        fees: 50,
      });

      calculateTrade({
        id: 'trade-gold-1',
        assetClass: AssetClass.PRECIOUS_METAL,
        symbol: 'GOLD',
        sellDate: now,
        quantity: 30,
        sellPrice: 65,
        fees: 10,
      });

      calculateTrade({
        id: 'trade-ko-1',
        assetClass: AssetClass.DERIVATIVE,
        symbol: 'TSLA-KO',
        sellDate: now,
        quantity: 1000,
        sellPrice: 5.0,
        fees: 5,
      });

      setStatus('✅ Berechnung abgeschlossen!');
    }, 100);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Engine Demo</h1>
          <p className="text-sm text-gray-500">
            Modulare Steuerberechnung mit Strategy Pattern
          </p>
        </div>
        <button
          onClick={runDemo}
          disabled={isCalculating}
          className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isCalculating ? '⏳ Berechne...' : '🚀 Demo starten'}
        </button>
      </div>

      {status && (
        <div className="mb-4 rounded-md bg-blue-50 px-4 py-2 text-sm text-blue-700">
          {status}
        </div>
      )}

      <TaxReportPanel
        results={results}
        summary={summary}
        onExport={() => exportReport('steuerbericht-demo.json')}
        onClear={clear}
      />
    </div>
  );
};
