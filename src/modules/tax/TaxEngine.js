// src/modules/tax/TaxEngine.js
// ═══════════════════════════════════════════════════════════════════════════════
// STEUER-ENGINE für ausländische Broker (CapTrader/Interactive Brokers)
// Kein Sparer-Freibetrag, keine automatische Steuerabführung
// Drei getrennte Verlusttöpfe: Aktien, Allgemein, Termingeschäfte
// ═══════════════════════════════════════════════════════════════════════════════

import {
  TAX_RATES,
  KIRCHE_MINDERUNG,
  TEILFREISTELLUNG,
  VORABPAUSCHALE,
  VERLUST_TOEPFE,
} from './taxConfig.js';

import {
  VERLUSTTOPF_MAPPING,
  mapSecTypeToKategorie,
} from './instrumentTypes.js';

/**
 * TaxEngine für ausländische Broker (CapTrader/IB)
 * 
 * WICHTIGE ANNAHMEN:
 * - Kein Sparer-Freibetrag (ausländischer Broker, keine Bescheinigung)
 * - Steuer wird nicht vom Broker abgeführt → Selbstdeklaration in Anlage KAP
 * - Drei getrennte Verlusttöpfe: Aktien, Allgemein, Termingeschäfte
 * - Verluste aus Termingeschäften können NUR gegen Termingeschäfts-Gewinne verrechnet werden
 */
class TaxEngine {
  constructor(options = {}) {
    this.kirchensteuerSatz = options.kirchensteuerSatz || null; // 'bwBayern' | 'rest' | null
    this.isPaar = options.isPaar || false;

    // === FREIBETRAG: Standard 0 für ausländische Broker ===
    this.sparerPauschbetrag = options.sparerPauschbetrag ?? 0;
    this.freibetragVerbraucht = 0;

    // === VERLUSTTÖPFE (persistent über das Jahr) ===
    this.verlustToepfe = {
      [VERLUST_TOEPFE.aktien]: 0,
      [VERLUST_TOEPFE.allgemein]: 0,
      [VERLUST_TOEPFE.termingeschaefte]: 0,
    };

    // Jahresstatistik für Steuererklärung
    this.jahresStatistik = {
      gewinne: { [VERLUST_TOEPFE.aktien]: 0, [VERLUST_TOEPFE.allgemein]: 0, [VERLUST_TOEPFE.termingeschaefte]: 0 },
      verluste: { [VERLUST_TOEPFE.aktien]: 0, [VERLUST_TOEPFE.allgemein]: 0, [VERLUST_TOEPFE.termingeschaefte]: 0 },
      steuerpflichtig: { [VERLUST_TOEPFE.aktien]: 0, [VERLUST_TOEPFE.allgemein]: 0, [VERLUST_TOEPFE.termingeschaefte]: 0 },
      steuer: { [VERLUST_TOEPFE.aktien]: 0, [VERLUST_TOEPFE.allgemein]: 0, [VERLUST_TOEPFE.termingeschaefte]: 0 },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // KERN: Effektiver Gesamtsteuersatz
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Berechnet den effektiven Steuersatz inkl. Soli und ggf. Kirchensteuer
   * @returns {number} Effektiver Steuersatz (z.B. 0.26375 = 26,375%)
   */
  getEffektiverSteuersatz() {
    const { abgeltung, soli, kirchensteuer } = TAX_RATES;

    if (!this.kirchensteuerSatz) {
      return abgeltung * (1 + soli); // 26,375%
    }

    const ksSatz = kirchensteuer[this.kirchensteuerSatz];
    // Kirchensteuer mindert Abgeltungsteuer um 25% der KS
    const geminderteAbgeltung = abgeltung / (1 + KIRCHE_MINDERUNG * ksSatz);
    const anteiligeKS = geminderteAbgeltung * ksSatz;
    const anteiligerSoli = geminderteAbgeltung * soli;

    return geminderteAbgeltung + anteiligeKS + anteiligerSoli;
  }

  /**
   * Gibt den Steuersatz als Prozent-String zurück
   */
  getSteuersatzProzent() {
    return (this.getEffektiverSteuersatz() * 100).toFixed(3) + '%';
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HAUPTMETHODE: Steuer auf einen Trade berechnen
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Berechnet Steuer auf einen Kapitalertrag
   * @param {Object} params
   * @param {number} params.realizedPnl - Realisierter Gewinn/Verlust in EUR
   * @param {string} params.secType - CapTrader/IB SecType (STK, OPT, FUT, CFD, etc.)
   * @param {string} params.assetTyp - 'aktie' | 'etf' | 'fonds' | 'termingeschaeft'
   * @param {string} params.fondsKategorie - Für ETFs/Fonds: 'aktienfonds' | 'mischfonds' | etc.
   * @param {number} params.quellensteuer - Einbehaltene Quellensteuer in EUR (anrechenbar)
   * @returns {Object} Steuerdetails
   */
  berechneSteuer({
    realizedPnl = 0,
    secType = 'STK',
    assetTyp,
    fondsKategorie = 'sonstige',
    quellensteuer = 0,
  }) {
    // Asset-Typ bestimmen (falls nicht explizit angegeben)
    const kategorie = assetTyp || mapSecTypeToKategorie(secType);
    const verlusttopf = VERLUSTTOPF_MAPPING[kategorie];

    // === 1. TEILFREISTELLUNG (nur bei Fonds/ETFs) ===
    const teilfreistellung = this._getTeilfreistellung(kategorie, fondsKategorie);
    const steuerpflichtigerBetrag = realizedPnl * (1 - teilfreistellung);

    // === 2. FREIBETRAG (standardmäßig 0 bei ausländischem Broker) ===
    const { freibetragGenutzt, steuerpflichtigNachFreibetrag } = this._wendeFreibetragAn(
      steuerpflichtigerBetrag
    );

    // === 3. VERLUSTVERRECHNUNG ===
    const { verlustTopfGenutzt, steuerpflichtigNachVerlust } = this._wendeVerlusteAn(
      steuerpflichtigNachFreibetrag,
      verlusttopf
    );

    // === 4. STEUER BERECHNEN ===
    const steuersatz = this.getEffektiverSteuersatz();
    const steuer = Math.max(0, steuerpflichtigNachVerlust * steuersatz);

    // Quellensteuer anrechnen (max. bis zur deutschen Steuerlast)
    const quellensteuerAnrechenbar = Math.min(quellensteuer, steuer);
    const steuerNachAnrechnung = steuer - quellensteuerAnrechenbar;

    // === 5. STATISTIK AKTUALISIEREN ===
    if (realizedPnl > 0) {
      this.jahresStatistik.gewinne[verlusttopf] += steuerpflichtigNachVerlust;
    }
    this.jahresStatistik.steuerpflichtig[verlusttopf] += steuerpflichtigNachVerlust;
    this.jahresStatistik.steuer[verlusttopf] += steuerNachAnrechnung;

    return {
      // Eingangsdaten
      realizedPnl,
      kategorie,
      verlusttopf,

      // Berechnung
      teilfreistellungProzent: teilfreistellung * 100,
      teilfreistellungBetrag: realizedPnl * teilfreistellung,
      steuerpflichtigVorFreibetrag: steuerpflichtigerBetrag,
      freibetragGenutzt,
      steuerpflichtigNachFreibetrag,
      verlustTopfGenutzt,
      steuerpflichtigNachVerlust,

      // Steuer
      steuersatzProzent: steuersatz * 100,
      steuerBrutto: steuer,
      quellensteuerAnrechenbar,
      steuerNetto: steuerNachAnrechnung,

      // Netto
      netto: realizedPnl - steuerNachAnrechnung,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VERLUSTVERRECHNUNG (Drei getrennte Töpfe)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Verbucht einen Verlust in den entsprechenden Topf
   * @param {number} betrag - Verlustbetrag (positiv)
   * @param {string} secType - IBKR SecType
   * @param {string} assetTyp - Optional: explizite Kategorie
   */
  verbucheVerlust(betrag, secType = 'STK', assetTyp) {
    const kategorie = assetTyp || mapSecTypeToKategorie(secType);
    const verlusttopf = VERLUSTTOPF_MAPPING[kategorie];

    this.verlustToepfe[verlusttopf] += Math.abs(betrag);
    this.jahresStatistik.verluste[verlusttopf] += Math.abs(betrag);

    return { verlusttopf, neuerStand: this.verlustToepfe[verlusttopf] };
  }

  /**
   * Verrechnet Gewinn mit Verlusten gemäß §20 EStG
   * 
   * REGELN:
   * - Termingeschäfts-Verluste → NUR gegen Termingeschäfts-Gewinne
   * - Aktienverluste → Zuerst gegen Aktiengewinne, dann allgemeiner Topf
   * - Allgemeine Verluste → Gegen allgemeine Gewinne, auch gegen Aktiengewinne wenn Aktientopf leer
   */
  _wendeVerlusteAn(betrag, verlusttopf) {
    let verlustTopfGenutzt = 0;
    let rest = betrag;

    if (verlusttopf === VERLUST_TOEPFE.termingeschaefte) {
      // Termingeschäfts-Gewinne: Nur gegen Termingeschäfts-Verluste
      const verrechnung = Math.min(rest, this.verlustToepfe[VERLUST_TOEPFE.termingeschaefte]);
      this.verlustToepfe[VERLUST_TOEPFE.termingeschaefte] -= verrechnung;
      rest -= verrechnung;
      verlustTopfGenutzt += verrechnung;
    } 
    else if (verlusttopf === VERLUST_TOEPFE.aktien) {
      // Aktiengewinne: Zuerst gegen Aktienverluste
      const aktienVerrechnung = Math.min(rest, this.verlustToepfe[VERLUST_TOEPFE.aktien]);
      this.verlustToepfe[VERLUST_TOEPFE.aktien] -= aktienVerrechnung;
      rest -= aktienVerrechnung;
      verlustTopfGenutzt += aktienVerrechnung;

      // Dann gegen allgemeine Verluste
      if (rest > 0) {
        const allgVerrechnung = Math.min(rest, this.verlustToepfe[VERLUST_TOEPFE.allgemein]);
        this.verlustToepfe[VERLUST_TOEPFE.allgemein] -= allgVerrechnung;
        rest -= allgVerrechnung;
        verlustTopfGenutzt += allgVerrechnung;
      }
    } 
    else if (verlusttopf === VERLUST_TOEPFE.allgemein) {
      // Allgemeine Gewinne: Zuerst gegen allgemeine Verluste
      const allgVerrechnung = Math.min(rest, this.verlustToepfe[VERLUST_TOEPFE.allgemein]);
      this.verlustToepfe[VERLUST_TOEPFE.allgemein] -= allgVerrechnung;
      rest -= allgVerrechnung;
      verlustTopfGenutzt += allgVerrechnung;

      // Dann gegen Aktienverluste (nur wenn allgemeiner Topf leer)
      if (rest > 0) {
        const aktienVerrechnung = Math.min(rest, this.verlustToepfe[VERLUST_TOEPFE.aktien]);
        this.verlustToepfe[VERLUST_TOEPFE.aktien] -= aktienVerrechnung;
        rest -= aktienVerrechnung;
        verlustTopfGenutzt += aktienVerrechnung;
      }
    }

    return { verlustTopfGenutzt, steuerpflichtigNachVerlust: rest };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FREIBETRAG (standardmäßig 0, aber konfigurierbar)
  // ═══════════════════════════════════════════════════════════════════════════════

  _wendeFreibetragAn(betrag) {
    if (this.sparerPauschbetrag <= 0) {
      return { freibetragGenutzt: 0, steuerpflichtigNachFreibetrag: betrag };
    }

    const verfuegbar = Math.max(0, this.sparerPauschbetrag - this.freibetragVerbraucht);
    const genutzt = Math.min(betrag, verfuegbar);
    this.freibetragVerbraucht += genutzt;

    return {
      freibetragGenutzt: genutzt,
      steuerpflichtigNachFreibetrag: betrag - genutzt,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VORABPAUSCHALE (thesaurierende Fonds/ETFs)
  // ═══════════════════════════════════════════════════════════════════════════════

  berechneVorabpauschale({
    fondsVolumen,
    fondsKategorie = 'aktienfonds',
    ausschuettungen = 0,
  }) {
    const { basiszins2026, basisertragFaktor } = VORABPAUSCHALE;

    const basisertrag = fondsVolumen * basiszins2026 * basisertragFaktor;
    const vorabpauschale = Math.max(0, basisertrag - ausschuettungen);

    const teilfreistellung = TEILFREISTELLUNG[fondsKategorie] || 0;
    const steuerpflichtigeVorabpauschale = vorabpauschale * (1 - teilfreistellung);

    const steuer = steuerpflichtigeVorabpauschale * this.getEffektiverSteuersatz();

    return {
      fondsVolumen,
      basiszins: basiszins2026,
      basisertrag,
      ausschuettungen,
      vorabpauschale,
      teilfreistellungProzent: teilfreistellung * 100,
      steuerpflichtigeVorabpauschale,
      steuer,
      verlusttopf: VERLUST_TOEPFE.allgemein,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HILFSMETHODEN
  // ═══════════════════════════════════════════════════════════════════════════════

  _getTeilfreistellung(assetTyp, fondsKategorie) {
    if (assetTyp !== 'etf' && assetTyp !== 'fonds') return 0;
    return TEILFREISTELLUNG[fondsKategorie] || 0;
  }

  getVerlustToepfe() {
    return { ...this.verlustToepfe };
  }

  getJahresStatistik() {
    return { ...this.jahresStatistik };
  }

  getFreibetragRest() {
    return Math.max(0, this.sparerPauschbetrag - this.freibetragVerbraucht);
  }

  /**
   * Gibt eine Zusammenfassung für die Steuererklärung zurück
   */
  getSteuererklaerungSummary() {
    const steuersatz = this.getEffektiverSteuersatz();

    return {
      anlageKAP: {
        zeile7: this.jahresStatistik.gewinne[VERLUST_TOEPFE.termingeschaefte],
        zeile8: this.jahresStatistik.gewinne[VERLUST_TOEPFE.aktien],
        zeile15: this.jahresStatistik.verluste[VERLUST_TOEPFE.aktien],
        zeile19: Object.values(this.jahresStatistik.gewinne).reduce((a, b) => a + b, 0),
        zeile25: this.jahresStatistik.verluste[VERLUST_TOEPFE.termingeschaefte],
        zeile37: 0, // Kein Steuerabzug
        zeile38: 0,
        zeile39: 0,
      },
      verlusttoepfe: this.getVerlustToepfe(),
      gesamtSteuerpflichtig: Object.values(this.jahresStatistik.steuerpflichtig).reduce((a, b) => a + b, 0),
      gesamtSteuer: Object.values(this.jahresStatistik.steuer).reduce((a, b) => a + b, 0),
      steuersatz: this.getSteuersatzProzent(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SERIALISIERUNG (für Persistence)
  // ═══════════════════════════════════════════════════════════════════════════════

  toJSON() {
    return {
      kirchensteuerSatz: this.kirchensteuerSatz,
      isPaar: this.isPaar,
      sparerPauschbetrag: this.sparerPauschbetrag,
      verlustToepfe: this.verlustToepfe,
      freibetragVerbraucht: this.freibetragVerbraucht,
      jahresStatistik: this.jahresStatistik,
    };
  }

  static fromJSON(data) {
    const engine = new TaxEngine(data);
    engine.verlustToepfe = data.verlustToepfe;
    engine.freibetragVerbraucht = data.freibetragVerbraucht;
    engine.jahresStatistik = data.jahresStatistik;
    return engine;
  }
}

export default TaxEngine;
