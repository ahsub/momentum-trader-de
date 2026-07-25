# Übergabeprotokoll — momentum-trader-de
## Datum: 25. Juli 2026
## Version: v2.2.0-beta

---

## ✅ Heute Abgeschlossen

### 1. Options Scanner v2.2.0-alpha
- **KO-Aggregator Data-Bridge** (`src/services/koAggregatorBridge.js`)
  - Cloudflare KV Endpoint + GitHub Fallback
  - Pre-Screen Filter für LEAP (Score ≥70, RSI 45-62, HVP <40, Trend > EMA200)
  - Pre-Screen Filter für PMCC (Score ≥65, RSI 40-65, HVP <45)
- **Options Screener** (`src/services/optionsScreener.js`)
  - Finnhub API Integration (Options-Chain)
  - Mock-Fallback bei fehlendem API-Key
  - PMCC Width Rule Validator
- **OptionsScanner UI** (`src/components/OptionsScanner.jsx`)
  - LEAP / PMCC Tabs
  - Detail-Panel mit Delta, DTE, IV Rank, Extrinsic %
  - Width Rule Validierung (✅/❌)
- **Tests:** 117/117 grün

### 2. CapTrader Import v2.2.0-beta
- **XML Parser** (`src/services/capTraderParser.js`)
  - Parst Flex-Query XML (OpenPositions, Trades, EquitySummary)
  - Option-spezifische Felder (Strike, Expiration, Put/Call)
- **CapTraderImport UI** (`src/components/CapTraderImport.jsx`)
  - Drag & Drop XML Upload
  - Performance-Metriken (Win Rate, PnL, Profit Factor)
  - Import in PortfolioStore + TradeJournalStore
- **Tests:** 133/133 grün (inkl. CapTrader XML Parser Tests)

### 3. Steueranalyse v2.2.0-beta
- **Tax Parser** (`src/services/taxParser.js`)
  - CSV Kontoauszug Parser
  - Steuerkategorisierung (Dividende, Zinsen, Kursgewinn, Optionsprämie, Steuern, Gebühren)
  - EZB FX-Kurs Umrechnung (geschätzte Jahresdurchschnitte)
  - Jahresübersicht
- **Tax Rules** (`src/services/taxRules.js`)
  - DBA-Regeln (17 Länder)
  - Kirchensteuer (8% BW/BY, 9% andere BL)
  - Gemeinschaftskonto (50/50 Aufteilung, €2.000 Freibetrag)
  - Einzelkonto (€1.000 Freibetrag)
  - Nicht-deutscher Broker Hinweis (keine Abgeltungsteuer einbehalten)
- **TaxAnalysis UI** (`src/components/TaxAnalysis.jsx`)
  - Steuer-Einstellungen (Konto-Typ, Kirchensteuer, Personen)
  - Deutsche Steuerberechnung (Abgeltung + Soli + Kirchensteuer)
  - Kategorie-Übersicht
  - Erstattungsfristen-Warnung
- **Tax Export** (`src/services/taxExport.js`)
  - Druckbare Steuererläuterung als HTML
  - Tagesgenaue Transaktionsliste mit Wechselkursen
  - Kategorie-Summen
  - Hinweise für Anlage KAP

### 4. Bugfixes
- `portfolioStore.js`: Doppelte `isTestEnv` Deklaration entfernt
- `package.json`: `zustand` Dependency hinzugefügt
- `PaperModeToggle.jsx`: Shell-Befehl-Artifact entfernt
- `App.jsx`: `Receipt` → `FileText` Icon (lucide-react Kompatibilität)

### 5. Vercel Deploy
- `VITE_FINNHUB_KEY` in Environment Variables gesetzt
- Build erfolgreich
- App live: https://momentum-trader-de.vercel.app

---

## ⚠️ Bekannte Probleme / TODOs

1. **KO-Aggregator Endpoints offline**
   - Cloudflare KV: 404
   - GitHub Fallback: 404
   - Scanner läuft im Mock-Modus
   - **→ MORGEN REPARIEREN (Priorität 1)**

2. **Wechselkurse in Steueranalyse**
   - Aktuell geschätzte EZB-Jahresdurchschnitte
   - Sollten durch tagesgenaue EZB-Kurse ersetzt werden
   - **→ MORGEN (Priorität 2)**

3. **Finnhub Options-Chain**
   - Free-Tier liefert keine vollständigen Greeks
   - Delta/IV werden aus Strike-Abstand/HVP geschätzt
   - **→ Später: Premium Provider (Polygon.io)**

---

## 📁 Neue Dateien im Repo

```
src/services/koAggregatorBridge.js
src/services/optionsScreener.js
src/services/capTraderParser.js
src/services/taxParser.js
src/services/taxRules.js
src/services/taxExport.js
src/components/OptionsScanner.jsx
src/components/CapTraderImport.jsx
src/components/TaxAnalysis.jsx
src/__tests__/koAggregatorBridge.test.js
src/__tests__/optionsScreener.test.js
src/__tests__/capTraderParser.test.js
```

---

## 🔧 Tests

```
Test Files  14 passed (14)
Tests       133 passed (133)
```

---

## 🔑 API Keys (lokal in .env.local)

```
VITE_FINNHUB_KEY=d85nf39r01qitd92t67gd85nf39r01qitd92t680
```

Auch in Vercel Environment Variables gesetzt.

---

## 🚀 Git Status

```
main: 987ede3 (force redeploy) -> a45b0c4 (tax export) -> ...
Alle Commits auf origin/main gepusht
Lokal synchron mit origin/main
```

---

## 📋 Nächste Schritte (Morgen)

Siehe STRATEGY_ROADMAP.md

---

Erstellt: 25.07.2026 23:22
