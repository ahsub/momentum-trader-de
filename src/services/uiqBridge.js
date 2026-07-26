// ═══════════════════════════════════════════════════════════════════════════
// UIQ BRIDGE v2 — Parsed den market-Block aus master_market_data
// KEIN separater Fetch! Alles kommt mit dem Aggregator-Datenstream.
// ═══════════════════════════════════════════════════════════════════════════

let uiqCache = null;

// ─── PUBLIC API ───────────────────────────────────────────────────────────

export function setMarketMeta(meta) {
  uiqCache = resolveUiqFromMarketBlock(meta);
}

export function getCachedUiq() {
  return uiqCache;
}

export function resolveUiqFromMarketBlock(market) {
  if (!market) return getDefaultUiqData();

  const vix = market.vix ?? 20;
  const vvix = market.vvix ?? 95;
  const skew = market.skew ?? 130;
  const vixZ = market.vix_z252 ?? 0;
  const vvixZ = market.vvix_z252 ?? 0;
  const skewPct = market.skew_pct252 ?? 50;
  const hySpread = market.hy_spread ?? 3.0;
  const hyZ = market.hy_z252 ?? 0;
  const netLiquidity = market.net_liquidity ?? null;
  const netLiqTrend = market.net_liquidity_4w_trend ?? null;
  const termStructure = market.vix_term_structure ?? 'CONTANGO';
  const move = market.move_index ?? null;
  const dix = market.dix ?? null;
  const pcr = market.pcr_proxy ?? null;
  const fearGreed = market.fear_greed ?? 50;
  const iosScore = market.ios_market_score ?? 50;
  const mseRegime = market.mse_regime ?? 'NEUTRAL';

  const regime = resolveRegimeFromMacro({
    vix, vvix, skew, vixZ, vvixZ, hySpread, hyZ,
    termStructure, fearGreed, iosScore, mseRegime
  });

  const trafficLight = resolveTrafficLight({ regime, vvix, skew, vix, term: termStructure });

  return {
    date: market.date || new Date().toISOString().split('T')[0],
    regime,
    rawRegime: mseRegime,
    vix,
    vvix,
    skew,
    vixZ,
    vvixZ,
    skewPct,
    hySpread,
    hyZ,
    netLiquidity,
    netLiqTrend,
    termStructure,
    move,
    dix,
    pcr,
    fearGreed,
    iosScore,
    trafficLight,
    ivEnvironment: vvix > 100 ? 'ELEVATED' : vvix > 85 ? 'NORMAL' : 'LOW',
    tailRisk: skew > 145 ? 'EXTREME' : skew > 135 ? 'ELEVATED' : 'NORMAL',
    creditStress: hyZ > 2 ? 'HIGH' : hyZ > 1 ? 'ELEVATED' : 'NORMAL',
    liquidityTrend: netLiqTrend > 50 ? 'EXPANDING' : netLiqTrend < -50 ? 'CONTRACTING' : 'STABLE',
    breadthWarning: iosScore < 45,
    cspTiming: resolveCspTiming({ vix, vvix, skew, hyZ, termStructure, fearGreed }),
    raw: market
  };
}

export function resolveTrafficLight({ regime, vvix, skew, vix, term }) {
  const lights = {
    csp: 'red', wheel: 'red', cc: 'red',
    pmcc: 'red', leap: 'red', zebra: 'red',
    ironCondor: 'red', putDiagonal: 'red',
    protectiveCollar: 'red', koLong: 'red', koShort: 'red'
  };

  switch (regime) {
    case 'BULL_QUIET':
      lights.cc = 'green'; lights.csp = 'green';
      lights.pmcc = 'green'; lights.leap = 'green';
      lights.koLong = 'yellow'; lights.wheel = 'green';
      break;
    case 'BULL':
      lights.cc = 'green'; lights.csp = 'yellow';
      lights.pmcc = 'green'; lights.leap = 'yellow';
      lights.koLong = 'green'; lights.wheel = 'yellow';
      break;
    case 'NEUTRAL':
      lights.csp = 'green'; lights.wheel = 'green';
      lights.ironCondor = 'green'; lights.putDiagonal = 'green';
      lights.cc = 'yellow'; lights.pmcc = 'yellow';
      break;
    case 'CAUTIOUS':
      lights.csp = 'yellow'; lights.putDiagonal = 'yellow';
      lights.ironCondor = 'yellow'; lights.cc = 'red';
      lights.pmcc = 'red'; lights.leap = 'red';
      lights.protectiveCollar = 'green';
      break;
    case 'BEAR':
    case 'STRESS':
      lights.protectiveCollar = 'green'; lights.csp = 'red';
      lights.cc = 'red'; lights.pmcc = 'red';
      lights.koShort = 'yellow';
      break;
  }

  if (vvix > 120) {
    Object.keys(lights).forEach(k => {
      if (lights[k] === 'green') lights[k] = 'yellow';
    });
  }

  return lights;
}

export function scoreWithUiq(ticker, strategy, uiq) {
  let score = ticker.compositeScore || 0;

  const alignment = getRegimeAlignment(strategy, uiq.regime);
  score += alignment * 10;

  const sectors = (ticker.sectors || '').toLowerCase();
  if (uiq.favoredSectors?.some(s => sectors.includes(s.toLowerCase()))) score += 5;
  if (uiq.disfavoredSectors?.some(s => sectors.includes(s.toLowerCase()))) score -= 10;

  if (strategy === 'ironCondor' && uiq.ivEnvironment === 'ELEVATED') score += 5;
  if (strategy === 'csp') {
    if (uiq.cspTiming?.signal === 'EXCELLENT') score += 10;
    if (uiq.cspTiming?.signal === 'AVOID') score -= 15;
    if (uiq.ivEnvironment === 'LOW') score -= 5;
    if (uiq.ivEnvironment === 'ELEVATED') score += 5;
  }

  if (uiq.tailRisk === 'EXTREME' && ['protectiveCollar', 'putDiagonal'].includes(strategy)) score += 8;
  if (uiq.creditStress === 'HIGH' && ['csp', 'wheel'].includes(strategy)) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ─── INTERNAL ─────────────────────────────────────────────────────────────

function resolveRegimeFromMacro({ vix, vvix, skew, vixZ, vvixZ, hySpread, hyZ, termStructure, fearGreed, iosScore, mseRegime }) {
  if (mseRegime && mseRegime !== 'UNKNOWN') {
    if (vvix > 120 || skew > 150 || hyZ > 2.5) return 'STRESS';
    if (vvix > 105 || skew > 145 || hyZ > 1.5) return 'CAUTIOUS';
    return mseRegime.toUpperCase().replace(/\s+/g, '_');
  }

  if (vvix > 120 || skew > 150 || hyZ > 2.5) return 'STRESS';
  if (vvix > 105 || skew > 145 || hyZ > 1.5) return 'CAUTIOUS';
  if (vix < 16 && vvix < 90 && hyZ < 0.5 && iosScore > 60) return 'BULL_QUIET';
  if (vix < 20 && vvix < 100 && hyZ < 1 && iosScore > 50) return 'BULL';
  if (vix > 25 || vvix > 110 || hyZ > 2) return 'BEAR';
  return 'NEUTRAL';
}

function resolveCspTiming({ vix, vvix, skew, hyZ, termStructure, fearGreed }) {
  let score = 50;
  let signal = 'NEUTRAL';
  let rationale = [];

  if (vvix > 100) { score += 15; rationale.push('VVIX elevated → higher premiums'); }
  if (vix > 20 && vix < 30) { score += 10; rationale.push('VIX in sweet spot'); }
  if (vix > 30) { score -= 10; rationale.push('VIX too high → assignment risk'); }
  if (skew > 140) { score += 5; rationale.push('SKEW high → OTM puts rich'); }
  if (hyZ < 1) { score += 10; rationale.push('Credit calm → no systemic risk'); }
  if (hyZ > 2) { score -= 20; rationale.push('Credit stress → avoid CSP'); }
  if (termStructure === 'CONTANGO') { score += 5; rationale.push('Term structure normal'); }
  if (termStructure === 'BACKWARDATION') { score -= 10; rationale.push('Backwardation → stress'); }
  if (fearGreed < 30) { score += 10; rationale.push('Fear → contrarian entry'); }
  if (fearGreed > 75) { score -= 10; rationale.push('Greed → premiums compressed'); }

  if (score >= 75) signal = 'EXCELLENT';
  else if (score >= 60) signal = 'GOOD';
  else if (score >= 45) signal = 'FAIR';
  else if (score >= 30) signal = 'POOR';
  else signal = 'AVOID';

  return { score: Math.max(0, Math.min(100, score)), signal, rationale };
}

function getRegimeAlignment(strategy, regime) {
  const map = {
    bull: { cc: 1, csp: 0.5, pmcc: 1, leap: 0.5, koLong: 1, wheel: 0.5, ironCondor: -0.3 },
    bull_quiet: { cc: 1, csp: 1, pmcc: 1, leap: 1, koLong: 0.5, wheel: 1 },
    neutral: { csp: 1, wheel: 1, ironCondor: 1, putDiagonal: 0.5, cc: 0.3 },
    cautious: { protectiveCollar: 1, putDiagonal: 0.5, ironCondor: 0.3, csp: 0.3 },
    bear: { protectiveCollar: 1, koShort: 0.5 },
    stress: { protectiveCollar: 1 }
  };
  return (map[regime.toLowerCase()] || {})[strategy] || 0;
}

function getDefaultUiqData() {
  return {
    date: new Date().toISOString().split('T')[0],
    regime: 'NEUTRAL',
    vix: 20, vvix: 95, skew: 130,
    vixZ: 0, vvixZ: 0, skewPct: 50,
    hySpread: 3.0, hyZ: 0,
    netLiquidity: null, netLiqTrend: null,
    termStructure: 'CONTANGO',
    move: null, dix: null, pcr: null,
    fearGreed: 50, iosScore: 50,
    trafficLight: {},
    ivEnvironment: 'NORMAL',
    tailRisk: 'NORMAL',
    creditStress: 'NORMAL',
    liquidityTrend: 'STABLE',
    breadthWarning: false,
    cspTiming: { score: 50, signal: 'NEUTRAL', rationale: [] },
    raw: null
  };
}
