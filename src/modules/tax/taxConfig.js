// src/modules/tax/taxConfig.js
// ═══════════════════════════════════════════════════════════════════════════════
// ZENTRALE STEUERKONFIGURATION für ausländische Broker (CapTrader/Interactive Brokers)
// Bei Gesetzesänderungen NUR diese Datei anpassen!
// ═══════════════════════════════════════════════════════════════════════════════

export const TAX_YEAR = 2026;

// ─── Steuersätze ───────────────────────────────────────────────────────────────
export const TAX_RATES = {
  abgeltung: 0.25,           // § 32d EStG
  soli: 0.055,               // 5,5% auf Abgeltungsteuer
  kirchensteuer: {
    bwBayern: 0.08,          // Baden-Württemberg, Bayern
    restDeutschland: 0.09,   // Alle anderen Bundesländer
  },
};

// Kirchensteuer-Minderung: Abgeltungsteuer wird um 25% der Kirchensteuer gemindert
// (Kirchensteuer ist Sonderausgabe, § 10 Abs. 1 Nr. 4 EStG)
export const KIRCHE_MINDERUNG = 0.25;

// ─── Freibeträge ───────────────────────────────────────────────────────────────
// WICHTIG: Für CapTrader (ausländischer Broker) standardmäßig 0!
// Der Sparerpauschbetrag wird in der Steuererklärung geltend gemacht,
// nicht über den Broker.
export const FREIBETRAEGE = {
  sparerPauschbetrag: 0,        // Standard: 0 (ausländischer Broker)
  sparerPauschbetragPaar: 0,   // Standard: 0
  // Für Steuererklärungs-Berechnung (optional):
  sparerPauschbetragErklaerung: 1000,
  sparerPauschbetragPaarErklaerung: 2000,
};

// ─── Teilfreistellung (nur bei Fonds/ETFs) ─────────────────────────────────────
export const TEILFREISTELLUNG = {
  aktienfonds: 0.30,          // mind. 51% Aktienquote
  mischfonds: 0.15,           // 25-50% Aktienquote
  immobilienfondsInland: 0.60,
  immobilienfondsAusland: 0.80,
  sonstige: 0.00,
};

// ─── Vorabpauschale ────────────────────────────────────────────────────────────
export const VORABPAUSCHALE = {
  basiszins2026: 0.0320,      // 3,20% (Stand: Juni 2026)
  basisertragFaktor: 0.70,    // 70% des Basiszinses
};

// ─── Verlustverrechnung: Drei getrennte Töpfe ──────────────────────────────────
export const VERLUST_TOEPFE = {
  aktien: 'AKTIEN',           // Nur gegen Aktiengewinne
  allgemein: 'ALLGEMEIN',     // ETFs, Zinsen, Dividenden (Fonds)
  termingeschaefte: 'TERMINGESCHAEFTE', // §20 Abs. 2 Nr. 3 EStG
};

// Reihenfolge der Verrechnung
export const VERLUST_REGELN = {
  // Termingeschäfts-Verluste können NUR gegen Termingeschäfts-Gewinne verrechnet werden
  termingeschaefteNurEigen: true,
  // Aktienverluste zuerst gegen Aktiengewinne, dann allgemeiner Topf
  aktienErstEigen: true,
  // Verlustvortrag auf nächstes Jahr (kein Verfall)
  vortragJahre: Infinity,
};
