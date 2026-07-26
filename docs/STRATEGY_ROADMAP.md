# STRATEGY_ROADMAP — momentum-trader-de

## Aktueller Stand: v2.2.0-beta (26.07.2026)

---

## Strategische Entscheidungen (26.07.2026)

### 1. Reihenfolge: Struktur zuerst, KI später
**Beschluss:** KI-Empfehlungs-Prompts (LLM-Integration) werden ERST implementiert, wenn:
- Alle Tradingstrategien im Scanner verfügbar sind
- Scanner zuverlässig funktioniert (KO-Aggregator repariert)
- Portfolio-Import stabil läuft
**Begründung:** KI-Empfehlungen ohne solide Datengrundlage wären unzuverlässig.

### 2. UnderlyingIQ-Marktsentiment Integration
**Beschluss:** Die Marktlage/Marktsentiment-Analyse aus `github.com/ahsub/axel-scanner` (Claude-AI Morning Briefings) wird als **Modul integriert** (nicht nur als Dokumentation).
**Form:** React-Komponente, non-HTML-basiert, eigener Tab "Marktlage".
**Zeitpunkt:** Phase 7 (nach Scanner-Reparatur + Optionsstrategien).

### 3. Einstellungen-Persistenz
**Beschluss:** Steuerrelevante Daten (Namen, Kirchensteuerpflicht, Kontotyp) werden in einem **Settings-Panel** voreingestellt und in `localStorage` persistiert.
**Scope:** Gilt für Steueranalyse UND später für KI-Prompts (personalisierte Empfehlungen).

---

## Phase 1: Options Scanner ✅ (Abgeschlossen)
- KO-Aggregator Data-Bridge (Mock-Modus aktiv)
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
- UI-Bugfix: Datei-Input isoliert (26.07.2026)

---

## Phase 4: KO-Aggregator Reparatur 🚨 (HEUTE — Priorität 1)

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

## Phase 5: Fehlende Optionsstrategien (HEUTE — Priorität 2)

### Fehlende Strategien
| Strategie | Beschreibung | Scanner-Logik |
|-----------|--------------|---------------|
| **ZEBRA** | Zero Extrinsic Back Ratio | ITM-Call-Spread + OTM-Put |
| **Put Diagonal** | Calendar Spread mit Puts | Long Put LEAP + Short Put näherer DTE |
| **Collared LEAP** | LEAP + Protective Put + Covered Call | Downside-Schutz mit Prämie |
| **Iron Condor** | Neutraler Range-Trade | 4 Beine, definiertes Risiko |

### Akzeptanzkriterien
- [ ] Alle 4 Strategien im Scanner verfügbar
- [ ] Strategie-spezifische Filter (IV-Rank, DTE, Delta)
- [ ] Validatoren pro Strategie

---

## Phase 6: Tagesgenaue Wechselkurse (MORGEN)

### Problem
- Steueranalyse nutzt geschätzte EZB-Jahresdurchschnitte
- Steuererläuterung benötigt tagesgenaue Kurse

### Lösung
- EZB `eurofxref-daily.xml` integrieren
- Tagesaktueller EUR-Referenzkurs für alle Währungen
- Caching (täglich aktualisieren)

---

## Phase 7: UnderlyingIQ Marktsentiment (Wunsch)

### Integration
- Portierung aus `github.com/ahsub/axel-scanner` (index.html)
- Neue React-Komponente: `MarketSentimentPanel.jsx`
- Tab: "Marktlage"
- Features:
  - KI-enriched Morning Briefing
  - Marktregime-Erkennung (Bull Quiet, Bear Volatile, etc.)
  - VIX-Analyse
  - Sektoren-Rotation
  - Korrelations-Matrix

### Akzeptanzkriterien
- [ ] Tägliches Morning Briefing (manuell oder API-getriggert)
- [ ] Regime-basierte Scanner-Empfehlungen
- [ ] Sentiment-Score für Portfolio-Entscheidungen

---

## Phase 8: KI-Empfehlungen (SPÄTER — nach stabiler Struktur)

### Voraussetzungen
- Alle Scanner-Strategien implementiert
- KO-Aggregator zuverlässig
- Portfolio-Import stabil
- Marktsentiment integriert

### Features
- LLM-Prompts für Trade-Empfehlungen
- Risiko-bewusste Position-Sizing
- Automatische Journal-Einträge mit KI-Analyse
- "Was-wäre-wenn" Szenarien

---

## Phase 9: Einstellungen-Panel (HEUTE — nebenbei)

### Features
- Steuerpflichtige Daten (Name, Geburtsdatum)
- Kirchensteuerpflicht pro Person
- Kontotyp (Einzel/Gemeinschaft)
- Broker-Auswahl (CapTrader, IBKR, Lynx)
- API-Keys verwalten
- Persistenz in localStorage

---

## Phase 10: Mobile App & Automatisierung

### Geplant
- PWA (Progressive Web App)
- Push-Benachrichtigungen bei Scanner-Signalen
- Automatischer CapTrader Import (Cron)

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

Letzte Aktualisierung: 26.07.2026 08:20
