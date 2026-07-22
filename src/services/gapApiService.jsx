// ============================================
// Gap API Service v4 - Finnhub Primary + Twelvedata Volume Fallback
// ============================================

const TWELVEDATA_KEY = import.meta.env.VITE_TWELVEDATA_KEY || ''
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || ''

// Twelvedata: Max 5 symbols per minute (Free Plan = 8 credits/min)
const TD_BATCH_SIZE = 5
const TD_RATE_LIMIT_MS = 12000 // 12s between Twelvedata calls

let lastTDCallTime = 0

async function tdRateLimit() {
  const now = Date.now()
  const timeSinceLastCall = now - lastTDCallTime
  if (timeSinceLastCall < TD_RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, TD_RATE_LIMIT_MS - timeSinceLastCall))
  }
  lastTDCallTime = Date.now()
}

// Mock-Daten als Fallback
const MOCK_GAPS = [
  { ticker: 'NVDA', prevClose: 875.30, preMarketOpen: 912.00, gapPct: 4.2, gapDirection: 'UP', preMarketVolume: 2500000, avgVolume20d: 45000000, volumeRatio: 3.5, atr14: 12.5, regime: 'BULL_QUIET', setupScore: 85, alertLevel: 'BREAKOUT', timestamp: new Date().toISOString(), source: 'Mock' },
  { ticker: 'AMD', prevClose: 145.20, preMarketOpen: 150.80, gapPct: 3.8, gapDirection: 'UP', preMarketVolume: 1800000, avgVolume20d: 32000000, volumeRatio: 3.2, atr14: 3.8, regime: 'BULL_QUIET', setupScore: 78, alertLevel: 'ALERT', timestamp: new Date().toISOString(), source: 'Mock' },
  { ticker: 'META', prevClose: 485.10, preMarketOpen: 501.50, gapPct: 3.5, gapDirection: 'UP', preMarketVolume: 1200000, avgVolume20d: 28000000, volumeRatio: 2.8, atr14: 8.2, regime: 'BULL_QUIET', setupScore: 72, alertLevel: 'ALERT', timestamp: new Date().toISOString(), source: 'Mock' },
]

// Finnhub: Primary source (no rate limit for basic quote)
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

// Twelvedata: Volume data only (max 5 symbols, rate limited)
async function fetchTwelvedataVolume(tickers) {
  if (!TWELVEDATA_KEY || tickers.length === 0) return {}

  await tdRateLimit()

  try {
    const symbols = tickers.slice(0, TD_BATCH_SIZE).join(',')
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${TWELVEDATA_KEY}`
    )
    const data = await response.json()

    if (data.status === 'error') {
      console.warn('Twelvedata volume error:', data.message)
      return {}
    }

    const results = Array.isArray(data) ? data : [data]
    const mapped = {}

    for (const item of results) {
      if (item.status === 'error') continue
      mapped[item.symbol] = {
        preMarketVolume: parseInt(item.volume) || 0,
        avgVolume20d: parseInt(item.average_volume) || 0,
        volumeRatio: parseInt(item.volume) / (parseInt(item.average_volume) || 1),
      }
    }

    return mapped
  } catch (err) {
    console.error('Twelvedata volume fetch failed:', err)
    return {}
  }
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

// Hauptfunktion: Finnhub Primary + Twelvedata Volume
export async function scanAllGaps(tickers) {
  console.log(`Starting scan for ${tickers.length} tickers...`)
  const gaps = []

  // 1. Finnhub: Alle Tickers (Primary Source, no rate limit)
  const finnhubResults = await fetchFinnhubBatch(tickers)

  // 2. Twelvedata: Volume für Top 5 (Rate Limited)
  const top5Tickers = Object.keys(finnhubResults).slice(0, TD_BATCH_SIZE)
  const volumeData = await fetchTwelvedataVolume(top5Tickers)

  // 3. Merge Daten
  for (const ticker of tickers) {
    const gap = finnhubResults[ticker]
    if (gap) {
      // Volume-Daten hinzufügen (falls verfügbar)
      const vol = volumeData[ticker]
      if (vol) {
        gap.preMarketVolume = vol.preMarketVolume
        gap.avgVolume20d = vol.avgVolume20d
        gap.volumeRatio = vol.volumeRatio
        gap.source = 'Finnhub+Twelvedata'
      }

      gap.setupScore = calculateSetupScore(gap)
      gap.alertLevel = determineAlertLevel(gap.setupScore, gap.gapPct)
      gaps.push(gap)
    }
  }

  // 4. Mock Fallback if nothing worked
  if (gaps.length === 0) {
    console.warn('All APIs failed, using mock data')
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
