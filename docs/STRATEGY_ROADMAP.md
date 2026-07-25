# STRATEGY_ROADMAP — momentum-trader-de

## Aktueller Stand: v2.2.0-beta (25.07.2026)

---

## Phase 1: Options Scanner ✅ (Abgeschlossen)
- KO-Aggregator Data-Bridge
- Finnhub Options-Chain Enrichment
- LEAP/PMCC Pre-Screen
- PMCC Width Rule Validator

## Phase 2: Portfolio & Trade Journal ✅ (Abgeschlossen)
- CapTrader Flex-Query XML Import
- Offene Positionen + historische Trades
- Performance-Metriken

## Phase 3: Steueranalyse ✅ (Abgeschlossen)
- CSV Kontoauszug Parser
- Steuerkategorisierung
- Kirchensteuer + Gemeinschaftskonto
- Druckbare Steuererläuterung (HTML/PDF)

---

## Phase 4: KO-Aggregator Reparatur 🚨 (MORGEN — Priorität 1)

### Problem
- Cloudflare KV Endpoint offline (404)
- GitHub Fallback offline (404)
- Scanner läuft nur im Mock-Modus

### Lösung
1. **Cloudflare Worker prüfen**
   - Endpoint: `https://ko-sync.ahildebrand.workers.dev/public/master_market_data`
   - CORS-Header erforderlich (`Access-Control-Allow-Origin: *`)
   - Prüfe Worker-Logs auf Fehler

2. **GitHub Fallback reparieren**
   - Repo: `github.com/ahsub/ko-aggregator`
   - Datei: `backups/tr_backup_latest.json`
   - Sicherstellen, dass Datei existiert und öffentlich zugänglich

3. **Alternative: Lokale Mock-Daten erweitern**
   - Realistische Demo-Kandidaten (AAPL, MSFT, NVDA, etc.)
   - Korrekte Preise via Finnhub Quote API
   - Composite Scores aus Trend-Regime

### Akzeptanzkriterien
- [ ] KO-Aggregator Endpoint liefert Daten
- [ ] Scanner zeigt echte Kandidaten (nicht nur Mock)
- [ ] Fallback funktioniert bei KV-Ausfall

---

## Phase 5: Tagesgenaue Wechselkurse (MORGEN — Priorität 2)

### Problem
- Steueranalyse nutzt geschätzte EZB-Jahresdurchschnitte
- Steuererläuterung benötigt tagesgenaue Kurse

### Lösung
1. **EZB Referenzkurs API**
   - Endpoint: `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`
   - Tagesaktueller EUR-Referenzkurs für alle Währungen
   - Caching (täglich aktualisieren)

2. **Historische Kurse**
   - EZB XML Archive für vergangene Tage
   - Oder: `https://api.exchangerate.host/` (kostenlos)

### Akzeptanzkriterien
- [ ] Jede Transaktion hat tagesgenauen Wechselkurs
- [ ] Steuererläuterung zeigt tagesgenaue Kurse
- [ ] Summen stimmen mit tatsächlichen Kursen überein

---

## Phase 6: Automatischer CapTrader Import (Wunsch)

### Idee
- CapTrader API (falls verfügbar)
- Oder: Automatischer Download der Flex-Queries
- Cron-Job für täglichen Import

### Akzeptanzkriterien
- [ ] Täglicher automatischer Import
- [ ] Portfolio immer aktuell
- [ ] Push-Benachrichtigung bei neuen Trades

---

## Phase 7: Erweiterte Options-Strategien

### Geplant
- **ZEBRA** (Zero Extrinsic Back Ratio)
- **Put Diagonal**
- **Collared LEAP**
- **Iron Condor Screener**

### Akzeptanzkriterien
- [ ] Alle 5 Säulen im Scanner verfügbar
- [ ] Strategie-spezifische Validatoren
- [ ] Backtesting mit historischen Daten

---

## Phase 8: Performance-Vergleich

### Idee
- Historische Trades (aus Trade Journal) vs. Scanner-Empfehlungen
- "Hätte ich den Scanner früher gehabt..."
- Optimierungspotenzial quantifizieren

### Akzeptanzkriterien
- [ ] Vergleichs-Report pro Jahr
- [ ] PnL-Vergleich: Aktuell vs. Scanner-optimiert
- [ ] Visualisierung im Dashboard

---

## Phase 9: Mobile App

### Idee
- PWA (Progressive Web App)
- Push-Benachrichtigungen bei Scanner-Signalen
- Mobile-optimierte UI

---

## Technische Schulden

1. **Finnhub Free-Tier Limits**
   - Options-Chain liefert keine Greeks
   - Lösung: Polygon.io oder Premium-Tier

2. **Zustand Management**
   - Aktuell: Zustand + Context
   - Zukunft: Redux Toolkit oder Zustand v5

3. **Testing**
   - E2E-Tests fehlen (Playwright/Cypress)
   - Visual Regression Tests

---

## API-Keys & Zugänge

| Service | Key | Status |
|---------|-----|--------|
| Finnhub | `d85nf39r01qitd92t67gd85nf39r01qitd92t680` | ✅ Aktiv |
| KO-Aggregator KV | Cloudflare Worker | ❌ Offline |
| KO-Aggregator GitHub | `backups/tr_backup_latest.json` | ❌ Offline |
| EZB FX | `eurofxref-daily.xml` | 🟡 Nicht integriert |

---

Letzte Aktualisierung: 25.07.2026 23:22
