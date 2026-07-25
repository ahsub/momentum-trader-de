# Phase 6 Konzept: Portfolio-Tracking & KI-Trade-Analyse
## CapTrader/IBKR Integration

---

## 1. Datenquellen

### 1.1 Flex Query (empfohlen für Historie)
- **Location**: CapTrader/IB Client Portal → Performance & Reports → Flex Queries
- **Format**: CSV oder XML
- **Inhalt**: Trades, Option Exercises, Cash Transactions, Dividenden
- **Limit**: Max 1 Jahr pro Export (für Juni 2023 bis heute: ~3 Exporte nötig)
- **Automatisierung**: Möglich via Flex Web Service Token + Query ID

### 1.2 IB API (empfohlen für Echtzeit)
- **Real-time**: Positionen, Kontostand, Margin
- **Sprachen**: Java, C#, C++, Python (via ib_insync)
- **Limit**: Keine historischen Daten, nur aktuelle Positionen

### 1.3 Activity Statement (manuell)
- **Einfachster Einstieg**: Einmaliger CSV-Export
- **Periode**: Custom (Juni 2023 – heute)

---

## 2. Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPTRADER / IBKR                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Flex Query   │  │ IB API       │  │ Activity Statement   │  │
│  │ (historisch) │  │ (echtzeit)   │  │ (manuell CSV)        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼────────────────┼─────────────────────┼──────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              DATA NORMALIZATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Unified Trade Schema:                                   │    │
│  │  - tradeId, date, symbol, type (BUY/SELL/ASSIGN/EXPIRE) │    │
│  │  - quantity, price, premium, strike, expiry, strategy    │    │
│  │  - commission, fees, realizedPnl, status (OPEN/CLOSED) │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              ANALYSIS ENGINE                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐│
│  │ Position    │ │ P&L         │ │ Greeks      │ │ Risk     ││
│  │ Tracker     │ │ Calculator  │ │ Aggregator  │ │ Monitor  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘│
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              KI-EMPFEHLUNGSENGINE                               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Regeln + Kontext:                                         │    │
│  │  - Snapshot-Regime (BULL_QUIET etc.)                     │    │
│  │  - Portfolio-Greeks (Delta, Theta, Vega)                 │    │
│  │  - Konzentrationsrisiko                                  │    │
│  │  - Korrelation zwischen Positionen                       │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              UI COMPONENTS                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐   │
│  │ Portfolio    │ │ Trade Detail │ │ KI-Advisor           │   │
│  │ Dashboard    │ │ Panel        │ │ (Empfehlungen)       │   │
│  └──────────────┘ └──────────────┘ └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Datenmodell

### 3.1 Trade-Schema (unifiziert)
```typescript
interface Trade {
  id: string;                    // Unique trade ID
  date: string;                  // ISO date
  symbol: string;                // Underlying (AAPL, SPY, etc.)
  assetClass: 'STOCK' | 'OPTION' | 'ETF';

  // Direction
  side: 'BUY' | 'SELL';

  // For stocks
  quantity: number;
  price: number;

  // For options
  optionType?: 'CALL' | 'PUT';
  strike?: number;
  expiry?: string;
  premium?: number;

  // Strategy tagging
  strategy?: 'COVERED_CALL' | 'CASH_SECURED_PUT' | 'IRON_CONDOR' | 'WHEEL' | 'SINGLE';

  // P&L
  commission: number;
  fees: number;
  realizedPnl?: number;         // Only for closed trades

  // Status
  status: 'OPEN' | 'CLOSED' | 'ASSIGNED' | 'EXPIRED';

  // Metadata
  broker: 'CAPTRADER';
  accountId: string;
  tags?: string[];               // User-defined tags
}
```

### 3.2 Position-Schema (aggregiert)
```typescript
interface Position {
  symbol: string;
  underlying: string;

  // Net position
  netQuantity: number;           // +long, -short
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;

  // For options
  optionType?: 'CALL' | 'PUT';
  strike?: number;
  expiry?: string;
  daysToExpiry: number;

  // Greeks (aggregiert)
  delta: number;
  gamma: number;
  theta: number;
  vega: number;

  // Risk metrics
  maxLoss: number;               // For defined-risk strategies
  maxProfit: number;
  breakeven: number[];

  // Status
  isOpen: boolean;
  strategy: string;

  // Related trades
  openingTrades: Trade[];
  closingTrades: Trade[];
}
```

### 3.3 Portfolio-Summary
```typescript
interface PortfolioSummary {
  // Values
  totalValue: number;
  cashBalance: number;
  investedValue: number;

  // P&L
  realizedPnlYtd: number;
  unrealizedPnl: number;
  totalReturnYtd: number;
  totalReturnPercent: number;

  // Greeks (portfolio-level)
  portfolioDelta: number;
  portfolioTheta: number;
  portfolioVega: number;

  // Risk
  betaWeightedDelta: number;     // SPY-equivalent delta
  maxPortfolioRisk: number;      // Worst-case scenario
  concentrationRisk: number;     // % in largest position

  // Allocation
  cashPercent: number;
  stockPercent: number;
  optionPercent: number;

  // Trade stats
  totalTradesYtd: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}
```

---

## 4. KI-Empfehlungsengine

### 4.1 Regel-Engine (deterministisch)
```
RULE 1: Delta-Neutralität
  IF portfolioDelta > +500 (bullish bias)
  THEN Empfehlung: "Delta zu hoch für BEAR_VOLATILE/CRISIS. 
       Consider: Add puts, reduce long stock, or sell calls."

RULE 2: Theta-Decay-Optimierung
  IF DTE < 14 AND theta < -50 (high decay)
  THEN Empfehlung: "Option nächst an Verfall. Roll auf 30-45 DTE 
       oder schließe Position."

RULE 3: Konzentrationsrisiko
  IF singlePosition > 20% portfolio
  THEN Empfehlung: "Konzentration zu hoch. Diversifiziere oder 
       reduziere Position."

RULE 4: Regime-Alignment
  IF regime == CRISIS AND netDelta > 0
  THEN Empfehlung: "🔴 CRISIS aktiv. Portfolio ist net-long. 
       Sofortige Reduktion empfohlen."

RULE 5: Assignment-Risiko
  IF shortPut AND underlyingPrice < strike * 0.98
  THEN Empfehlung: "Assignment-Risiko steigt. Roll down/out 
       oder akzeptiere Assignment (Wheel-Strategie)."

RULE 6: Earnings-Risiko
  IF earningsDate < 7 Tage AND shortOption
  THEN Empfehlung: "Earnings in {n} Tagen. IV-Crush-Risiko. 
       Schließe vor Earnings oder hedge."

RULE 7: VIX-Adjustment
  IF vixPercentile > 80 AND shortVega > 1000
  THEN Empfehlung: "VIX extrem hoch. Short-Vega-Exposure gefährlich. 
       Reduziere oder hedge mit long Vega."
```

### 4.2 Kontext-basierte Empfehlungen
Die Engine kombiniert:
- **Markt-Regime** (aus Phase 5)
- **Portfolio-Greeks** (Delta, Theta, Vega)
- **Positions-Details** (DTE, Strike-Distanz, Strategy)
- **Historische Performance** (Win Rate, Profit Factor)
- **Risiko-Metriken** (Konzentration, Max Loss)

### 4.3 Empfehlungs-Priorisierung
```typescript
interface Recommendation {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'RISK' | 'OPPORTUNITY' | 'OPTIMIZATION';
  symbol?: string;
  title: string;
  description: string;
  action: string;              // Konkrete Handlungsempfehlung
  impact: string;              // Erwarteter Impact

  // Context
  triggeredBy: string[];       // Welche Regeln haben das ausgelöst
  regimeContext: string;       // Aktuelles Regime

  // Optional: AI-generated insight
  aiInsight?: string;
}
```

---

## 5. UI-Komponenten

### 5.1 PortfolioDashboard.jsx
- Portfolio-Zusammenfassung (Wert, P&L, Cash)
- Asset-Allocation-Donut-Chart
- Greeks-Bars (Delta, Theta, Vega)
- Offene Positionen-Tabelle
- KI-Empfehlungen-Panel

### 5.2 PositionDetailPanel.jsx
- Einzelposition mit allen Metriken
- P&L-Chart (historisch)
- Greeks-Visualisierung
- Verwandte Trades (Opening/Closing)
- KI-Empfehlung für diese Position

### 5.3 TradeHistoryPanel.jsx
- Alle Trades seit Juni 2023
- Filter: Symbol, Strategy, Status, Zeitraum
- Aggregierte Stats pro Strategy
- Export-Funktion

### 5.4 KIAdvisorPanel.jsx
- Priorisierte Empfehlungsliste
- "Warum?"-Erklärung pro Empfehlung
- One-Click-Aktionen (z.B. "Roll Position")
- Historische Empfehlungs-Performance

### 5.5 ImportWizard.jsx
- Schritt 1: Datenquelle wählen (Flex Query / API / CSV)
- Schritt 2: Datei hochladen / API-Token eingeben
- Schritt 3: Mapping-Validierung (Spalten zuordnen)
- Schritt 4: Vorschau & Import
- Schritt 5: Ergebnis-Zusammenfassung

---

## 6. Implementierungs-Plan

### Phase 6a: Daten-Import (1-2 Sitzungen)
- [ ] CSV-Parser für IBKR Activity Statement
- [ ] Flex Query CSV-Parser
- [ ] Trade-Normalisierung (unified schema)
- [ ] Lokale Speicherung (IndexedDB oder JSON)
- [ ] Import-Wizard UI

### Phase 6b: Positions-Engine (1-2 Sitzungen)
- [ ] Trade → Position Aggregation
- [ ] Greeks-Berechnung (vereinfacht)
- [ ] P&L-Tracking (realized + unrealized)
- [ ] Portfolio-Summary-Berechnung

### Phase 6c: KI-Empfehlungen (1 Sitzung)
- [ ] Regel-Engine implementieren
- [ ] Integration mit Snapshot-Regime
- [ ] Empfehlungs-Priorisierung
- [ ] KIAdvisorPanel UI

### Phase 6d: Dashboard & Visualisierung (1 Sitzung)
- [ ] PortfolioDashboard
- [ ] PositionDetailPanel
- [ ] TradeHistoryPanel
- [ ] Charts (Recharts oder Chart.js)

### Phase 6e: Automatisierung (optional)
- [ ] Flex Query API-Integration
- [ ] Auto-Sync täglich
- [ ] Echtzeit-Positionen via IB API

---

## 7. Technische Details

### 7.1 CSV-Import-Format (IBKR Activity Statement)
Wichtige Spalten:
```
Symbol,Date/Time,Quantity,T. Price,Proceeds,Comm/Fee,
Realized P/L,Code,Buy/Sell,Strike,Expiry,Type
```

### 7.2 Option-Code-Interpretation
```
AAPL  240816C00230000
│     │││   ││
│     │││   │└─ Strike: 230.00
│     │││   └── Call/Put: C=Call
│     ││└──── Expiry: 240816 (YYMMDD)
│     │└───── Space
│     └────── Symbol: AAPL
└──────────── Underlying
```

### 7.3 Greeks-Berechnung (vereinfacht)
Für das Dashboard verwenden wir vereinfachte Greeks:
- **Delta**: ±0.5 für ATM, ±1.0 für deep ITM, 0 für OTM
- **Theta**: -Premium / DTE (täglicher Zeitwertverlust)
- **Vega**: Premium * 0.1 (Sensitivität für +1% VIX)
- **Gamma**: Konstant 0.05 für ATM, 0.01 für OTM

Für präzise Greeks: Integration mit einer Options-Pricing-Library (z.B. `black-scholes` npm package).

---

## 8. Beispiel-Workflow

### Szenario: Nutzer importiert historische Trades

1. **Import**: Nutzer lädt 3 CSV-Dateien hoch (2023, 2024, 2025)
2. **Parsing**: System extrahiert 847 Trades (312 Optionen, 535 Aktien)
3. **Normalisierung**: Trades werden in unified schema transformiert
4. **Aggregation**: 47 offene Positionen, 800 geschlossene Trades
5. **Analyse**: 
   - Portfolio-Delta: +1,250 (bullish)
   - Portfolio-Theta: -$45/Tag
   - Konzentration: 28% in NVDA
   - Win Rate: 68% (Options), 72% (Stocks)
6. **KI-Empfehlungen**:
   - 🔴 CRITICAL: "NVDA-Konzentration 28%. Reduziere auf <15%"
   - 🟡 HIGH: "3 Short-Puts nächst an Verfall (DTE < 7). Roll empfohlen"
   - 🟢 MEDIUM: "Portfolio net-long in BULL_QUIET. Optimal aligniert"

---

## 9. Sicherheit & Privacy

- **Lokale Speicherung**: Alle Portfolio-Daten bleiben im Browser (IndexedDB)
- **Kein Server**: Keine Daten werden an externe Server gesendet
- **API-Tokens**: Flex Query Token wird verschlüsselt in localStorage gespeichert
- **Read-only**: Flex Queries sind read-only, keine Trade-Ausführung möglich

---

## 10. Nächste Schritte

1. **Bestätigung**: Soll ich Phase 6 implementieren?
2. **Daten**: Hast du bereits IBKR/CapTrader Flex Query-Exporte?
3. **Scope**: Soll ich mit CSV-Import starten oder direkt API-Integration?
4. **Priorität**: Welche Features sind am wichtigsten?
   - (a) Historische Trade-Analyse
   - (b) Echtzeit-Positions-Tracking
   - (c) KI-Empfehlungen
   - (d) Alle gleichzeitig
