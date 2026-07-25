// ============================================
// Gap API Service Unit Tests v2
// ============================================

import { describe, it, expect } from 'vitest'
import { filterGaps, getMockGaps, scanAllGaps } from '../../services/gapApiService.jsx'

const DEFAULT_GAP_FILTER = {
  minGapPct: 2,
  maxGapPct: 15,
  minAvgVolume: 500000,
  maxAtrPct: 5,
  onlyLong: false,
}

describe('Gap API Service v2', () => {
  it('sollte Mock-Daten zurückgeben', () => {
    const gaps = getMockGaps()
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps[0].ticker).toBeDefined()
  })

  it('sollte Gaps nach Gap-Größe filtern', () => {
    const gaps = getMockGaps()
    const filtered = filterGaps(gaps, { ...DEFAULT_GAP_FILTER, minGapPct: 4 })
    expect(filtered.every(g => g.gapPct >= 4)).toBe(true)
  })

  it('sollte Gaps nach Richtung filtern', () => {
    const gaps = getMockGaps()
    const filtered = filterGaps(gaps, { ...DEFAULT_GAP_FILTER, onlyLong: true })
    expect(filtered.every(g => g.gapDirection === 'UP')).toBe(true)
  })

  it('sollte nach Setup-Score sortieren', () => {
    const gaps = getMockGaps()
    const filtered = filterGaps(gaps, DEFAULT_GAP_FILTER)
    for (let i = 1; i < filtered.length; i++) {
      expect(filtered[i - 1].setupScore).toBeGreaterThanOrEqual(filtered[i].setupScore)
    }
  })

  it('sollte Batch-Scan durchführen', async () => {
    const tickers = ['AAPL', 'TSLA']
    const gaps = await scanAllGaps(tickers)
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps[0].ticker).toBeDefined()
    expect(gaps[0].gapPct).toBeDefined()
  })
})
