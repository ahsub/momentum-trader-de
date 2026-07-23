import { useState, useEffect, useCallback } from 'react';
import { mcmUIState, REGIME_CONFIG, getRiskLevel } from '../store/McmStore.ts';

export function useMcmStore() {
  const [state, setState] = useState(() => {
    const initial = { ...mcmUIState };
    delete initial.listeners;
    delete initial._notify;
    delete initial.subscribe;
    delete initial.updateRegime;
    delete initial.updateRiskScore;
    delete initial.updateMarketData;
    delete initial.triggerCircuitBreaker;
    delete initial.resetCircuitBreaker;
    delete initial.checkPositionGate;
    delete initial._autoDetectRegime;
    return initial;
  });

  useEffect(() => {
    return mcmUIState.subscribe(setState);
  }, []);

  const updateRegime = useCallback((regime, confidence) => {
    mcmUIState.updateRegime(regime, confidence);
  }, []);

  const updateRiskScore = useCallback((score) => {
    mcmUIState.updateRiskScore(score);
  }, []);

  const updateMarketData = useCallback((vix, trend, breadth) => {
    mcmUIState.updateMarketData(vix, trend, breadth);
  }, []);

  const triggerCircuitBreaker = useCallback((reason) => {
    mcmUIState.triggerCircuitBreaker(reason);
  }, []);

  const resetCircuitBreaker = useCallback(() => {
    mcmUIState.resetCircuitBreaker();
  }, []);

  return {
    ...state,
    regimeConfig: REGIME_CONFIG[state.regime],
    riskLevel: getRiskLevel(state.riskScore),
    updateRegime,
    updateRiskScore,
    updateMarketData,
    triggerCircuitBreaker,
    resetCircuitBreaker
  };
}
