# Changelog

## [Unreleased] - v2.0.0
### Added
- **GapScanner**: Pre-Market Gap Scanner mit echten APIs
  - Twelvedata Batch-Requests (8 Symbole/Call)
  - Finnhub Fallback für fehlende Tickers
  - Rate-Limiting (8s Pause zwischen Calls)
  - StrictMode-Safe (useRef Guard)
  - Filter-Panel (Min/Max Gap, Volume, Only Long)
  - Alert Levels (BREAKOUT, ALERT, WATCH, INFO)
  - Visual Gap Cards mit Color Coding
- **API Integration**: Twelvedata & Finnhub Keys in .env.local
- **gapApiService.jsx**: Unified Batch API Service

### Fixed
- Rate-Limiting: Twelvedata Free Plan (8 Credits/Min)
- StrictMode: Doppelte API-Calls verhindert
- Batch-Requests: Mehrere Symbole pro API-Call

## [1.0.0] - 2026-07-21
### Baseline
- MomentumPanel: KO-Rechner, Volatilitäts-Matrix
- TrendPanel: ATR-Stops, Teilgewinn-Planer, Trailing-Stop
- OrbPanel: ORB-Strategie, deutscher Tagesablauf (Xetra 09:00)
- WatchlistPanel: Statische Mock-Daten (TSLA, NVDA, PLTR)
- Tech: React 19 + Vite 6 + Tailwind CSS 4
