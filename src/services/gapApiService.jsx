// ============================================
// Gap API Service v5 - Finnhub Only (No Twelvedata Rate-Limit Issues)
// ============================================

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || ''

// Mock-Daten als Fallback
const MOCK_GAPS = [
  { ticker: 'NVDA', prevClose: 875.30, preMarketOpen: 912.00, gapPct: 4.2, gapDirection: 'UP', preMarketVolume: 2500000, avgVolume20d: 45000000, volumeRatio: 3.5, atr14: 12.5, regime: 'BULL_QUIET', setupScore: 85, alertLevel: 'BREAKOUT', timestamp: new Date().toISOString(), source: 'Mock' },
  { ticker: 'AMD', prevClose: 145.20, preMarketOpen: 150.80, gapPct: 3.8, gapDirection: 'UP', preMarketVolume: 1800000, avgVolume20d: 32000000, volumeRatio: 3.2, atr14: 3.8, regime: 'BULL_QUIET', setupScore: 78, alertLevel: 'ALERT', timestamp: new Date().toISOString(), source: 'Mock' },
  { ticker: 'META', prevClose: 485.10, preMarketOpen: 501.50, gapPct: 3.5, gapDirection: 'UP', preMarketVolume: 1200000, avgVolume20d: 28000000, volumeRatio: 2.8, atr14: 8.2, regime: 'BULL_QUIET', setupScore: 72, alertLevel: 'ALERT', timestamp: new Date().toISOString(), source: 'Mock' },
]

// Finnhub: All tickers (no rate limit for basic quote)
async function fetchFinnhubBatch(tickers) {
  if (!FINNHUB_KEY || tickers.length === 0) return {}

  const results = {}

  for (const ticker of tickers) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`
      )
      const quote = await response.json()

      if (!quote.c) {
        console.warn(`Finnhub no data for ${ticker}`)
        continue
      }

      const prevClose = quote.pc
      const current = quote.c || quote.o
      const gapPct = ((current - prevClose) / prevClose) * 100

      results[ticker] = {
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
      }
    } catch (err) {
      console.error(`Finnhub fetch failed for ${ticker}:`, err)
    }
  }

  return results
}

function calculateSetupScore(gap) {
  let score = 0
  score += Math.min(gap.gapPct * 6, 30)
  score += Math.min(gap.volumeRatio * 12.5, 25)
  if (gap.regime === 'BULL_QUIET') score += 20
  else if (gap.regime === 'BULL_VOLATILE') score += 15
  const atrPct = (gap.atr14 / gap.prevClose) * 100
  if (atrPct < 2) score += 15
  else if (atrPct < 3) score += 10
  else if (atrPct < 5) score += 5
  if (gap.gapDirection === 'UP') score += 10
  return Math.min(score, 100)
}

function determineAlertLevel(score, gapPct) {
  if (score >= 85 && gapPct >= 5) return 'BREAKOUT'
  if (score >= 70) return 'ALERT'
  if (score >= 50) return 'WATCH'
  return 'INFO'
}

// Hauptfunktion: Finnhub Only
export async function scanAllGaps(tickers) {
  console.log(`Starting Finnhub scan for ${tickers.length} tickers...`)
  const gaps = []

  const finnhubResults = await fetchFinnhubBatch(tickers)

  for (const ticker of tickers) {
    const gap = finnhubResults[ticker]
    if (gap) {
      gap.setupScore = calculateSetupScore(gap)
      gap.alertLevel = determineAlertLevel(gap.setupScore, gap.gapPct)
      gaps.push(gap)
    }
  }

  // Mock Fallback if nothing worked
  if (gaps.length === 0) {
    console.warn('Finnhub failed, using mock data')
    gaps.push(...getMockGaps())
  }

  console.log(`Scan complete: ${gaps.length} gaps found`)
  return gaps
}

export function getMockGaps() {
  return MOCK_GAPS.map(g => ({ ...g, timestamp: new Date().toISOString() }))
}

export function filterGaps(gaps, filter) {
  return gaps
    .filter(g => {
      if (Math.abs(g.gapPct) < filter.minGapPct) return false
      if (Math.abs(g.gapPct) > filter.maxGapPct) return false
      if (g.avgVolume20d < filter.minAvgVolume && g.avgVolume20d > 0) return false
      const atrPct = (g.atr14 / g.prevClose) * 100
      if (atrPct > filter.maxAtrPct && atrPct > 0) return false
      if (filter.onlyLong && g.gapDirection === 'DOWN') return false
      return true
    })
    .sort((a, b) => b.setupScore - a.setupScore)
}

export const DEFAULT_GAP_FILTER = {
  minGapPct: 2,
  maxGapPct: 15,
  minAvgVolume: 500000,
  maxAtrPct: 5,
  onlyLong: false,
}
