// BEFORE: Zwei separate Bridges
import { fetchKoData } from './koAggregatorBridge.js';
import { fetchUiqData } from './uiqBridge.js';

// AFTER: Einheitlicher aggregatorStore mit Zustand
import { useAggregatorStore } from '../stores/aggregatorStore.js';
// Ein Fetch, ein Cache, reaktiv für alle Konsumenten
Aktionen:
[ ] Neuen aggregatorStore.ts erstellen (Zustand-basiert)
[ ] Fetch-Logik aus beiden Bridges migrieren
[ ] Gemeinsamen Cache implementieren
[ ] Alte Bridges als Deprecation markieren
A3. Regime-Taxonomie-Einheitlichkeit (Priorität: HOCH)
Problem: Drei verschiedene Regime-Definitionen:
types/index.ts: Kein NEUTRAL
McmStore.ts: BULL_VOLATILE / BEAR_QUIET / BEAR_VOLATILE / CRISIS + NEUTRAL
UIQ: BULL_QUIET / BULL_FRAGILE / POST_PANIC_REVERSION / STRESS_UNSTABLE
Lösung: UIQ's Taxonomie als kanonisch festlegen
TypeScript
// Einheitliche Regime-Taxonomie (UIQ-kanonisch)
export enum MarketRegime {
  BULL_QUIET = 'BULL_QUIET',
  BULL_FRAGILE = 'BULL_FRAGILE',
  POST_PANIC_REVERSION = 'POST_PANIC_REVERSION',
  STRESS_UNSTABLE = 'STRESS_UNSTABLE',
  NEUTRAL = 'NEUTRAL',  // Fallback
}
Aktionen:
[ ] UIQ-Regime-Taxonomie als kanonisch definieren
[ ] Alle Dateien synchronisieren
[ ] Type-Guards für Regime-Validierung implementieren
A4. Komponenten-Refactoring (Priorität: MITTEL)
Problem: Monolithen auf Komponentenebene
OptionsScanner.jsx: 33 KB
taxReportService.js: 35 KB
AlertPanel.jsx: 23 KB
CapTraderImport.jsx: 26 KB
Faustregel: Max. ~300 Zeilen pro Datei
Lösung für taxReportService.js:
plain
BEFORE:
  src/services/taxReportService.js (35 KB)

AFTER:
  src/services/tax/
    ├── index.ts                    ← Public API
    ├── calculateRealizedPnL.ts     ← Trade-Klassifizierung
    ├── calculateToepfe.ts          ← Verlustverrechnung
    ├── calculateGermanTaxes.ts     ← Steuerberechnung
    ├── calculateDividends.ts       ← Dividenden-Logik
    ├── calculateInterest.ts        ← Zins-Logik
    ├── generateReport.ts           ← Report-Generierung
    ├── exportFormats.ts            ← CSV/JSON/HTML Export
    ├── types.ts                    ← Tax-Typen
    └── constants.ts                ← Steuersätze, Limits
Aktionen:
[ ] taxReportService.js in Modul-Verzeichnis aufteilen
[ ] OptionsScanner.jsx in Sub-Komponenten aufteilen
[ ] AlertPanel.jsx in Sub-Komponenten aufteilen
[ ] CapTraderImport.jsx in Sub-Komponenten aufteilen
Bekannte Probleme & Lösungen
Table
#	Problem	Status	Lösung	Zielversion
1	Sparer-Pauschbetrag wird fälschlicherweise abgezogen	✅ Gelöst	Abzug entfernt, nur Hinweis	v3.3
2	ETF-Vorabpauschale fehlt	🔴 Offen	Aus IBKR-Daten extrahieren	v3.4
3	Kirchensteuer nicht in KAP-Zeilen	🟡 Hinweis	Separate Anzeige im Report	v3.3
4	50/50-Aufteilung nur manuell	🔴 Offen	Automatische Generierung	v3.4
5	Kein ELSTER-Export	🔴 Offen	XML-Export implementieren	v3.5
A1	Zwei Store-Konzepte	🔴 Kritisch	Auf Zustand konsolidieren	Arch-Refactor
A2	Doppelte UIQ-Bridge	🔴 Kritisch	aggregatorStore erstellen	Arch-Refactor
A3	Inkonsistente Regime	🔴 Kritisch	UIQ-Taxonomie kanonisieren	Arch-Refactor
A4	Komponenten-Monolithen	🟡 Hoch	Auf <300 Zeilen aufteilen	Arch-Refactor
Steuerliche Grundlagen (Referenz)
Sparer-Pauschbetrag
Einzelkonto: €1.000
Gemeinschaftskonto: €2.000 (je €1.000 pro Ehegatte)
Ausländische Broker: Kein Abzug möglich, muss beim Finanzamt beantragt werden
Verlustverrechnungstöpfe
Table
Topf	Inhalt	Verrechnung	§ EStG
Topf 1	Stillhalter, Zinsen, Dividenden	Mit allen Kapitaleinkünften	§ 20 Abs. 1
Topf 2	Aktienveräußerungen	Nur mit Aktiengewinnen	§ 20 Abs. 2
Topf 3	Termingeschäfte	Max. €20.000 mit anderen Kapitaleinkünften	§ 20 Abs. 6
Steuersätze
Abgeltungsteuer: 25%
Solidaritätszuschlag: 5,5% auf Abgeltungsteuer
Kirchensteuer: 8% (BW/Bayern) oder 9% (andere Bundesländer)
Changelog
v3.3 (2026-07-28)
FIXED: Sparer-Pauschbetrag-Abzug entfernt (ausländischer Broker)
ADDED: Info-Box zum Sparer-Pauschbetrag im Report
ADDED: Kirchensteuer-Hinweis im Report
CONFIRMED: Stillhalter-Klassifizierung nach EStG
SWOT: Architektur-Probleme identifiziert und in Roadmap integriert
v3.2 (2026-07-23)
FIXED: Asset Category Erkennung für Optionen
FIXED: realizedPnL Fallback auf proceeds
ADDED: Debug-Logging für Steuerberechnung
v3.1 (2026-07-20)
FIXED: Short/Long Klassifizierung via buySell + openCloseIndicator
ADDED: Verlustvortrag für Termingeschäfte
v3.0 (2026-07-15)
NEW: Refundex-kompatible Steuerberechnung
NEW: Verlustverrechnungstöpfe
NEW: KAP-Zeilen-Generierung
Lernziele & Erkenntnisse
Wichtigste Lektion für UIQ v2
Die Trennlinie ist nicht "Service vs. Komponente" sondern "Was ist globaler Zustand (Zustand-Store), was ist lokaler Komponentenzustand (useState), was ist reines IO (Service)?"
Konkrete Empfehlungen (aus SWOT)
src/store/ löschen, McmStore.ts in Zustand-Store umschreiben → src/stores/mcmStore.ts
koAggregatorBridge + uiqBridge in einen einzigen aggregatorStore.js mit Zustand zusammenführen
Große Komponenten in kleinere Teilkomponenten aufbrechen — max. ~300 Zeilen pro Datei
Regime-Taxonomie einmal festlegen und über alle Dateien synchronisieren
Dokument wird bei jeder Release aktualisiert.
