/**
 * Tax Parser — CapTrader Kontoauszug CSV
 * Portiert aus refundex — Steueranalyse für Kapitalerträge
 * 
 * Parst CapTrader CSV-Kontoauszüge und kategorisiert:
 * - Dividenden (mit Quellensteuer)
 * - Zinsen
 * - Veräußerungsgewinne/-verluste (Aktien, Optionen)
 * - Optionsprämien
 * - Einbehaltete Steuern
 */

// ─── EZB Referenz-FX (geschätzte Jahresdurchschnitte) ───
const EZB_FX_EST = {
  'USD': 1.08, 'CHF': 0.94, 'GBP': 0.85, 'CAD': 1.47,
  'JPY': 162.0, 'AUD': 1.64, 'SEK': 11.5, 'NOK': 11.7,
  'DKK': 7.46, 'PLN': 4.30, 'CZK': 25.0, 'HUF': 395.0,
};

export function getFxRate(currency) {
  return EZB_FX_EST[currency?.toUpperCase()] || 1.0;
}

export function toEur(amount, currency) {
  return amount / getFxRate(currency);
}

// ─── Steuerkategorien ───
export const TAX_CATEGORIES = {
  DIVIDEND: 'Dividende',
  INTEREST: 'Zinsen',
  CAP_GAIN: 'Veräußerungsgewinn',
  CAP_LOSS: 'Veräußerungsverlust',
  OPTION_PREMIUM: 'Optionsprämie',
  OPTION_EXERCISE: 'Option Ausübung/Zuteilung',
  TAX_WITHHELD: 'Einbehaltene Steuer',
  TAX_REFUND: 'Steuererstattung',
  FEE: 'Gebühr/Kommission',
  ADJUSTMENT: 'Korrekturbuchung',
};

// ─── CSV-Zeile parsen ───
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── CapTrader CSV Header erkennen ───
function detectHeaders(firstLine) {
  const cols = parseCSVLine(firstLine.toLowerCase());
  const map = {};
  cols.forEach((c, i) => {
    if (c.includes('datum') || c.includes('date')) map.date = i;
    if (c.includes('zeit') || c.includes('time')) map.time = i;
    if (c.includes('produkt') || c.includes('product') || c.includes('symbol')) map.product = i;
    if (c.includes('isin')) map.isin = i;
    if (c.includes('buchungstext') || c.includes('description')) map.description = i;
    if (c.includes('betrag') || c.includes('amount')) map.amount = i;
    if (c.includes('währung') || c.includes('currency')) map.currency = i;
    if (c.includes('steuer') || c.includes('tax')) map.tax = i;
    if (c.includes('gebühr') || c.includes('fee') || c.includes('kommission')) map.fee = i;
    if (c.includes('kurs') || c.includes('rate')) map.fxRate = i;
    if (c.includes('land') || c.includes('country')) map.country = i;
  });
  return map;
}

// ─── Buchung kategorisieren ───
function categorizeTransaction(desc, amount) {
  const d = (desc || '').toLowerCase();

  // Dividenden
  if (d.includes('dividend') || d.includes('dividende') || d.includes('distribution')) {
    return amount >= 0 ? TAX_CATEGORIES.DIVIDEND : TAX_CATEGORIES.TAX_WITHHELD;
  }

  // Zinsen
  if (d.includes('interest') || d.includes('zins') || d.includes('coupon')) {
    return amount >= 0 ? TAX_CATEGORIES.INTEREST : TAX_CATEGORIES.TAX_WITHHELD;
  }

  // Steuern
  if (d.includes('steuer') || d.includes('tax') || d.includes('quellensteuer') || d.includes('withholding')) {
    return TAX_CATEGORIES.TAX_WITHHELD;
  }

  // Steuererstattung
  if (d.includes('erstattung') || d.includes('refund') || d.includes('rückerstattung')) {
    return TAX_CATEGORIES.TAX_REFUND;
  }

  // Gebühren
  if (d.includes('gebühr') || d.includes('fee') || d.includes('commission') || d.includes('kommission')) {
    return TAX_CATEGORIES.FEE;
  }

  // Optionen — Prämien
  if (d.includes('option') && (d.includes('premium') || d.includes('prämie'))) {
    return TAX_CATEGORIES.OPTION_PREMIUM;
  }

  // Optionen — Ausübung/Zuteilung
  if (d.includes('exercise') || d.includes('ausübung') || d.includes('assignment') || d.includes('zuteilung')) {
    return TAX_CATEGORIES.OPTION_EXERCISE;
  }

  // Veräußerung (Aktien/Optionen)
  if (d.includes('verkauf') || d.includes('sale') || d.includes('sell') || d.includes('close')) {
    return amount >= 0 ? TAX_CATEGORIES.CAP_GAIN : TAX_CATEGORIES.CAP_LOSS;
  }

  if (d.includes('kauf') || d.includes('buy') || d.includes('purchase')) {
    return TAX_CATEGORIES.CAP_GAIN; // Kauf ist kein steuerlicher Vorgang, aber wir tracken ihn
  }

  // Korrekturen
  if (d.includes('korrektur') || d.includes('adjustment') || d.includes('correction')) {
    return TAX_CATEGORIES.ADJUSTMENT;
  }

  return 'Sonstiges';
}

// ─── Haupt-Parser ───
export function parseTaxCSV(csvText, fileName = '') {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { success: false, error: 'CSV ist leer oder ungültig' };

  const headers = detectHeaders(lines[0]);
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const desc = cols[headers.description] || cols[headers.product] || '';
    const amountStr = cols[headers.amount] || '0';
    const amount = parseFloat(amountStr.replace(/[^\d\-,.]/g, '').replace(',', '.')) || 0;
    const currency = (cols[headers.currency] || 'EUR').toUpperCase();
    const dateStr = cols[headers.date] || '';
    const product = cols[headers.product] || '';

    const category = categorizeTransaction(desc, amount);
    const eurAmount = toEur(amount, currency);

    transactions.push({
      id: `tax-${i}-${Date.now()}`,
      date: dateStr,
      description: desc,
      product,
      amount,
      currency,
      eurAmount,
      category,
      isTaxRelevant: [
        TAX_CATEGORIES.DIVIDEND,
        TAX_CATEGORIES.INTEREST,
        TAX_CATEGORIES.CAP_GAIN,
        TAX_CATEGORIES.CAP_LOSS,
        TAX_CATEGORIES.OPTION_PREMIUM,
        TAX_CATEGORIES.OPTION_EXERCISE,
        TAX_CATEGORIES.TAX_WITHHELD,
        TAX_CATEGORIES.TAX_REFUND,
      ].includes(category),
      source: fileName,
    });
  }

  return {
    success: true,
    transactions,
    summary: calculateTaxSummary(transactions),
  };
}

// ─── Zusammenfassung pro Kategorie ───
export function calculateTaxSummary(transactions) {
  const summary = {};
  let totalTaxRelevant = 0;
  let totalTaxWithheld = 0;
  let totalFees = 0;

  Object.values(TAX_CATEGORIES).forEach(cat => summary[cat] = { count: 0, eurTotal: 0 });

  transactions.forEach(t => {
    if (summary[t.category]) {
      summary[t.category].count++;
      summary[t.category].eurTotal += t.eurAmount;
    }

    if (t.isTaxRelevant) totalTaxRelevant += t.eurAmount;
    if (t.category === TAX_CATEGORIES.TAX_WITHHELD) totalTaxWithheld += t.eurAmount;
    if (t.category === TAX_CATEGORIES.FEE) totalFees += Math.abs(t.eurAmount);
  });

  // Kapitalerträge (ohne bereits versteuerte Dividenden/Zinsen, aber mit Kursgewinnen)
  const capitalGains = (summary[TAX_CATEGORIES.CAP_GAIN]?.eurTotal || 0) 
                     + (summary[TAX_CATEGORIES.OPTION_PREMIUM]?.eurTotal || 0)
                     - Math.abs(summary[TAX_CATEGORIES.CAP_LOSS]?.eurTotal || 0);

  // Dividenden + Zinsen ( bereits mit Quellensteuer belastet)
  const investmentIncome = (summary[TAX_CATEGORIES.DIVIDEND]?.eurTotal || 0)
                         + (summary[TAX_CATEGORIES.INTEREST]?.eurTotal || 0);

  return {
    totalTransactions: transactions.length,
    totalTaxRelevant,
    totalTaxWithheld: Math.abs(totalTaxWithheld),
    totalFees,
    capitalGains,
    investmentIncome,
    byCategory: summary,
  };
}

// ─── Mehrere CSVs mergen ───
export function mergeTaxCSVs(results) {
  const allTransactions = results.flatMap(r => r.transactions || []);
  allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    success: true,
    transactions: allTransactions,
    summary: calculateTaxSummary(allTransactions),
    fileCount: results.length,
  };
}

// ─── Jahresübersicht ───
export function getYearlyOverview(transactions) {
  const byYear = {};

  transactions.forEach(t => {
    const year = t.date?.substring(0, 4) || 'unbekannt';
    if (!byYear[year]) {
      byYear[year] = { transactions: [], summary: null };
    }
    byYear[year].transactions.push(t);
  });

  Object.keys(byYear).forEach(year => {
    byYear[year].summary = calculateTaxSummary(byYear[year].transactions);
  });

  return byYear;
}
