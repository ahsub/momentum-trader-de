/**
 * Tax Rules — DBA-Regeln, Quellensteuer, Fristen
 * Portiert aus refundex
 * 
 * Doppelbesteuerungsabkommen (DBA) für Kapitalerträge
 * Quellensteuersätze und Erstattungsmöglichkeiten
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

// ─── Fristen-Tracking ───
export function getRefundDeadline(taxYear) {
  // Quellensteuer-Erstattung: 4 Jahre ab Ende des Kalenderjahres
  const deadline = new Date(parseInt(taxYear) + 4, 11, 31); // 31.12.YYYY+4
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

// ─── Steuerliche Sätze Deutschland ───
export const GERMAN_TAX_RATES = {
  abgeltungsteuer: 0.26375, // 25% + 5.5% Soli = 26.375%
  freibetragEinzel: 1000,    // Sparer-Pauschbetrag Single
  freibetragPaar: 2000,      // Sparer-Pauschbetrag Ehepaar
  werbungskostenpauschale: 1000,
};

// ─── Steuerberechnung DE ───
export function calculateGermanTax(capitalIncome, isMarried = false) {
  const freibetrag = isMarried ? GERMAN_TAX_RATES.freibetragPaar : GERMAN_TAX_RATES.freibetragEinzel;
  const taxable = Math.max(0, capitalIncome - freibetrag);
  const tax = taxable * GERMAN_TAX_RATES.abgeltungsteuer;

  return {
    capitalIncome,
    freibetrag,
    taxable,
    tax,
    effectiveRate: capitalIncome > 0 ? (tax / capitalIncome) * 100 : 0,
  };
}

// ─── Options-Steuer (§ 20 Abs. 1 Nr. 1 EStG) ───
export function calculateOptionTax(premiumReceived, isCovered = true) {
  // Optionsprämien sind grundsätzlich Einkünfte aus Kapitalvermögen
  // Verluste aus ungedeckten Calls sind nur bis zum Prämienertrag abziehbar
  const taxable = premiumReceived;
  const tax = taxable * GERMAN_TAX_RATES.abgeltungsteuer;

  return {
    premiumReceived: taxable,
    tax,
    isCovered,
    note: isCovered 
      ? 'Gedeckte Calls: Prämie = Kapitalertrag, Verlust aus Aktienabgabe = Werbungskosten'
      : 'Ungedeckte Calls: Prämie = Kapitalertrag, Verluste nur bis Prämienertrag abziehbar',
  };
}
