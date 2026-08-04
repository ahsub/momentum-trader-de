// src/hooks/useTaxEngine.ts
import { useState, useCallback, useRef } from 'react';
import type { Trade, Position, TaxResult, TaxSummary } from '@/types/tax';
import { TaxEngine } from '@/services/tax';

interface UseTaxEngineReturn {
  engine: TaxEngine;
  results: TaxResult[];
  summary: TaxSummary | null;
  isCalculating: boolean;
  addPosition: (position: Position) => void;
  addPositions: (positions: Position[]) => void;
  calculateTrade: (trade: Trade) => TaxResult | null;
  calculateTrades: (trades: Trade[]) => TaxResult[];
  clear: () => void;
  exportReport: (filename?: string) => void;
}

export function useTaxEngine(): UseTaxEngineReturn {
  const engineRef = useRef(new TaxEngine());
  const [results, setResults] = useState<TaxResult[]>([]);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const addPosition = useCallback((position: Position) => {
    engineRef.current.addPosition(position);
  }, []);

  const addPositions = useCallback((positions: Position[]) => {
    engineRef.current.addPositions(positions);
  }, []);

  const calculateTrade = useCallback((trade: Trade): TaxResult | null => {
    setIsCalculating(true);
    try {
      const result = engineRef.current.calculateTradeTax(trade);
      setResults(prev => [...prev, result]);
      setSummary(engineRef.current.getTaxSummary());
      return result;
    } catch (error) {
      console.error('Tax calculation error:', error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, []);

  const calculateTrades = useCallback((trades: Trade[]): TaxResult[] => {
    setIsCalculating(true);
    try {
      const newResults = engineRef.current.calculateMultipleTrades(trades);
      setResults(prev => [...prev, ...newResults]);
      setSummary(engineRef.current.getTaxSummary());
      return newResults;
    } catch (error) {
      console.error('Tax calculation error:', error);
      return [];
    } finally {
      setIsCalculating(false);
    }
  }, []);

  const clear = useCallback(() => {
    engineRef.current.clearResults();
    setResults([]);
    setSummary(null);
  }, []);

  const exportReport = useCallback((filename?: string) => {
    engineRef.current.downloadReport(filename);
  }, []);

  return {
    engine: engineRef.current,
    results,
    summary,
    isCalculating,
    addPosition,
    addPositions,
    calculateTrade,
    calculateTrades,
    clear,
    exportReport,
  };
}
