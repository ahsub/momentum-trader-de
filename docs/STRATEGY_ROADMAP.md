# 🎯 Options-Strategie-Roadmap — Momentum-Trader-DE

**Projekt:** momentum-trader-de  
**Branch:** develop  
**Version:** v2.2.0 (geplant)  
**Letzte Aktualisierung:** 25. Juli 2026

---

## 📋 Übersicht

Dieses Dokument definiert die geplanten Options-Trading-Strategien für das Momentum-Trader-DE Projekt. Es dient als zentrale Planungs- und Orientierungsgrundlage für alle zukünftigen Entwicklungsschritte.

---

## 🏗️ Die fünf Säulen des Options-Desks

| # | Strategie | Marktrichtung | Kapital-Effizienz | Wartungsaufwand | Status |
|---|-----------|---------------|-------------------|-----------------|--------|
| 1 | **Long LEAP Call** | Stark bullisch | ⭐⭐⭐⭐⭐ | Niedrig | 🟡 Geplant |
| 2 | **PMCC** | Moderat bullisch / Seitwärts | ⭐⭐⭐⭐ | Hoch | 🟡 Geplant |
| 3 | **ZEBRA** | Bullisch (kein Theta-Risiko) | ⭐⭐⭐⭐⭐ | Niedrig | 🟢 Konzept |
| 4 | **Put Diagonal Spread** | Bärisch / Hedge | ⭐⭐⭐⭐ | Hoch | 🟢 Konzept |
| 5 | **Collared LEAP** | Bullisch mit Schutz | ⭐⭐⭐ | Mittel | 🔵 Idee |

---

## 1️⃣ Long LEAP Call (Stock Replacement)

### Ziel
Kapitaleffizienter Ersatz für den Direktkauf von Aktien mit begrenztem Verlustrisiko.

### Entry-Kriterien
| Metrik | Zielwert | Warum |
|--------|----------|-------|
| Delta | 0.80–0.90 | Deep ITM = hohe Aktienkorrelation |
| DTE | 300–540+ Tage | Langfristiger Hebel |
| IV Rank | < 30% | Günstiger Einstieg, IV-Crush-Schutz |
| Extrinsic Value | < 20% des Preises | Minimaler Zeitwertverfall |
| Trend | Kurs > EMA200, SMA50 > SMA200 | Bestätigter Aufwärtstrend |
| RSI(14) | 45–62 | Nicht überkauft |

### Management-Regeln
```
IF DTE <= 90          → Alert: "ROLL WINDOW OPEN"
IF Delta >= 0.95      → Alert: "DELTA SATURATION — CONSIDER ROLL UP"
IF Delta <= 0.65      → Alert: "DELTA WEAKNESS — REVIEW THESIS"
IF IV Rank spikes >50% → Alert: "IV CRUSH RISK — MONITOR VEGA"
```

### UIQ-Datennutzung
- **Pre-Screen:** KO-Aggregator Composite Score > 70, Kurs > EMA200
- **Enrichment:** Finnhub Options-Chain für Delta/IV/DTE

---

## 2️⃣ Poor Man's Covered Call (PMCC)

### Ziel
Regelmäßiger Cashflow durch Short-Call-Verkauf gegen einen LEAP-Call.

### Die eiserne Setup-Regel
```
(Short Strike - Long Strike) - Net Debit > 0
```
> Wenn der Kurs stark steigt, muss der Spread-Gewinn den Netto-Einsatz übersteigen.

### Entry-Kriterien
| Komponente | Parameter |
|------------|-----------|
| Long Leg (LEAP) | DTE > 180–365, Delta 0.80–0.90 |
| Short Leg | DTE 30–45, Delta 0.20–0.30 |
| IV Term Structure | Short IV > Long IV (Contango nutzen) |
| Earnings Buffer | > 30 Tage bis nächste Earnings |

### Management-Workflow
```
SHORT LEG:
├── 50% Profit reached?     → Close & Sell next month
├── 10–14 DTE?              → Close & Sell next month
├── Kurs nähert Short Strike? → Roll Up & Out (für Net Credit)
└── ITM bei Expiration?     → Roll or Accept Assignment

LONG LEG:
├── DTE <= 90?              → Roll Out (gleicher Strike, +365 DTE)
├── Delta >= 0.95?          → Roll Up & Out (höherer Strike, +365 DTE)
└── Delta <= 0.65?          → Close Position (Thesis invalidiert)
```

### Metriken
| Metrik | Formel |
|--------|--------|
| Width Rule Check | (ShortStrike - LongStrike) - NetDebit |
| Annualized Cash-on-Cash | (ShortPremium / NetDebit) × (365 / ShortDTE) |
| Adjusted Cost Basis | NetDebit - Σ(Realisierte Short-Premium) |
| Max Loss | NetDebit × 100 |
| Max Profit | (ShortStrike - LongStrike - NetDebit) × 100 |

---

## 3️⃣ ZEBRA (Zero Extrinsic Backspread)

### Konzept
Kauf 2 ITM Calls (Delta ~0.70) + Verkauf 1 ATM Call (Delta ~0.50) = Net Delta ~0.90–1.00 bei **Theta ≈ 0**

> Der Clou: Zeitwerte heben sich auf. Du bezahlst nur inneren Wert, kein Zeitwertverfall.

### UIQ-Validator
```javascript
netDelta = (itmCall1.delta + itmCall2.delta) - atmCall.delta;  // >= 0.85
netTheta = (itmCall1.theta + itmCall2.theta) - atmCall.theta;  // ~0
netExtrinsic = (itmCall1.extrinsic + itmCall2.extrinsic) - atmCall.extrinsic; // < 0.05
```

### Wann einsetzen?
| IV Rank | Empfehlung |
|---------|-----------|
| < 20% | 🟢 ZEBRA Preferred (kein Theta-Risiko) |
| 20–40% | 🟡 Beide möglich |
| > 40% | 🔴 Keine Long-Strategien |

---

## 4️⃣ Put Diagonal Spread (Poor Man's Covered Put)

### Konzept
Das exakte Spiegelbild des PMCC für bärische Setups oder Portfolio-Hedges.

### Setup
| Komponente | Parameter |
|------------|-----------|
| Long Leg | Deep ITM Put LEAP (Delta ~-0.80) |
| Short Leg | OTM Put (30 DTE, Delta ~-0.20) |

### UIQ-Hedge-Integration
```javascript
hedgeRatio = (portfolioDelta × hedgeEfficiency) / (putDiagonalDelta × 100);
```

---

## 5️⃣ Collared LEAP (Capital Protection)

### Konzept
Long LEAP + Short OTM Call + Long OTM Put (finanziert durch Short Call).

### Konstruktion
```
Long LEAP Call (Delta 0.85)
├── Short OTM Call (Delta 0.20) → finanziert...
└── Long OTM Put (Delta -0.15)  → ...den Katastrophenschutz

Net Debit: Nahe 0 (Zero Debit Adjustment)
```

---

## 🏗️ Entwicklungs-Roadmap

### Phase 1: Options-Screener (v2.2.0-alpha)
**Zeitrahmen:** 2 Wochen  
**Ziel:** LEAP- und PMCC-Kandidaten finden

```
Neue Dateien:
├── src/services/optionsScreener.js      # Filter-Logik
├── src/components/OptionsScanner.jsx    # UI Panel
└── src/tests/optionsScreener.test.js    # Tests
```

**Features:**
- [ ] KO-Aggregator Data-Bridge (Pre-Screen)
- [ ] Finnhub/Twelvedata Options-Chain API
- [ ] Delta/IV/DTE-Filter (konfigurierbar)
- [ ] Width Rule Validator für PMCC

---

### Phase 2: Strategie-Konstruktor (v2.2.0-beta)
**Zeitrahmen:** 2 Wochen  
**Ziel:** PMCC, ZEBRA, LEAP validieren und simulieren

```
Neue Dateien:
├── src/services/strategyBuilder.js      # PMCC/ZEBRA/LEAP Validator
├── src/components/StrategyBuilder.jsx   # UI: Legs hinzufügen
├── src/components/StrategySimulator.jsx # Szenario A/B/C
└── src/tests/strategyBuilder.test.js
```

**Features:**
- [ ] Width Rule Check
- [ ] Max Profit / Max Loss / Break-Even
- [ ] Szenario-Simulation (+30%, -40%, Seitwärts)
- [ ] Recharts-Visualisierung

---

### Phase 3: Options-Portfolio-Integration (v2.2.0)
**Zeitrahmen:** 2 Wochen  
**Ziel:** Optionen im Portfolio tracken, Greeks aggregieren

**Erweiterungen:**
- [ ] `PortfolioPanel.jsx`: Optionen als Positionstyp
- [ ] `PositionGreeksCard.jsx`: Mehrere Legs anzeigen
- [ ] `GreeksBar.jsx`: Portfolio-Greeks inkl. Net-Exposure
- [ ] `portfolioStore.js`: `addOptionPosition()`, `calculateNetGreeks()`

---

### Phase 4: Roll-Manager & Alerts (v2.3.0)
**Zeitrahmen:** 2 Wochen  
**Ziel:** Automatische Erinnerungen für Management

```
Neue Dateien:
├── src/services/rollAdvisor.js          # Roll-Empfehlungen
├── src/components/RollManager.jsx       # UI
└── src/stores/alertStore.js             # Threshold Alerts
```

**Alert-Regeln:**
- [ ] DTE <= 90: "LEAP rollen"
- [ ] Short Leg 50% Profit: "Glattstellen"
- [ ] Delta >= 0.95: "Delta-Saturation"
- [ ] Earnings in < 30 Tagen: "Short Leg vor Earnings schließen"

---

## 🔗 KO-Aggregator Integration

### Daten-Brücke
| ko-aggregator Feld | Options-Relevanz | Filter-Logik |
|-------------------|-------------------|--------------|
| Composite Score | Qualitätsfilter | > 70 für LEAP/PMCC |
| EMA(20/50/200) | Trend-Bestätigung | Kurs > EMA200 |
| RSI(14) | Entry-Timing | 45–62 (nicht überkauft) |
| HVP | Volatilitäts-Proxy | < 40% |
| Markov-Regime | Marktphase | Bull-Quiet = 🟢 |
| ATR(14) | Stop-Loss | 2× ATR für Positionen |

### API-Endpoints
```
Cloudflare KV (empfohlen):
https://ko-sync.ahildebrand.workers.dev/public/master_market_data

GitHub Backup (Fallback):
https://raw.githubusercontent.com/ahsub/ko-aggregator/main/backups/tr_backup_latest.json
```

---

## 📊 UI-Dashboard-Konzept

### Panel: Strategy Scanner
```
┌─────────────────────────────────────────────────────────────┐
│  OPTIONS SCANNER                        [VIX: 18.5 | 🟡]   │
├─────────────────────────────────────────────────────────────┤
│  Filter: [LEAP ▼] [Score >70 ▼] [RSI 45-62 ▼] [RUN]     │
├─────────────────────────────────────────────────────────────┤
│  SYMBOL    PRICE    IV RANK    DELTA    STRATEGY    SCORE │
│  AAPL      225.50   22%        0.87     PMCC         94   │
│  MSFT      425.10   18%        0.85     ZEBRA        91   │
│  JPM       245.80   15%        0.88     LEAP         89   │
└─────────────────────────────────────────────────────────────┘
```

### Panel: Position Management
```
┌─────────────────────────────────────────────────────────────┐
│  ACTIVE OPTIONS                                           │
├─────────────────────────────────────────────────────────────┤
│  AAPL PMCC (Aug)                                          │
│  ├─ Long: 80C @ 25.00 (DTE: 340, Δ: 0.87)               │
│  ├─ Short: 105C @ 2.00 (DTE: 28, Δ: 0.25)                │
│  ├─ Net Debit: 23.00 | Width Rule: ✅                     │
│  ├─ Theta/day: +0.15 | Annualized: 34%                    │
│  └─ Alert: Short 50% profit → [ROLL NOW]                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Nächste Schritte

1. **Data-Bridge bauen:** `koAggregatorBridge.js` für Pre-Screen
2. **Screener-Panel:** `OptionsScanner.jsx` als neuer Tab
3. **API-Integration:** Finnhub Options-Chain für Enrichment
4. **Tests:** 10+ Test-Cases für Filter-Logik

---

*Dieses Dokument lebt — bei jeder Strategie-Entscheidung oder Architektur-Änderung aktualisieren.*
