/**
 * Tax Rules — DBA-Regeln, Quellensteuer, Fristen, Kirchensteuer, Gemeinschaftskonto
 * Portiert aus refundex
 * 
 * Doppelbesteuerungsabkommen (DBA) für Kapitalerträge
 * Quellensteuersätze und Erstattungsmöglichkeiten
 * Kirchensteuer (8% oder 9% auf Abgeltungsteuer)
 * Gemeinschaftskonto (Ehepaar / Lebenspartner)
 */

// ─── Quellensteuer-Sätze pro Land (% auf Dividenden) ───
export const WITHHOLDING_RATES = {
  'USA': { rate: 15, dbaRate: 15, canRefund: false, notes: 'DBA USA: 15% (Art. 10). Keine Erstattung möglich, aber Anrechnung auf dt. KSt.' },
  'SCHWEIZ': { rate: 35, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA CH: 35% -> 15% erstattungsfähig. Antrag bei BSV innerhalb 3 Jahren.' },
  'GROSSBRITANNIEN': { rate: 0, dbaRate: 0, canRefund: false, notes: 'UK: Keine Quellensteuer auf Dividenden. Keine Erstattung nötig.' },
  'FRANKREICH': { rate: 12.8, dbaRate: 15, canRefund: false, notes: 'FR: Prélèvement Forfaitaire Unique (PFU). Keine Erstattung, aber Anrechnung.' },
  'ITALIEN': { rate: 26, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA IT: 26% -> 15% erstattungsfähig. Antrag bei Agenzia Entrate.' },
  'KANADA': { rate: 15, dbaRate: 15, canRefund: false, notes: 'DBA CA: 15%. Keine Erstattung, Anrechnung möglich.' },
  'JAPAN': { rate: 15.315, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA JP: ~15.315% -> 15%. Erstattung bei NTA möglich.' },
  'AUSTRALIEN': { rate: 30, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA AU: 30% -> 15% erstattungsfähig. Antrag bei ATO.' },
  'SCHWEDEN': { rate: 30, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA SE: 30% -> 15% erstattungsfähig. Antrag bei Skatteverket.' },
  'NORWEGEN': { rate: 25, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA NO: 25% -> 15% erstattungsfähig. Antrag bei Skatteetaten.' },
  'DÄNEMARK': { rate: 27, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA DK: 27% -> 15% erstattungsfähig. Antrag bei SKAT.' },
  'NIEDERLANDE': { rate: 15, dbaRate: 15, canRefund: false, notes: 'DBA NL: 15%. Keine Erstattung, Anrechnung.' },
  'SPANIEN': { rate: 19, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA ES: 19% -> 15% erstattungsfähig. Antrag bei AEAT.' },
  'BELGIEN': { rate: 30, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA BE: 30% -> 15% erstattungsfähig. Antrag bei FOD Financiën.' },
  'ÖSTERREICH': { rate: 27.5, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA AT: 27.5% -> 15% erstattungsfähig. Antrag bei BMF.' },
  'IRLAND': { rate: 25, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA IE: 25% -> 15% erstattungsfähig. Antrag bei Revenue.' },
  'FINNLAND': { rate: 30, dbaRate: 15, canRefund: true, minAmount: 100, notes: 'DBA FI: 30% -> 15% erstattungsfähig. Antrag bei Vero.' },
};

// ─── Kirchensteuer-Sätze (auf Abgeltungsteuer) ───
export const CHURCH_TAX_RATES = {
  none: { rate: 0, label: 'Keine Kirchensteuer' },
  bwBy: { rate: 0.08, label: '8% (Baden-Württemberg, Bayern)' },
  other: { rate: 0.09, label: '9% (alle anderen Bundesländer)' },
};

// ─── Steuerliche Sätze Deutschland ───
export const GERMAN_TAX_RATES = {
  abgeltungsteuer: 0.25,      // 25%
  soli: 0.055,                // 5,5% auf Abgeltungsteuer
  freibetragEinzel: 1000,     // Sparer-Pauschbetrag Single
  freibetragPaar: 2000,       // Sparer-Pauschbetrag Ehepaar
  werbungskostenpauschale: 1000,
};

/**
 * Berechnet den effektiven Steuersatz inkl. Soli und Kirchensteuer
 */
export function getEffectiveTaxRate(churchTaxKey = 'none') {
  const churchRate = CHURCH_TAX_RATES[churchTaxKey]?.rate || 0;
  const abgeltung = GERMAN_TAX_RATES.abgeltungsteuer;
  const soli = abgeltung * GERMAN_TAX_RATES.soli;
  const kirchen = abgeltung * churchRate;
  return abgeltung + soli + kirchen;
}

/**
 * Steuerberechnung DE — mit Kirchensteuer und Gemeinschaftskonto
 * 
 * @param {Object} params
 * @param {number} params.capitalIncome — Kapitalerträge gesamt
 * @param {boolean} params.isJointAccount — Gemeinschaftskonto?
 * @param {string} params.churchTaxKey — 'none' | 'bwBy' | 'other'
 * @param {boolean} params.personAChurch — Person A kirchensteuerpflichtig?
 * @param {boolean} params.personBChurch — Person B kirchensteuerpflichtig? (nur bei Gemeinschaftskonto)
 */
export function calculateGermanTax({
  capitalIncome,
  isJointAccount = false,
  churchTaxKey = 'none',
  personAChurch = false,
  personBChurch = false,
}) {
  const freibetrag = isJointAccount ? GERMAN_TAX_RATES.freibetragPaar : GERMAN_TAX_RATES.freibetragEinzel;
  const taxable = Math.max(0, capitalIncome - freibetrag);

  // Basis-Abgeltungsteuer
  const abgeltung = taxable * GERMAN_TAX_RATES.abgeltungsteuer;

  // Soli (immer)
  const soli = abgeltung * GERMAN_TAX_RATES.soli;

  // Kirchensteuer (nur bei Kirchensteuerpflicht)
  let kirchensteuer = 0;
  let kirchensteuerNote = '';

  if (churchTaxKey !== 'none') {
    const churchRate = CHURCH_TAX_RATES[churchTaxKey].rate;

    if (isJointAccount) {
      // Bei Gemeinschaftskonto: Aufteilung 50/50, Kirchensteuer nur für kirchensteuerpflichtige Personen
      const shareA = taxable * 0.5;
      const shareB = taxable * 0.5;
      const kirchenA = personAChurch ? (shareA * GERMAN_TAX_RATES.abgeltungsteuer * churchRate) : 0;
      const kirchenB = personBChurch ? (shareB * GERMAN_TAX_RATES.abgeltungsteuer * churchRate) : 0;
      kirchensteuer = kirchenA + kirchenB;

      const parts = [];
      if (personAChurch) parts.push('Person A');
      if (personBChurch) parts.push('Person B');
      kirchensteuerNote = parts.length > 0 
        ? `Kirchensteuer ${CHURCH_TAX_RATES[churchTaxKey].label} für: ${parts.join(' + ')}`
        : 'Keine Kirchensteuerpflicht';
    } else {
      // Einzelkonto
      kirchensteuer = abgeltung * churchRate;
      kirchensteuerNote = personAChurch 
        ? `Kirchensteuer ${CHURCH_TAX_RATES[churchTaxKey].label}`
        : 'Keine Kirchensteuerpflicht';
    }
  }

  const totalTax = abgeltung + soli + kirchensteuer;
  const effectiveRate = capitalIncome > 0 ? (totalTax / capitalIncome) * 100 : 0;

  return {
    capitalIncome,
    isJointAccount,
    freibetrag,
    taxable,
    abgeltungsteuer: abgeltung,
    soli,
    kirchensteuer,
    totalTax,
    effectiveRate,
    churchTaxNote: kirchensteuerNote,
    perPerson: isJointAccount ? {
      share: capitalIncome / 2,
      taxableShare: taxable / 2,
      taxShare: totalTax / 2,
    } : null,
  };
}

// ─── Fristen-Tracking ───
export function getRefundDeadline(taxYear) {
  const deadline = new Date(parseInt(taxYear) + 4, 11, 31);
  const today = new Date();
  const daysLeft = Math.floor((deadline - today) / (1000 * 60 * 60 * 24));

  return {
    deadline: deadline.toISOString().split('T')[0],
    daysLeft,
    isExpired: daysLeft < 0,
    isUrgent: daysLeft < 90 && daysLeft > 0,
  };
}

// ─── Erstattungs-Berechnung ───
export function calculateRefund(dividendEur, countryKey, withholdingPaid) {
  const rule = WITHHOLDING_RATES[countryKey?.toUpperCase()];
  if (!rule) return { eligible: false, reason: 'Kein DBA-Eintrag für dieses Land' };

  if (!rule.canRefund) {
    return { eligible: false, reason: rule.notes, creditable: withholdingPaid };
  }

  const dbaRate = rule.dbaRate / 100;
  const maxWithholding = dividendEur * dbaRate;
  const overpaid = withholdingPaid - maxWithholding;

  if (overpaid <= 0) {
    return { eligible: false, reason: 'Keine Überzahlung (DBA-Satz bereits angewendet)', creditable: withholdingPaid };
  }

  if (overpaid < (rule.minAmount || 0)) {
    return { eligible: false, reason: `Betrag unter Mindestgrenze (€${rule.minAmount})`, refundAmount: overpaid };
  }

  return {
    eligible: true,
    refundAmount: overpaid,
    creditable: maxWithholding,
    dbaRate: rule.dbaRate,
    notes: rule.notes,
  };
}

// ─── Options-Steuer (§ 20 Abs. 1 Nr. 1 EStG) ───
export function calculateOptionTax(premiumReceived, isCovered = true) {
  const taxable = premiumReceived;
  const tax = taxable * getEffectiveTaxRate();

  return {
    premiumReceived: taxable,
    tax,
    isCovered,
    note: isCovered 
      ? 'Gedeckte Calls: Prämie = Kapitalertrag, Verlust aus Aktienabgabe = Werbungskosten'
      : 'Ungedeckte Calls: Prämie = Kapitalertrag, Verluste nur bis Prämienertrag abziehbar',
  };
}
