# 🚀 Momentum & Trend Trader DE

> Interaktives Trading-Dashboard für Momentum-Strategien mit KO-Zertifikaten und Trendfolge im deutschen Markt.

## Features

- **🚀 Momentum (KO)** — Hebel-Rechner, Volatilitäts-Matrix, Einstiegs-Checkliste
- **📈 Trendfolge** — ATR-basierte Stops, Teilgewinn-Planer, Trailing-Stop-Visualisierung
- **⏰ ORB-Setup** — Deutsche Xetra-Zeitachse, Breakout-Rechner, Morgen-Workflow
- **📋 Watchlist** — Ticker-Verwaltung mit Gap- und RVOL-Tracking

## Tech Stack

- React 19 + Vite 6
- Tailwind CSS 4
- Recharts (Charts)
- Framer Motion (Animationen)
- Lucide React (Icons)

## Installation

```bash
# Repository klonen
git clone https://github.com/ahsub/momentum-trader-de.git
cd momentum-trader-de

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev
```

## Deployment

```bash
# Build für Production
npm run build

# Auf Vercel deployen
npx vercel --prod
```

## Verwendung

1. **Morgens 07:30** — Tab "ORB-Setup" öffnen, Workflow durchgehen
2. **Pre-Market Scan** — Tab "Momentum (KO)", Gap-Filter anwenden
3. **KO-Auswahl** — Hebel 2-3x, KO-Schwelle mind. 12% unter Einstieg
4. **09:00–09:15** — ORB-Range beobachten, 5-Min-Bestätigung abwarten
5. **Trend-Trades** — Tab "Trendfolge" für längerfristige Positionen

## Disclaimer

⚠️ **Dieses Tool dient ausschließlich der Analyse und Bildung.**

Es stellt keine Anlageberatung dar. Der Handel mit KO-Zertifikaten birgt das Risiko des Totalverlusts des eingesetzten Kapitals. Alle Entscheidungen erfolgen auf eigenes Risiko.

## Lizenz

MIT License — siehe [LICENSE](LICENSE)

---

Entwickelt für den deutschen Markt (Xetra 09:00 MEZ) mit Fokus auf US-ADR-KO-Zertifikate über Trade Republic.


## 🔄 Entwicklungs-Branches

| Branch | Zweck |
|--------|-------|
| `main` | Stabile Production-Version |
| `develop` | Aktive Entwicklung |

## 🏗️ Architektur

Siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 🧪 Tests

```bash
# Tests ausführen
npm test

# Tests im Watch-Modus
npm test -- --watch
```

## 📊 McmStore v3.0

Risk Management Engine mit:
- Regime-Erkennung (Bull Quiet, Bull Volatile, Bear, Crisis)
- Circuit Breaker (MOVE-Index, VIX)
- Position Sizing (Bullish: 100%, Volatile: 30%, Crisis: 0%)

## 🔗 Snapshot-System

Verbindung zu bestehender Infrastruktur:
- **Cloudflare KV**: Aktuelle Daten (live)
- **GitHub-Archiv**: `data/snapshots/YYYY-MM-DD_{03,13}.json.gz`
- **90-Tage-Rotation**: Repo bleibt bei ~20-25 MB

## 🚀 Roadmap

- [x] v1.0.0 Baseline: KO-Rechner, Trendfolge, ORB
- [ ] v2.0.0: API-Integration, McmStore, GapScanner
- [ ] v2.1.0: Portfolio-Tracking, Trade Journal
- [ ] v2.2.0: Backtesting-Modul
- [ ] v3.0.0: Broker-API (Alpaca/IBKR)
