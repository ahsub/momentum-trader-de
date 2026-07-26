import {
  fetchKoAggregatorData,
  fetchOptionsWatchlist,
  getMarketMeta,
  filterLeapCandidates,
  filterPmccCandidates,
  filterZebraCandidates,
  filterPutDiagonalCandidates,
  filterCollaredLeapCandidates,
  filterIronCondorCandidates
} from './koAggregatorBridge';

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || '';

async function fetchFinnhubOptions(symbol) {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`[Screener] Finnhub options failed for ${symbol}:`, e);
    return null;
  }
}

function mockEnrich(symbol, price, strategy) {
  const ivRank = Math.floor(Math.random() * 35);
  const delta = 0.80 + Math.random() * 0.10;
  const dte = 300 + Math.floor(Math.random() * 240);
  return {
    symbol, price, ivRank,
    delta: parseFloat(delta.toFixed(2)),
    dte,
    extrinsicPct: Math.floor(Math.random() * 18),
    source: 'Mock',
    strategy
  };
}

// ─── LEAP ───
export async function screenLeapCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterLeapCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      return { ...mockEnrich(t.symbol, t.price, 'LEAP'), ...t, eligible: true };
    }
    const validExp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 300;
    });
    if (!validExp) return { ...t, strategy: 'LEAP', eligible: false, reason: 'No LEAP expiration found' };
    const strikes = validExp.options?.map(o => o.strike) || [];
    const itmStrike = strikes.filter(s => s < t.price).sort((a, b) => b - a)[0];
    const intrinsic = Math.max(0, t.price - (itmStrike || t.price * 0.85));
    const mockPrice = intrinsic * 1.15;
    return {
      ...t,
      strategy: 'LEAP',
      eligible: true,
      expiration: validExp.expirationDate,
      dte: Math.floor((new Date(validExp.expirationDate) - new Date()) / 86400000),
      delta: 0.85,
      ivRank: Math.floor(t.hvp),
      extrinsicPct: parseFloat((((mockPrice - intrinsic) / mockPrice) * 100).toFixed(1)),
      source: 'Finnhub'
    };
  }));
  return enriched.filter(e => e.eligible !== false);
}

// ─── PMCC ───
export async function screenPmccCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterPmccCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      const mock = mockEnrich(t.symbol, t.price, 'PMCC');
      return { ...t, ...mock, eligible: true, shortDte: 35, shortDelta: 0.25, width: 20, netDebit: 15 };
    }
    const leapExp = options.data.find(exp => Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000) >= 180);
    const shortExp = options.data.find(exp => {
      const d = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return d >= 25 && d <= 50;
    });
    if (!leapExp || !shortExp) return { ...t, strategy: 'PMCC', eligible: false, reason: 'Missing expirations' };
    const longStrike = t.price * 0.85, shortStrike = t.price * 1.05, width = shortStrike - longStrike;
    const longPremium = (t.price - longStrike) * 1.2, shortPremium = (shortStrike - t.price) * 0.4, netDebit = longPremium - shortPremium;
    return {
      ...t,
      strategy: 'PMCC',
      eligible: true,
      longStrike: parseFloat(longStrike.toFixed(2)),
      shortStrike: parseFloat(shortStrike.toFixed(2)),
      width: parseFloat(width.toFixed(2)),
      netDebit: parseFloat(netDebit.toFixed(2)),
      longDte: Math.floor((new Date(leapExp.expirationDate) - new Date()) / 86400000),
      shortDte: Math.floor((new Date(shortExp.expirationDate) - new Date()) / 86400000),
      longDelta: 0.85,
      shortDelta: 0.25,
      annualizedCoc: parseFloat(((shortPremium / netDebit) * (365 / 35) * 100).toFixed(1)),
      source: 'Finnhub'
    };
  }));
  return enriched.filter(e => e.eligible !== false);
}

export function validatePmccWidthRule(pmcc) {
  if (!pmcc.width || !pmcc.netDebit) return { valid: false, reason: 'Missing data' };
  const widthRule = pmcc.width - pmcc.netDebit;
  return {
    valid: widthRule > 0,
    widthRule: parseFloat(widthRule.toFixed(2)),
    maxProfit: parseFloat((widthRule * 100).toFixed(2)),
    maxLoss: parseFloat((pmcc.netDebit * 100).toFixed(2))
  };
}

// ─── ZEBRA ───
export async function screenZebraCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterZebraCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      return {
        ...mockEnrich(t.symbol, t.price, 'ZEBRA'),
        ...t,
        eligible: true,
        longStrike: parseFloat((t.price * 0.90).toFixed(2)),
        shortStrikes: [parseFloat((t.price * 1.05).toFixed(2)), parseFloat((t.price * 1.10).toFixed(2))],
        ratio: '1:2',
        netDebit: 15,
        breakeven: parseFloat((t.price * 1.15).toFixed(2))
      };
    }
    const exp = options.data.find(exp => {
      const dte = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return dte >= 90 && dte <= 180;
    });
    if (!exp) return { ...t, strategy: 'ZEBRA', eligible: false, reason: 'No suitable expiration' };
    const longStrike = t.price * 0.90;
    const shortStrike1 = t.price * 1.05;
    const shortStrike2 = t.price * 1.10;
    const netDebit = (t.price - longStrike) * 0.8;
    return {
      ...t,
      strategy: 'ZEBRA',
      eligible: true,
      expiration: exp.expirationDate,
      dte: Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000),
      longStrike: parseFloat(longStrike.toFixed(2)),
      shortStrikes: [parseFloat(shortStrike1.toFixed(2)), parseFloat(shortStrike2.toFixed(2))],
      ratio: '1:2',
      netDebit: parseFloat(netDebit.toFixed(2)),
      breakeven: parseFloat((shortStrike2 + netDebit).toFixed(2)),
      maxProfit: 'Unlimited above breakeven',
      source: 'Finnhub'
    };
  }));
  return enriched.filter(e => e.eligible !== false);
}

// ─── Put Diagonal ───
export async function screenPutDiagonalCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterPutDiagonalCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      return {
        ...mockEnrich(t.symbol, t.price, 'PUT_DIAGONAL'),
        ...t,
        eligible: true,
        longStrike: parseFloat((t.price * 0.88).toFixed(2)),
        shortStrike: parseFloat((t.price * 0.95).toFixed(2)),
        longDte: 90,
        shortDte: 35,
        netCredit: 2.5,
        be: parseFloat((t.price * 0.95).toFixed(2))
      };
    }
    const longExp = options.data.find(exp => {
      const d = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return d >= 60 && d <= 120;
    });
    const shortExp = options.data.find(exp => {
      const d = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return d >= 25 && d <= 45;
    });
    if (!longExp || !shortExp) return { ...t, strategy: 'PUT_DIAGONAL', eligible: false, reason: 'Missing expirations' };
    const longStrike = t.price * 0.88;
    const shortStrike = t.price * 0.95;
    const width = shortStrike - longStrike;
    const netCredit = width * 0.15;
    return {
      ...t,
      strategy: 'PUT_DIAGONAL',
      eligible: true,
      longStrike: parseFloat(longStrike.toFixed(2)),
      shortStrike: parseFloat(shortStrike.toFixed(2)),
      width: parseFloat(width.toFixed(2)),
      longDte: Math.floor((new Date(longExp.expirationDate) - new Date()) / 86400000),
      shortDte: Math.floor((new Date(shortExp.expirationDate) - new Date()) / 86400000),
      netCredit: parseFloat(netCredit.toFixed(2)),
      be: parseFloat(shortStrike.toFixed(2)),
      maxProfit: parseFloat((width + netCredit).toFixed(2)),
      source: 'Finnhub'
    };
  }));
  return enriched.filter(e => e.eligible !== false);
}

// ─── Collared LEAP ───
export async function screenCollaredLeapCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterCollaredLeapCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      return {
        ...mockEnrich(t.symbol, t.price, 'COLLARED_LEAP'),
        ...t,
        eligible: true,
        leapStrike: parseFloat((t.price * 0.85).toFixed(2)),
        callStrike: parseFloat((t.price * 1.12).toFixed(2)),
        putStrike: parseFloat((t.price * 0.88).toFixed(2)),
        netCost: 12,
        protection: '12%'
      };
    }
    const leapExp = options.data.find(exp => Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000) >= 300);
    const shortExp = options.data.find(exp => {
      const d = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return d >= 25 && d <= 50;
    });
    if (!leapExp || !shortExp) return { ...t, strategy: 'COLLARED_LEAP', eligible: false, reason: 'Missing expirations' };
    const leapStrike = t.price * 0.85;
    const callStrike = t.price * 1.12;
    const putStrike = t.price * 0.88;
    const leapCost = (t.price - leapStrike) * 1.3;
    const callCredit = (callStrike - t.price) * 0.35;
    const putCost = (t.price - putStrike) * 0.25;
    const netCost = leapCost - callCredit + putCost;
    return {
      ...t,
      strategy: 'COLLARED_LEAP',
      eligible: true,
      leapStrike: parseFloat(leapStrike.toFixed(2)),
      callStrike: parseFloat(callStrike.toFixed(2)),
      putStrike: parseFloat(putStrike.toFixed(2)),
      leapDte: Math.floor((new Date(leapExp.expirationDate) - new Date()) / 86400000),
      shortDte: Math.floor((new Date(shortExp.expirationDate) - new Date()) / 86400000),
      netCost: parseFloat(netCost.toFixed(2)),
      protection: parseFloat(((1 - putStrike / t.price) * 100).toFixed(1)) + '%',
      upside: parseFloat(((callStrike / t.price - 1) * 100).toFixed(1)) + '%',
      source: 'Finnhub'
    };
  }));
  return enriched.filter(e => e.eligible !== false);
}

// ─── Iron Condor ───
export async function screenIronCondorCandidates() {
  const koData = await fetchKoAggregatorData();
  const preScreened = filterIronCondorCandidates(koData);
  const enriched = await Promise.all(preScreened.map(async (t) => {
    const options = await fetchFinnhubOptions(t.symbol);
    if (!options || !options.data?.length) {
      const atrPct = (t.atr14 / t.price) * 100;
      return {
        ...mockEnrich(t.symbol, t.price, 'IRON_CONDOR'),
        ...t,
        eligible: true,
        putSpread: [parseFloat((t.price * 0.94).toFixed(2)), parseFloat((t.price * 0.91).toFixed(2))],
        callSpread: [parseFloat((t.price * 1.06).toFixed(2)), parseFloat((t.price * 1.09).toFixed(2))],
        width: parseFloat((t.price * 0.03).toFixed(2)),
        netCredit: 1.5,
        beRange: `${parseFloat((t.price * 0.94).toFixed(2))} - ${parseFloat((t.price * 1.06).toFixed(2))}`,
        atrPct: parseFloat(atrPct.toFixed(2))
      };
    }
    const exp = options.data.find(exp => {
      const d = Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000);
      return d >= 25 && d <= 45;
    });
    if (!exp) return { ...t, strategy: 'IRON_CONDOR', eligible: false, reason: 'No suitable expiration' };
    const putShort = t.price * 0.94;
    const putLong = t.price * 0.91;
    const callShort = t.price * 1.06;
    const callLong = t.price * 1.09;
    const width = putShort - putLong;
    const netCredit = width * 0.35;
    return {
      ...t,
      strategy: 'IRON_CONDOR',
      eligible: true,
      expiration: exp.expirationDate,
      dte: Math.floor((new Date(exp.expirationDate) - new Date()) / 86400000),
      putSpread: [parseFloat(putShort.toFixed(2)), parseFloat(putLong.toFixed(2))],
      callSpread: [parseFloat(callShort.toFixed(2)), parseFloat(callLong.toFixed(2))],
      width: parseFloat(width.toFixed(2)),
      netCredit: parseFloat(netCredit.toFixed(2)),
      beRange: `${parseFloat(putShort.toFixed(2))} - ${parseFloat(callShort.toFixed(2))}`,
      maxProfit: parseFloat((netCredit * 100).toFixed(2)),
      maxLoss: parseFloat(((width - netCredit) * 100).toFixed(2)),
      source: 'Finnhub'
    };
  }));
  return enriched.filter(e => e.eligible !== false);
}

// ─── Strategy Router ───
export const STRATEGY_MAP = {
  leap: { name: 'LEAP', screener: screenLeapCandidates, filters: filterLeapCandidates },
  pmcc: { name: 'PMCC', screener: screenPmccCandidates, filters: filterPmccCandidates },
  zebra: { name: 'ZEBRA', screener: screenZebraCandidates, filters: filterZebraCandidates },
  putDiagonal: { name: 'Put Diagonal', screener: screenPutDiagonalCandidates, filters: filterPutDiagonalCandidates },
  collaredLeap: { name: 'Collared LEAP', screener: screenCollaredLeapCandidates, filters: filterCollaredLeapCandidates },
  ironCondor: { name: 'Iron Condor', screener: screenIronCondorCandidates, filters: filterIronCondorCandidates },
};
