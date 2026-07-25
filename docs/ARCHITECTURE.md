# Momentum Trader Pro - Architektur

## Versionen
- **v1.0.0** (Baseline): Reiner Client-Side-Rechner, manuelle Inputs
- **v2.0.0** (Ziel): API-Integration, McmStore v3.0, Snapshot-Reader

## Tech Stack
- React 19 + Vite 6
- Tailwind CSS 4
- Recharts (Charts)
- Framer Motion (Animationen)

## Verzeichnisstruktur (Ziel)
```
src/
├── components/          # UI-Komponenten
│   ├── panels/         # Haupt-Panels (Momentum, Trend, ORB)
│   ├── scanner/        # GapScanner, PreMarketScanner
│   └── shared/         # Wiederverwendbare Komponenten
├── services/           # API-Services
│   ├── gapApiService.ts
│   ├── marketDataService.ts
│   └── snapshotReader.ts
├── hooks/              # Custom React Hooks
│   ├── useMarketData.ts
│   ├── usePortfolio.ts
│   └── useAlerts.ts
├── store/              # State Management (McmStore v3.0)
│   ├── McmStore.ts
│   ├── regimeSlice.ts
│   └── riskSlice.ts
├── types/              # TypeScript-Typen
│   └── index.ts
├── utils/              # Hilfsfunktionen
│   ├── calculations.ts
│   └── formatters.ts
└── tests/              # Test-Framework
    ├── unit/
    └── integration/
```

## Module

### McmStore v3.0
- Regime-Erkennung (Bull Quiet, Bull Volatile, Bear, Crisis)
- Risk Score (< 60 = tradable)
- Circuit Breaker (MOVE-Index, VIX)
- Position Sizing (Bullish: 100%, Volatile: 30%, Crisis: 0%)

### Scanner
- **GapScanner**: Pre-Market Gaps (>2%), Volume-Profile
- **MomentumScanner**: EMA-Cross, RSI, ADX
- **PreMarketScanner**: VWAP, Key Levels vor 9:30

### QuickWin Engine
- One-Tap Execution
- Auto-Expiry (30min)
- Push-Alerts (Critical > High > Medium)
