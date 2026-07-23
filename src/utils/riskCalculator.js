/**
 * Pure function: calculates risk score 0-100 from regime and VIX data
 * @param {string} regime - market regime
 * @param {Object} vix - VIX data with current and percentile
 * @returns {number} riskScore - 0 (low risk) to 100 (high risk)
 */
export function calculateRiskScore(regime, vix) {
  if (!regime) return 50;

  const baseScores = {
    BULL_QUIET: 15,
    BULL_VOLATILE: 50,
    BEAR_QUIET: 70,
    BEAR_VOLATILE: 85,
    CRISIS: 95
  };

  const base = baseScores[regime] ?? 50;
  const vixPercentile = vix?.percentile ?? 50;

  let adjustment = 0;

  switch (regime) {
    case 'BULL_QUIET':
      if (vixPercentile < 30) adjustment = -10;
      else if (vixPercentile < 50) adjustment = 5;
      else adjustment = 15;
      break;
    case 'BULL_VOLATILE':
      adjustment = vixPercentile < 50 ? -5 : 10;
      break;
    case 'BEAR_QUIET':
      adjustment = 5;
      break;
    case 'BEAR_VOLATILE':
    case 'CRISIS':
      adjustment = 0;
      break;
    default:
      adjustment = 0;
  }

  return Math.max(0, Math.min(100, base + adjustment));
}

/**
 * Determine if circuit breaker should trigger
 */
export function shouldTriggerCircuitBreaker(regime, riskScore) {
  return regime === 'CRISIS' || riskScore >= 90;
}

/**
 * Get risk level label
 */
export function getRiskLevel(riskScore) {
  if (riskScore <= 20) return 'Low';
  if (riskScore <= 40) return 'Moderate';
  if (riskScore <= 60) return 'Elevated';
  if (riskScore <= 80) return 'High';
  return 'Extreme';
}

/**
 * Get color for risk score
 */
export function getRiskColor(riskScore) {
  if (riskScore <= 20) return 'text-emerald-500';
  if (riskScore <= 40) return 'text-lime-500';
  if (riskScore <= 60) return 'text-amber-500';
  if (riskScore <= 80) return 'text-orange-500';
  return 'text-red-500';
}
