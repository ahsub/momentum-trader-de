# MomentumTrader DE – Übergabeprotokoll & Roadmap

> **Stand:** 28.07.2026, 00:31 Uhr  
> **Letzte Session:** Steuer-Modul v3 – Refundex-kompatibel mit Persistenz  
> **Nächste Session:** Parser-Fehler beheben + Optionsprämien verifizieren

---

## ✅ Erledigt in dieser Session

### 1. CapTraderImport.jsx – Steuer-Vorschau (v3)
- [x] Kompatibel mit `taxReportService.js` API (stockPnL_EUR, optionsPnL_EUR etc.)
- [x] Null-sichere Zugriffe mit Fallback auf 0
- [x] `dailyBreakdown` → `dailyReport` Mapping
- [x] `exportTaxJSON` Funktion hinzugefügt
- [x] Build-Fehler behoben

### 2. taxReportService.js – Steuerberechnung (v3)
- [x] Korrekte Options-P&L via Broker-`realizedPnL` (FifoPnlRealized)
- [x] Trennung: Stillhalter (Topf 1) vs. Termingeschäfte (Topf 3)
- [x] Verlustverrechnungstöpfe mit €20.000 Grenze (§20 Abs. 6)
- [x] Persistenz: Jahresdaten in `localStorage` (`mt_tax_year_data`)
- [x] Inkrementelle Updates: Abgeschlossene Jahre werden nicht überschrieben
- [x] Präsentabler Steuerbericht als HTML mit KAP-Zeilen, Töpfen, Einzelnachweis
- [x] Export: CSV, JSON, HTML, Drucken/PDF
- [x] Steuerpflichtiger-Info (Name, Steuer-ID, Kirchensteuer, Gemeinschaftskonto)

### 3. capTraderParser.js – XML Parser (v3.1)
- [x] Generische Cash Transaction Verarbeitung (alle activityCodes)
- [x] `ACTIVITY_CODE_MAP` – zentrale Konfiguration für Steuerkategorien
- [x] Automatische Klassifizierung: activityCode → {type, taxCategory, description}
- [x] Quellensteuer-Matching pro Dividende (WHT aus Funds)
- [x] Zinserträge aus Funds (BINT/INT)
- [x] **Robustheit:** null-sichere `getAttr()` Funktion
- [x] Optionale Sections (AccountInformation, CashReport)
- [x] Deduplizierung beim Merge mehrerer XML-Dateien
- [x] Erweiterbar für CFD, Forex, Crypto, Zertifikate

---

## 🔴 Bekannte Probleme / Blocker

| # | Problem | Status | Nächster Schritt |
|---|---|---|---|
| 1 | **Parser-Crash:** `Cannot read properties of null (reading 'getAttribute')` bei XML-Import | 🔴 **AKTIV** | Parser v3.1 wurde gepusht (null-safe getAttr). **Warte auf Vercel-Deployment + Hard-Refresh testen** |
| 2 | **Optionsprämien zu hoch:** Werte stimmen nicht mit CapTrader-Steuerbescheinigung überein | 🟡 **OFFEN** | Nach Fix #1: Vergleich mit Steuerbescheinigung Z.12. Falls immer noch falsch → `realizedPnL` vs. `proceeds` prüfen |
| 3 | **Vercel-Deployment:** Änderungen erscheinen nicht sofort in der App | 🟡 **OFFEN** | Hard-Refresh (`Cmd+Shift+R`) oder Inkognito-Fenster. Falls persistent → Build-Log prüfen |

---

## 🗺️ Roadmap – Nächste Schritte

### Priorität 1: Parser stabilisieren
- [ ] Parser v3.1 auf Vercel testen (Hard-Refresh)
- [ ] Falls immer noch Crash: XML-Struktur der Flex Queries analysieren
- [ ] Falls Crash bei `querySelector('AccountInformation')`: Element optional machen oder Fallback
- [ ] `parseMultipleFlexQueries` – Fehlerbehandlung verbessern (welche XML genau failed?)

### Priorität 2: Optionsprämien verifizieren
- [ ] Import mit 4 XML-Dateien (2023-2026) durchführen
- [ ] Optionsgewinne (Z.12) mit CapTrader-Steuerbescheinigung vergleichen
- [ ] Falls Abweichung: Prüfen ob `realizedPnL` (FifoPnlRealized) korrekt aus XML extrahiert wird
- [ ] Alternative: `proceeds` statt `realizedPnL` verwenden?
- [ ] Short-Option Expiration korrekt behandeln (kein separater Trade im XML)

### Priorität 3: Steuerbericht verfeinern
- [ ] HTML-Report Layout testen (Drucken/PDF)
- [ ] KAP-Zeilen mit tatsächlichen Finanzamt-Vordrucken abgleichen
- [ ] Verlustvortrag (Termingeschäfte > €20.000) korrekt berechnen
- [ ] Gemeinschaftskonto: 50/50-Aufteilung implementieren

### Priorität 4: Erweiterbarkeit
- [ ] Unbekannte Activity Codes aus Konsole sammeln und in Mapping einfügen
- [ ] CFD/Forex/Crypto Support aktivieren (Mapping bereits vorhanden)
- [ ] ETF Vorabpauschale (manuell oder via API)

### Priorität 5: Persistenz & UX
- [ ] Gespeicherte Jahre-Übersicht testen (Lock/Unlock)
- [ ] Inkrementelles Update testen (gleiche XML 2x importieren)
- [ ] Steuerpflichtiger-Info in localStorage testen
- [ ] "Alle Daten löschen" Funktion testen

---

## 📁 Wichtige Dateien

| Datei | Zweck | Letzte Änderung |
|---|---|---|
| `src/services/capTraderParser.js` | XML Parser (v3.1) | 28.07. – null-safe getAttr |
| `src/services/taxReportService.js` | Steuerberechnung (v3) | 27.07. – Refundex-kompatibel |
| `src/components/CapTraderImport.jsx` | Import-Dialog (v3) | 27.07. – Steuer-Vorschau |
| `src/components/TaxAnalysis.jsx` | Steueranalyse UI | 27.07. – unverändert |

---

## 🔧 Technische Details

### Steuerliche Logik (Refundex-kompatibel)
- **Stillhalter (Short-Optionen):** §20 Abs. 1 Nr. 11 EStG → Topf 1 (Allgemein)
- **Termingeschäfte (Long-Optionen):** §20 Abs. 6 EStG → Topf 3 (max. €20.000 Verlust)
- **Aktien:** §20 Abs. 4 Satz 7 EStG → Topf 2 (FIFO)
- **Dividenden:** Z. 7 KAP
- **Zinsen:** Z. 14 KAP
- **Quellensteuer:** Z. 41 KAP (anrechenbar)

### Persistenz-Keys (localStorage)
- `mt_tax_year_data` – Gespeicherte Jahresreports
- `mt_tax_settings` – Steuer-Einstellungen
- `mt_imported_files` – Hash der importierten Dateien
- `mt_taxpayer_info` – Steuerpflichtiger-Info

---

## 📞 Kontext für nächste Session

**Wichtig:** Der Parser-Crash (Issue #1) blockiert aktuell alles. Erst wenn der Import funktioniert, können die Optionsprämien verifiziert werden.

**Mögliche Ursachen für Crash:**
1. `stmt.querySelector('AccountInformation')` → `null` (nicht in allen Flex Queries)
2. `el.getAttribute('tradeID')` auf einem `null`-Element
3. XML-Datei enthält kein `FlexStatement` (andere Struktur?)

**Debugging-Tipp:** In der Browser-Konsole prüfen:
```javascript
// Nach dem Crash – prüfen welches Element null ist:
console.log('AccountInfo:', document.querySelector('AccountInformation'));
```

---

*Dokument erstellt von Kimi Debug – MomentumTrader DE v3.1*
