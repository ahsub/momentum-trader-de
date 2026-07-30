# Tax UI v5 — Integration Guide

## Neue Komponenten

### `src/components/CapTraderImport.jsx`
4-Schritt-Wizard für den Import von CapTrader FlexQuery XML:
1. **XML-Upload**: FlexQuery Activity Statement (.xml)
2. **EZB-Kurse** (optional): `eurofxref-hist.csv` für präzisere Umrechnungen
3. **Steuerliche Angaben**: Steuerpflichtiger, Steuerjahr, Kirchensteuer-Variante
4. **Report-Generierung**: Direkte Integration mit `TaxReportEngine`

### `src/components/TaxAnalysis.jsx`
Dashboard für die Steueranalyse mit 4 Tabs:
- **Übersicht**: Gewinne/Verluste, Steuerberechnung, Verlusttöpfe, Trading-Statistik
- **Anlage KAP**: Zeilen-Mapping für die elektronische Steuererklärung
- **Tagesbericht**: Aufschlüsselung nach Trading-Tagen (expandierbar)
- **Warnungen**: FX-Abweichungen, nicht validierte Kurse

### `src/utils/taxReportPDF.js`
Client-seitiger PDF-Export:
- **Primär**: jsPDF + jspdf-autotable für professionelle PDFs
- **Fallback**: Browser-Print mit optimiertem CSS (falls jsPDF nicht geladen werden kann)
- Exportiert: Zusammenfassung, Kategorien, Anlage KAP, Verlusttöpfe, Warnungen

## Installation

```bash
npm install
```

jsPDF und jspdf-autotable sind jetzt in den Dependencies.

## Nutzung

1. Navigiere zum neuen Tab **"Steuerreport"**
2. Klicke auf **"CapTrader Import"**
3. Lade dein FlexQuery XML hoch
4. (Optional) Lade EZB-Referenzkurse hoch
5. Gib steuerliche Angaben ein
6. Der Report wird automatisch generiert und im Tab angezeigt
7. Exportiere als **PDF** oder **CSV**

## EZB-Kurse herunterladen

Die EZB stellt historische Wechselkurse als ZIP bereit:
https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip

Entpacke die ZIP und lade die CSV im Import-Wizard hoch.

## Architektur

```
feature/tax-engine-v4 (Business Logic)
  ├── TaxEngine.js
  ├── TaxReportEngine.js
  ├── FxConverter.js (mit EZB-Support)
  └── ...
      ↓
feature/tax-ui-v5 (Presentation Layer)
  ├── CapTraderImport.jsx
  ├── TaxAnalysis.jsx
  └── taxReportPDF.js
```

## Tests

Die bestehenden Tests in `feature/tax-engine-v4` bleiben unverändert:
- `FlexQueryParser.test.js`
- `FxConverter.test.js`
- `TaxEngine.test.js`
- `integration.test.js`

Neue UI-Tests sollten mit `@testing-library/react` hinzugefügt werden.
