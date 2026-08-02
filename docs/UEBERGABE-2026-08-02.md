# ÜBERGABEPROTOKOLL — Momentum Trader DE
## Datum: 2026-08-02
## Projekt: momentum-trader-de (GitHub: ahsub)
## Branch: feature/tax-ui-v5

---

### 1. AKTUELLER STAND

**Aktiver Branch:** `feature/tax-ui-v5` (v2.2.0)
**Vorgänger-Branch:** `feature/tax-engine-v4` (reine Business Logic)
**Ziel-Branch:** `main` (stable v1.0.0)

### 2. VERSIONEN DER MODULE

| Modul | Datei | Version | Status |
|-------|-------|---------|--------|
| TaxReportEngine | `src/modules/tax/report/TaxReportEngine.js` | v2.0 | ✅ deployed |
| CapTraderImport | `src/components/CapTraderImport.jsx` | v2.0 | ✅ deployed |
| TaxAnalysis | `src/components/TaxAnalysis.jsx` | v2.0 | ✅ deployed |
| taxReportPDF | `src/utils/taxReportPDF.js` | v2.0 | ✅ deployed |
| TaxEngine | `src/modules/tax/TaxEngine.js` | v1.0 | ✅ unverändert |
| FxConverter | `src/modules/tax/report/FxConverter.js` | v1.0 | ✅ unverändert |
| FifoValidator | `src/modules/tax/report/FifoValidator.js` | v1.0 | ✅ unverändert |
| KapReportGenerator | `src/modules/tax/report/KapReportGenerator.js` | v1.0 | ✅ unverändert |
| FlexQueryParser | `src/modules/tax/report/FlexQueryParser.js` | v1.0 | ✅ unverändert |

### 3. NEUE FEATURES IN v2.0

1. **Gemeinschaftskonto-Support**
   - 2 Personen mit individuellem Namen, Anteil, Kirchensteuer
   - Separate Reports pro Person
   - Aufteilungstabelle im PDF

2. **Währungsanalyse**
   - Automatische Erkennung ob EZB-Kurse nötig
   - IBKR-FX-Raten als Default

3. **Warnungs-Deduplizierung**
   - Gruppierung pro Währung/Tag
   - Statt 421+ Warnungen → ~10 gruppierte

4. **Tests**
   - TaxReportEngine: 15+ Tests
   - CapTraderImport: 12+ Tests
   - TaxAnalysis: 18+ Tests

### 4. OFFENE PUNKTE

- [ ] **Kirchensteuer-Checkboxen**: Aktuell Dropdown (none/rest/bwBayern) → Soll Checkboxen sein (8% ja/nein, 9% ja/nein)
- [ ] **Tests laufen lassen**: `npx vitest` noch nicht ausgeführt
- [ ] **Merge in develop**: Branch `develop` ist veraltet (nur 16 Dateien)
- [ ] **Merge in main**: Wenn Tests erfolgreich
- [ ] **Legacy-Services**: `taxExport.js`, `taxParser.js`, `taxRules.js` nur in main — prüfen ob benötigt

### 5. ABHÄNGIGKEITEN

```json
{
  "jspdf": "^2.5.2",
  "jspdf-autotable": "^3.8.4",
  "zustand": "^5.0.0"
}
```

### 6. NÄCHSTE SCHRITTE (VORSCHLAG)

1. Tests laufen lassen und fixen
2. Kirchensteuer-Checkboxen implementieren
3. `tax-ui-v5` → `develop` mergen
4. `tax-ui-v5` → `main` mergen (wenn stabil)
5. `develop` aktualisieren oder löschen

### 7. KONTAKT

- Nutzer: Axel (GitHub: ahsub)
- PAT: Wird pro Session neu generiert
- Projekt: https://github.com/ahsub/momentum-trader-de

---

**Erstellt:** 2026-08-02
**Letzte Änderung:** feature/tax-ui-v5 v2.2.0
