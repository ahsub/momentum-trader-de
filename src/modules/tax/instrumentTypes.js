// src/modules/tax/instrumentTypes.js
// ═══════════════════════════════════════════════════════════════════════════════
// Mapping von CapTrader/IB-Kontrakten zu steuerlichen Kategorien
// ═══════════════════════════════════════════════════════════════════════════════

// ─── IBKR/CapTrader SecType → Steuerliche Kategorie ───────────────────────────
export const INSTRUMENT_KATEGORIEN = {
  // === AKTIEN (Spot) — Aktienverlusttopf ===
  STK: 'aktie',
  ETF: 'etf',
  ETN: 'etf',
  ADR: 'aktie',
  GDR: 'aktie',

  // === FONDS — Allgemeiner Verrechnungstopf ===
  FUND: 'fonds',
  MUTUAL_FUND: 'fonds',
  CLOSED_END_FUND: 'fonds',

  // === TERMINGESCHÄFTE (§20 Abs. 2 Nr. 3 EStG) — Termingeschäfts-Topf ===
  OPT: 'termingeschaeft',           // Optionen
  FOP: 'termingeschaeft',           // Futures-Optionen
  FUT: 'termingeschaeft',           // Futures
  CFD: 'termingeschaeft',           // CFDs
  WAR: 'termingeschaeft',           // Optionsscheine (Warrants)

  // === FOREX / DEvisen ────────────────────────────────────────────────────────
  CASH: 'forex',                    // Devisen (Spot & Termin)

  // === ANLEIHEN ─────────────────────────────────────────────────────────────────
  BOND: 'anleihe',

  // === KRYPTO ─────────────────────────────────────────────────────────────────
  CRYPTO: 'crypto_spot',
};

// ─── Asset-Typ → Verlusttopf ───────────────────────────────────────────────────
export const VERLUSTTOPF_MAPPING = {
  aktie: 'AKTIEN',
  etf: 'ALLGEMEIN',
  fonds: 'ALLGEMEIN',
  anleihe: 'ALLGEMEIN',
  zins: 'ALLGEMEIN',
  termingeschaeft: 'TERMINGESCHAEFTE',
  forex: 'TERMINGESCHAEFTE',        // Devisentermingeschäfte → §20 Abs. 2 Nr. 3
  crypto_spot: 'CRYPTO',            // §23 EStG — NICHT mit Kapitalerträgen verrechenbar!
};

// ─── Asset-Typ für Teilfreistellung (nur Fonds/ETFs) ────────────────────────────
export const FONDS_KATEGORIE = {
  aktienfonds: 'aktienfonds',
  mischfonds: 'mischfonds',
  immobilienfondsInland: 'immobilienfondsInland',
  immobilienfondsAusland: 'immobilienfondsAusland',
  sonstige: 'sonstige',
};

// ─── Hilfsfunktionen ───────────────────────────────────────────────────────────

/**
 * Mappt IBKR SecType zu steuerlicher Kategorie
 * @param {string} secType - IBKR SecType (STK, OPT, FUT, etc.)
 * @returns {string} Steuerliche Kategorie
 */
export function mapSecTypeToKategorie(secType) {
  return INSTRUMENT_KATEGORIEN[secType] || 'aktie';
}

/**
 * Mappt steuerliche Kategorie zu Verlusttopf
 * @param {string} kategorie - 'aktie' | 'etf' | 'termingeschaeft' | etc.
 * @returns {string} Verlusttopf-Key
 */
export function mapKategorieToVerlusttopf(kategorie) {
  return VERLUSTTOPF_MAPPING[kategorie] || 'ALLGEMEIN';
}

/**
 * Prüft ob ein Instrument ein Termingeschäft ist
 * @param {string} secType - IBKR SecType
 * @returns {boolean}
 */
export function isTermingeschaeft(secType) {
  const kat = mapSecTypeToKategorie(secType);
  return kat === 'termingeschaeft' || kat === 'forex';
}

/**
 * Prüft ob ein Instrument ein Aktienverlusttopf-Instrument ist
 * @param {string} secType - IBKR SecType
 * @returns {boolean}
 */
export function isAktienTopf(secType) {
  return mapSecTypeToKategorie(secType) === 'aktie';
}

/**
 * Prüft ob ein Instrument Teilfreistellung hat
 * @param {string} secType - IBKR SecType
 * @returns {boolean}
 */
export function hasTeilfreistellung(secType) {
  const kat = mapSecTypeToKategorie(secType);
  return kat === 'etf' || kat === 'fonds';
}
