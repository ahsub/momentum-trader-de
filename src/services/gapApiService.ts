// ============================================
// Gap API Service - Twelvedata → Finnhub → Fallback
// ============================================

import type { GapData, GapFilterConfig, AlertLevel, MarketRegime } from '../types';

const TWELVEDATA_KEY = import.meta.env.VITE_TWELVEDATA_KEY || '';
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || '';

// Mock-Daten als Fallback (nur wenn APIs failen)
const MOCK_GAPS: GapData[] = [
  { ticker: 'NVDA', prevClose: 875.30, preMarketOpen: 912.00, gapPct: 4.2, gapDirection: 'UP', preMarketVolume: 2500000, avgVolume20d: 45000000, volumeRatio: 3.5, atr14: 12.5, regime: 'BULL_QUIET', setupScore: 85, alertLevel: 'BREAKOUT', timestamp: new Date().toISOString(), source: 'Mock' },
  { ticker: 'AMD', prevClose: 145.20, preMarketOpen: 150.80, gapPct: 3.8, gapDirection: 'UP', preMarketVolume: 1800000, avgVolume20d: 32000000, volumeRatio: 3.2, atr14: 3.8, regime: 'BULL_QUIET', setupScore: 78, alertLevel: 'ALERT', timestamp: new Date().toISOString(), source: 'Mock' },
  { ticker: 'META', prevClose: 485.10, preMarketOpen: 501.50, gapPct: 3.5, gapDirection: 'UP', preMarketVolume: 1200000, avgVolume20d: 28000000, volumeRatio: 2.8, atr14: 8.2, regime: 'BULL_QUIET', setupScore: 72, alertLevel: 'ALERT', timestamp: new Date().toISOString(), source: 'Mock' },
];

async function fetchTwelvedata(ticker: string): Promise<GapData | null> {
  if (!TWELVEDATA_KEY) return null;

  try {
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${TWELVEDATA_KEY}`
    );
    const data = await response.json();

    if (data.status === 'error') {
      console.warn(`Twelvedata error for ${ticker}:`, data.message);
      return null;
    }

    const prevClose = parseFloat(data.previous_close);
    const current = parseFloat(data.close) || parseFloat(data.open);
    const gapPct = ((current - prevClose) / prevClose) * 100;

    return {
      ticker: data.symbol,
      prevClose,
      preMarketOpen: current,
      gapPct: Math.abs(gapPct),
      gapDirection: gapPct >= 0 ? 'UP' : 'DOWN',
      preMarketVolume: parseInt(data.volume) || 0,
      avgVolume20d: parseInt(data.average_volume) || 0,
      volumeRatio: parseInt(data.volume) / (parseInt(data.average_volume) || 1),
      atr14: 0,
      regime: 'BULL_QUIET',
      setupScore: 0,
      alertLevel: 'INFO',
      timestamp: new Date().toISOString(),
      source: 'Twelvedata',
    };
  } catch (err) {
    console.error(`Twelvedata fetch failed for ${ticker}:`, err);
    return null;
  }
}

async function fetchFinnhub(ticker: string): Promise<GapData | null> {
  if (!FINNHUB_KEY) return null;

  try {
    const quoteResponse = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`
    );
    const quote = await quoteResponse.json();

    if (!quote.c) {
      console.warn(`Finnhub no data for ${ticker}`);
      return null;
    }

    const prevClose = quote.pc;
    const current = quote.c || quote.o;
    const gapPct = ((current - prevClose) / prevClose) * 100;

    return {
      ticker: ticker.toUpperCase(),
      prevClose,
      preMarketOpen: current,
      gapPct: Math.abs(gapPct),
      gapDirection: gapPct >= 0 ? 'UP' : 'DOWN',
      preMarketVolume: 0,
      avgVolume20d: 0,
      volumeRatio: 0,
      atr14: 0,
      regime: 'BULL_QUIET',
      setupScore: 0,
      alertLevel: 'INFO',
      timestamp: new Date().toISOString(),
      source: 'Finnhub',
    };
  } catch (err) {
    console.error(`Finnhub fetch failed for ${ticker}:`, err);
    return null;
  }
}

function calculateSetupScore(gap: GapData): number {
  let score = 0;
  score += Math.min(gap.gapPct * 6, 30);
  score += Math.min(gap.volumeRatio * 12.5, 25);
  if (gap.regime === 'BULL_QUIET') score += 20;
  else if (gap.regime === 'BULL_VOLATILE') score += 15;
  const atrPct = (gap.atr14 / gap.prevClose) * 100;
  if (atrPct < 2) score += 15;
  else if (atrPct < 3) score += 10;
  else if (atrPct < 5) score += 5;
  if (gap.gapDirection === 'UP') score += 10;
  return Math.min(score, 100);
}

function determineAlertLevel(score: number, gapPct: number): AlertLevel {
  if (score >= 85 && gapPct >= 5) return 'BREAKOUT';
  if (score >= 70) return 'ALERT';
  if (score >= 50) return 'WATCH';
  return 'INFO';
}

export async function fetchGapData(ticker: string): Promise<GapData | null> {
  console.log(`Fetching gap data for ${ticker}...`);

  const td = await fetchTwelvedata(ticker);
  if (td) {
    td.setupScore = calculateSetupScore(td);
    td.alertLevel = determineAlertLevel(td.setupScore, td.gapPct);
    console.log(`✅ Twelvedata success for ${ticker}:`, td.gapPct.toFixed(1) + '%');
    return td;
  }

  const fh = await fetchFinnhub(ticker);
  if (fh) {
    fh.setupScore = calculateSetupScore(fh);
    fh.alertLevel = determineAlertLevel(fh.setupScore, fh.gapPct);
    console.log(`✅ Finnhub success for ${ticker}:`, fh.gapPct.toFixed(1) + '%');
    return fh;
  }

  console.error(`❌ All APIs failed for ${ticker}`);
  return null;
}

export async function scanAllGaps(tickers: string[]): Promise<GapData[]> {
  const gaps: GapData[] = [];

  for (const ticker of tickers) {
    const result = await fetchGapData(ticker);
    if (result) gaps.push(result);
    await new Promise(r => setTimeout(r, 1000)); // Rate-Limit
  }

  return gaps;
}

export function getMockGaps(): GapData[] {
  return MOCK_GAPS.map(g => ({ ...g, timestamp: new Date().toISOString() }));
}

export function filterGaps(gaps: GapData[], filter: GapFilterConfig): GapData[] {
  return gaps
    .filter(g => {
      if (Math.abs(g.gapPct) < filter.minGapPct) return false;
      if (Math.abs(g.gapPct) > filter.maxGapPct) return false;
      if (g.avgVolume20d < filter.minAvgVolume && g.avgVolume20d > 0) return false;
      const atrPct = (g.atr14 / g.prevClose) * 100;
      if (atrPct > filter.maxAtrPct && atrPct > 0) return false;
      if (filter.onlyLong && g.gapDirection === 'DOWN') return false;
      return true;
    })
    .sort((a, b) => b.setupScore - a.setupScore);
}
