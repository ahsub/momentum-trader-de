# Snapshot-Reader System

Automated market regime detection and risk scoring for momentum-trader-de.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Yahoo Finance  │────▶│ generate-snapshot │────▶│  public/data/   │
│   (5 tickers)   │     │   (Node.js)      │     │  snapshots/     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                              ┌───────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  useSnapshotReader │
                    │   (React Hook)   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  SnapshotPanel   │
                    │  RegimeAutoBadge │
                    │  RiskScoreBar    │
                    └──────────────────┘
```

## Data Sources

| Indicator | Ticker | Period | Usage |
|-----------|--------|--------|-------|
| VIX | `^VIX` | 3mo | Volatility, regime input |
| S&P 500 | `^GSPC` | 1y | Trend (MA50, MA200) |
| NYSE Composite | `^NYA` | 3mo | Market breadth proxy |
| 10Y Treasury | `^TNX` | 3mo | Interest rate stress |
| DXY | `DX-Y.NYB` | 3mo | Dollar strength |

## Regime Logic

```
CRISIS:        VIX > 30 AND SPX < MA200
BEAR_VOLATILE: VIX > 25 OR NYA < -2%
BULL_QUIET:    VIX < 15 AND SPX > MA50 > MA200
BULL_VOLATILE: VIX > 20 AND SPX > MA200
BEAR_QUIET:    SPX < MA200 (default bear)
BULL_QUIET:    fallback
```

## Risk Score Matrix

| Regime | VIX %ile | Score | Level |
|--------|----------|-------|-------|
| BULL_QUIET | <30 | 5 | Low |
| BULL_QUIET | 30-50 | 20 | Low |
| BULL_QUIET | >50 | 30 | Moderate |
| BULL_VOLATILE | <50 | 45 | Moderate |
| BULL_VOLATILE | >50 | 60 | Elevated |
| BEAR_QUIET | any | 75 | High |
| BEAR_VOLATILE | any | 85 | High |
| CRISIS | any | 95 | Extreme |

## Usage

### Manual snapshot generation
```bash
npm run snapshot              # today's snapshot
npm run snapshot:date 2026-07-23  # specific date
```

### Local testing
```bash
node scripts/test-snapshot.js
```

### GitHub Action
Runs automatically at 6:30 AM ET, Monday-Friday.
Manual trigger via Actions tab with optional date parameter.

## Files

| File | Description |
|------|-------------|
| `scripts/generate-snapshot.js` | Main generator script |
| `scripts/test-snapshot.js` | Validation tests |
| `.github/workflows/daily-snapshot.yml` | CI/CD automation |
| `src/utils/regimeCalculator.js` | Pure regime logic |
| `src/utils/riskCalculator.js` | Pure risk scoring |
| `src/hooks/useSnapshotReader.js` | React data hook |
| `src/hooks/useMarketData.js` | Real-time data hook |
| `src/components/SnapshotPanel.jsx` | Main UI panel |
| `src/components/RegimeAutoBadge.jsx` | Auto regime badge |
