import { useState, useEffect, useCallback } from 'react';
import { calculateRegime } from '../utils/regimeCalculator';
import { calculateRiskScore, shouldTriggerCircuitBreaker } from '../utils/riskCalculator';

const SNAPSHOT_BASE_URL = '/data/snapshots';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook: reads snapshot JSON and computes regime + risk score
 * @param {string} date - optional date string YYYY-MM-DD, defaults to latest
 */
export function useSnapshotReader(date = null) {
  const [snapshot, setSnapshot] = useState(null);
  const [regime, setRegime] = useState('BULL_QUIET');
  const [riskScore, setRiskScore] = useState(15);
  const [circuitBreaker, setCircuitBreaker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filename = date ? `${date}.json` : 'latest.json';
      const response = await fetch(`${SNAPSHOT_BASE_URL}/${filename}`);

      if (!response.ok) {
        throw new Error(`Snapshot not found: ${response.status}`);
      }

      const data = await response.json();
      setSnapshot(data);

      // Auto-compute regime and risk
      const computedRegime = calculateRegime(data);
      const computedRisk = calculateRiskScore(computedRegime, data.vix);
      const cb = shouldTriggerCircuitBreaker(computedRegime, computedRisk);

      setRegime(computedRegime);
      setRiskScore(computedRisk);
      setCircuitBreaker(cb);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      // Fallback to safe defaults
      setRegime('BULL_QUIET');
      setRiskScore(50);
      setCircuitBreaker(false);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadSnapshot();

    const interval = setInterval(loadSnapshot, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadSnapshot]);

  return {
    snapshot,
    regime,
    riskScore,
    circuitBreaker,
    loading,
    error,
    lastUpdated,
    refresh: loadSnapshot
  };
}
