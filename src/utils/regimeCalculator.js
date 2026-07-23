/**
 * Pure function: calculates market regime from snapshot data
 * @param {Object} snapshot - market snapshot with vix, spx, breadth data
 * @returns {string} regime - one of BULL_QUIET, BULL_VOLATILE, BEAR_QUIET, BEAR_VOLATILE, CRISIS
 */
export function calculateRegime(snapshot) {
  if (!snapshot) return 'BULL_QUIET';

  const { vix, spx, breadth } = snapshot;

  const vixCurrent = vix?.current ?? 15;
  const spxCurrent = spx?.current ?? 0;
  const spxMa200 = spx?.ma200 ?? 0;
  const spxMa50 = spx?.ma50 ?? 0;
  const nyaChange = breadth?.nyaChangePercent ?? 0;

  // CRISIS: VIX > 30 AND SPX below MA200
  if (vixCurrent > 30 && spxCurrent < spxMa200) {
    return 'CRISIS';
  }

  // BEAR_VOLATILE: VIX > 25 OR severe breadth deterioration
  if (vixCurrent > 25 || nyaChange < -2.0) {
    return 'BEAR_VOLATILE';
  }

  // BULL_QUIET: VIX < 15 AND SPX above MA50 above MA200 (golden cross)
  if (vixCurrent < 15 && spxCurrent > spxMa50 && spxMa50 > spxMa200) {
    return 'BULL_QUIET';
  }

  // BULL_VOLATILE: VIX elevated but market still above MA200
  if (vixCurrent > 20 && spxCurrent > spxMa200) {
    return 'BULL_VOLATILE';
  }

  // BEAR_QUIET: below MA200 but not volatile
  if (spxCurrent < spxMa200) {
    return 'BEAR_QUIET';
  }

  // Default fallback
  return 'BULL_QUIET';
}

/**
 * Get human-readable regime label
 */
export function getRegimeLabel(regime) {
  const labels = {
    BULL_QUIET: 'Bull Quiet',
    BULL_VOLATILE: 'Bull Volatile',
    BEAR_QUIET: 'Bear Quiet',
    BEAR_VOLATILE: 'Bear Volatile',
    CRISIS: 'Crisis'
  };
  return labels[regime] || regime;
}

/**
 * Get regime color for UI
 */
export function getRegimeColor(regime) {
  const colors = {
    BULL_QUIET: 'bg-emerald-500',
    BULL_VOLATILE: 'bg-amber-500',
    BEAR_QUIET: 'bg-orange-500',
    BEAR_VOLATILE: 'bg-red-500',
    CRISIS: 'bg-red-700'
  };
  return colors[regime] || 'bg-gray-500';
}
