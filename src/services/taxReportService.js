/**
 * Tax Report Service v3.2 – Refundex-kompatibel mit korrekter Options-Erkennung
 * 
 * FIXES v3.2:
 * - Asset Category Erkennung: OPT, OOPT, OPTC, etc.
 * - realizedPnL Fallback auf proceeds wenn fifoPnlRealized leer ist
 * - Korrekte Short/Long Klassifizierung via buySell + openCloseIndicator
 * - Debug-Logging für Steuerberechnung
 */

const TAX_RATES = {
  abgeltungsteuer: 0.25,
  soli: 0.055,
  kirchensteuer: { none: 0, bw_bayern: 0.08, other: 0.09 }
};

const SPARER_PAUSCHBETRAG = 1000;
const TERMINGESCHAEFTE_VERLUST_LIMIT = 20000;

const STORAGE_KEYS = {
  TAX_YEAR_DATA: 'mt_tax_year_data',
  TAX_SETTINGS: 'mt_tax_settings',
  IMPORTED_FILES: 'mt_imported_files',
};

function toEUR(amount, fxRateToBase, currency) {
  if (!amount) return 0;
  if (currency === 'EUR' || !fxRateToBase || fxRateToBase === 0) return amount;
  return amount / fxRateToBase;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Prüft ob ein Trade eine Option ist (verschiedene Asset-Category-Codes)
 */
function isOptionTrade(trade) {
  const cat = (trade.assetCategory || '').toUpperCase();
  return cat === 'OPT' || cat === 'OOPT' || cat === 'OPTC' || cat === 'IOPT' || cat === 'FOP' ||
         (trade.putCall && (trade.putCall === 'P' || trade.putCall === 'C')) ||
         (trade.strike && trade.strike > 0);
}

/**
 * Prüft ob ein Trade ein Aktientrade ist
 */
function isStockTrade(trade) {
  const cat = (trade.assetCategory || '').toUpperCase();
  return cat === 'STK' || (!isOptionTrade(trade) && !isForexTrade(trade));
}

function isForexTrade(trade) {
  const cat = (trade.assetCategory || '').toUpperCase();
  return cat === 'CASH' || cat === 'FX' || cat === 'FXT';
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENZ
// ═══════════════════════════════════════════════════════════════

export function saveYearData(year, data) {
  try {
    const existing = loadAllYearData();
    existing[year] = { ...data, _savedAt: Date.now(), _version: '3.2' };
    localStorage.setItem(STORAGE_KEYS.TAX_YEAR_DATA, JSON.stringify(existing));
    return true;
  } catch (e) {
    console.error('Failed to save year data:', e);
    return false;
  }
}

export function loadAllYearData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAX_YEAR_DATA);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to load year data:', e);
    return {};
  }
}

export function loadYearData(year) {
  const all = loadAllYearData();
  return all[year] || null;
}

export function isYearLocked(year) {
  const data = loadYearData(year);
  if (!data) return false;
  const currentYear = new Date().getFullYear();
  return year < currentYear && data._savedAt;
}

export function clearAllYearData() {
  localStorage.removeItem(STORAGE_KEYS.TAX_YEAR_DATA);
  localStorage.removeItem(STORAGE_KEYS.IMPORTED_FILES);
}

export function saveImportedFileHash(filename, hash, year) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.IMPORTED_FILES) || '{}');
    existing[filename] = { hash, year, importedAt: Date.now() };
    localStorage.setItem(STORAGE_KEYS.IMPORTED_FILES, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save file hash:', e);
  }
}

export function isFileAlreadyImported(filename, hash) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.IMPORTED_FILES) || '{}');
    return existing[filename]?.hash === hash;
  } catch {
    return false;
  }
}

export function mergeYearData(year, newData) {
  const existing = loadYearData(year);
  const currentYear = new Date().getFullYear();

  if (!existing || year >= currentYear) {
    return newData;
  }

  const merged = {
    ...existing,
    ...newData,
    summary: { ...existing.summary, ...newData.summary },
    stockEvents: mergeEvents(existing.stockEvents, newData.stockEvents),
    stillhalterEvents: mergeEvents(existing.stillhalterEvents, newData.stillhalterEvents),
    termingeschaeftEvents: mergeEvents(existing.termingeschaeftEvents, newData.termingeschaeftEvents),
    dividends: mergeEvents(existing.dividends, newData.dividends, 'date'),
    interest: mergeEvents(existing.interest, newData.interest, 'date'),
    _updatedAt: Date.now(),
    _savedAt: existing._savedAt,
  };

  return merged;
}

function mergeEvents(existing = [], newEvents = [], keyField = 'symbol') {
  const map = new Map();
  [...existing, ...newEvents].forEach(e => {
    const key = e.tradeId || e.id || `${e[keyField]}_${e.date}`;
    map.set(key, e);
  });
  return Array.from(map.values());
}

// ═══════════════════════════════════════════════════════════════
// REALIZED P&L BERECHNUNG
// ═══════════════════════════════════════════════════════════════

export function calculateRealizedPnL(trades, year) {
  const yearTrades = trades.filter(t => {
    const tradeYear = new Date(t.tradeDate).getFullYear();
    return tradeYear === year;
  });

  console.log(`[TaxReport] Jahr ${year}: ${yearTrades.length} Trades gefunden`);

  const stockEvents = [];
  const stillhalterEvents = [];
  const termingeschaeftEvents = [];
  const dailyPnL = {};

  yearTrades.forEach((t, idx) => {
    const fxRate = t.fxRateToBase || 1;
    const currency = t.currency || 'EUR';

    // WICHTIG: Fallback auf proceeds wenn realizedPnL leer ist
    let realizedPnL = 0;
    if (t.realizedPnl !== undefined && t.realizedPnl !== null && t.realizedPnl !== 0) {
      realizedPnL = t.realizedPnl;
    } else if (t.proceeds !== undefined && t.proceeds !== null) {
      // Fallback: proceeds - commission als realized PnL
      realizedPnL = t.proceeds + (t.commission || 0);
    }

    const realizedPnL_EUR = toEUR(realizedPnL, fxRate, currency);

    const date = t.tradeDate;
    if (!dailyPnL[date]) {
      dailyPnL[date] = { date, stockPnL: 0, optionsPnL: 0, dividends: 0, total: 0 };
    }

    if (isStockTrade(t)) {
      stockEvents.push({
        symbol: t.symbol,
        date: t.tradeDate,
        buySell: t.buySell,
        quantity: Math.abs(t.quantity),
        realizedPnL_EUR: round2(realizedPnL_EUR),
        fxRate,
        currency,
        isin: t.isin,
        tradeId: t.tradeId,
        topf: '2_aktien',
      });
      dailyPnL[date].stockPnL += realizedPnL_EUR;
      dailyPnL[date].total += realizedPnL_EUR;
    } 
    else if (isOptionTrade(t)) {
      const isShort = t.buySell === 'SELL';
      const isOpen = t.openCloseIndicator === 'O';
      const isClose = t.openCloseIndicator === 'C';
      const isAssignment = !t.openCloseIndicator || t.openCloseIndicator === '' || (t.notes && t.notes.includes('A'));

      if (isAssignment) {
        // Assignment: Prämie geht in Aktien-Cost-Basis
        console.log(`[TaxReport] Assignment erkannt: ${t.symbol} am ${t.tradeDate}`);
        return;
      }

      if (isShort) {
        // Short-Option (Stillhalter) → Topf 1
        stillhalterEvents.push({
          symbol: t.symbol,
          underlying: t.underlyingSymbol || t.symbol,
          date: t.tradeDate,
          buySell: t.buySell,
          openClose: t.openCloseIndicator,
          quantity: Math.abs(t.quantity),
          realizedPnL_EUR: round2(realizedPnL_EUR),
          strike: t.strike,
          expiry: t.expiry,
          putCall: t.putCall,
          tradeId: t.tradeId,
          topf: '1_allgemein',
        });
        dailyPnL[date].optionsPnL += realizedPnL_EUR;
        dailyPnL[date].total += realizedPnL_EUR;
      } else {
        // Long-Option (Termingeschäft) → Topf 3
        termingeschaeftEvents.push({
          symbol: t.symbol,
          underlying: t.underlyingSymbol || t.symbol,
          date: t.tradeDate,
          buySell: t.buySell,
          openClose: t.openCloseIndicator,
          quantity: Math.abs(t.quantity),
          realizedPnL_EUR: round2(realizedPnL_EUR),
          strike: t.strike,
          expiry: t.expiry,
          putCall: t.putCall,
          tradeId: t.tradeId,
          topf: '3_termin',
        });
        dailyPnL[date].optionsPnL += realizedPnL_EUR;
        dailyPnL[date].total += realizedPnL_EUR;
      }
    }
  });

  console.log(`[TaxReport] Jahr ${year}: ${stockEvents.length} Aktien, ${stillhalterEvents.length} Stillhalter, ${termingeschaeftEvents.length} Termingeschäfte`);

  return {
    stockEvents,
    stillhalterEvents,
    termingeschaeftEvents,
    dailyPnL,
    summary: {
      stockPnL_EUR: round2(stockEvents.reduce((s, e) => s + e.realizedPnL_EUR, 0)),
      stillhalterPnL_EUR: round2(stillhalterEvents.reduce((s, e) => s + e.realizedPnL_EUR, 0)),
      termingeschaeftPnL_EUR: round2(termingeschaeftEvents.reduce((s, e) => s + e.realizedPnL_EUR, 0)),
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// VERLUSTVERRECHNUNGSTÖPFE
// ═══════════════════════════════════════════════════════════════

export function calculateToepfe(events) {
  const toepfe = {
    allgemein: { gains: 0, losses: 0, net: 0 },
    aktien: { gains: 0, losses: 0, net: 0 },
    termin: { gains: 0, losses: 0, net: 0, vortrag: 0 },
  };

  events.stillhalterEvents.forEach(e => {
    if (e.realizedPnL_EUR >= 0) toepfe.allgemein.gains += e.realizedPnL_EUR;
    else toepfe.allgemein.losses += Math.abs(e.realizedPnL_EUR);
  });

  events.stockEvents.forEach(e => {
    if (e.realizedPnL_EUR >= 0) toepfe.aktien.gains += e.realizedPnL_EUR;
    else toepfe.aktien.losses += Math.abs(e.realizedPnL_EUR);
  });

  let terminNet = 0;
  events.termingeschaeftEvents.forEach(e => {
    terminNet += e.realizedPnL_EUR;
  });

  if (terminNet >= 0) {
    toepfe.termin.gains = terminNet;
    toepfe.termin.net = terminNet;
  } else {
    const absLoss = Math.abs(terminNet);
    const verrechenbar = Math.min(absLoss, TERMINGESCHAEFTE_VERLUST_LIMIT);
    toepfe.termin.losses = absLoss;
    toepfe.termin.net = -verrechenbar;
    toepfe.termin.vortrag = absLoss - verrechenbar;
  }

  toepfe.allgemein.net = toepfe.allgemein.gains - toepfe.allgemein.losses;
  toepfe.aktien.net = toepfe.aktien.gains - toepfe.aktien.losses;

  return {
    allgemein: { ...toepfe.allgemein, net: round2(toepfe.allgemein.net) },
    aktien: { ...toepfe.aktien, net: round2(toepfe.aktien.net) },
    termin: { 
      gains: round2(toepfe.termin.gains), 
      losses: round2(toepfe.termin.losses), 
      net: round2(toepfe.termin.net),
      vortrag: round2(toepfe.termin.vortrag) 
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// DIVIDENDEN & ZINSEN
// ═══════════════════════════════════════════════════════════════

export function calculateDividends(parsedData, year) {
  return parsedData.allDividends?.filter(d => {
    const divYear = new Date(d.date).getFullYear();
    return divYear === year;
  }).map(d => ({
    symbol: d.symbol,
    description: d.description,
    date: d.date,
    amountEUR: round2(d.amountEUR || toEUR(d.amount, d.fxRate, d.currency)),
    withholdingTaxEUR: round2(toEUR(d.withholdingTax || 0, d.fxRate, d.currency)),
    fxRate: d.fxRate || 1,
    currency: d.currency || 'EUR',
    isin: d.isin,
  })) || [];
}

export function calculateInterest(parsedData, year) {
  return parsedData.allInterest?.filter(i => {
    const iYear = new Date(i.date).getFullYear();
    return iYear === year;
  }).map(i => ({
    date: i.date,
    amountEUR: round2(i.amountEUR || toEUR(i.amount, i.fxRate, i.currency)),
    description: i.description,
  })) || [];
}

// ═══════════════════════════════════════════════════════════════
// STEUERBERECHNUNG
// ═══════════════════════════════════════════════════════════════

export function calculateGermanTaxes({
  toepfe,
  dividends_EUR = [],
  interest_EUR = [],
  churchTaxKey = 'none',
  isJointAccount = false,
  sparerPauschbetragUsed = 0,
}) {
  const sparerPauschbetrag = isJointAccount ? 2000 : 1000;

  const totalDividends = dividends_EUR.reduce((s, d) => s + d.amountEUR, 0);
  const totalInterest = interest_EUR.reduce((s, i) => s + i.amountEUR, 0);
  const totalWithholdingTax = dividends_EUR.reduce((s, d) => s + d.withholdingTaxEUR, 0);

  const totalGains = toepfe.allgemein.net + toepfe.aktien.net + toepfe.termin.net + totalDividends + totalInterest;

  const remainingAllowance = Math.max(0, sparerPauschbetrag - sparerPauschbetragUsed);
  const usedAllowance = Math.min(Math.max(0, totalGains), remainingAllowance);
  const taxableGains = Math.max(0, totalGains - usedAllowance);

  const abgeltung = taxableGains * TAX_RATES.abgeltungsteuer;
  const soli = abgeltung * TAX_RATES.soli;
  const kirchensteuerRate = TAX_RATES.kirchensteuer[churchTaxKey] || 0;
  const kirchensteuer = abgeltung * kirchensteuerRate;

  const totalTax = abgeltung + soli + kirchensteuer;
  const netGain = totalGains - totalTax;
  const anrechenbareQSt = Math.min(totalWithholdingTax, abgeltung);

  return {
    totalGains: round2(totalGains),
    sparerPauschbetrag,
    usedAllowance: round2(usedAllowance),
    taxableGains: round2(taxableGains),
    abgeltungsteuer: round2(abgeltung),
    soli: round2(soli),
    kirchensteuer: round2(kirchensteuer),
    totalTax: round2(totalTax),
    netGain: round2(netGain),
    totalWithholdingTax: round2(totalWithholdingTax),
    anrechenbareQSt: round2(anrechenbareQSt),
    effectiveTaxRate: totalGains > 0 ? round2((totalTax / totalGains) * 100) : 0,
    toepfe: {
      allgemein: toepfe.allgemein,
      aktien: toepfe.aktien,
      termin: toepfe.termin,
    },
    kapZeilen: {
      z7: round2(totalDividends),
      z8: round2(Math.max(0, toepfe.aktien.net)),
      z9: round2(Math.min(0, toepfe.aktien.net)),
      z12: round2(Math.max(0, toepfe.allgemein.net) + Math.max(0, toepfe.termin.net)),
      z13: round2(Math.min(0, toepfe.allgemein.net) + Math.min(0, toepfe.termin.net)),
      z14: round2(totalInterest),
      z41: round2(anrechenbareQSt),
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// JAHRESBERICHT
// ═══════════════════════════════════════════════════════════════

export function generateAnnualReport(parsedData, year, taxOptions = {}) {
  const trades = parsedData.allTrades || [];

  console.log(`[TaxReport] Generiere Report für ${year} mit ${trades.length} Trades`);

  const realized = calculateRealizedPnL(trades, year);
  const toepfe = calculateToepfe(realized);
  const dividends = calculateDividends(parsedData, year);
  const interest = calculateInterest(parsedData, year);

  const tax = calculateGermanTaxes({
    toepfe,
    dividends_EUR: dividends,
    interest_EUR: interest,
    ...taxOptions,
  });

  const dailyBreakdown = Object.values(realized.dailyPnL)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      stockPnL: round2(d.stockPnL),
      optionsPnL: round2(d.optionsPnL),
      dividends: round2(d.dividends),
      total: round2(d.total),
    }));

  const report = {
    year,
    summary: {
      totalTrades: trades.filter(t => new Date(t.tradeDate).getFullYear() === year).length,
      stockTrades: realized.stockEvents.length,
      optionTrades: realized.stillhalterEvents.length + realized.termingeschaeftEvents.length,
      stockPnL_EUR: realized.summary.stockPnL_EUR,
      stillhalterPnL_EUR: realized.summary.stillhalterPnL_EUR,
      termingeschaeftPnL_EUR: realized.summary.termingeschaeftPnL_EUR,
      totalOptionsPnL_EUR: round2(realized.summary.stillhalterPnL_EUR + realized.summary.termingeschaeftPnL_EUR),
      dividendIncome_EUR: round2(dividends.reduce((s, d) => s + d.amountEUR, 0)),
      interestIncome_EUR: round2(interest.reduce((s, i) => s + i.amountEUR, 0)),
      totalRealizedPnL_EUR: round2(realized.summary.stockPnL_EUR + realized.summary.stillhalterPnL_EUR + realized.summary.termingeschaeftPnL_EUR),
    },
    toepfe: tax.toepfe,
    kapZeilen: tax.kapZeilen,
    tax,
    dailyBreakdown,
    stockEvents: realized.stockEvents,
    stillhalterEvents: realized.stillhalterEvents,
    termingeschaeftEvents: realized.termingeschaeftEvents,
    dividends,
    interest,
  };

  const merged = mergeYearData(year, report);
  saveYearData(year, merged);

  return report;
}

export function generateMultiYearReport(parsedData, years, taxOptions = {}) {
  return years.map(year => generateAnnualReport(parsedData, year, taxOptions));
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export function exportTaxCSV(report) {
  const rows = [
    ['Datum', 'Einkommensart', 'Symbol', 'ISIN', 'Menge', 'Realisiert_EUR', 'FX_Rate', 'Waehrung', 'Topf', 'KAP-Zeile'],
  ];

  report.stockEvents?.forEach(e => {
    rows.push([
      e.date, 'Aktienverkauf', e.symbol, e.isin || '', e.quantity,
      e.realizedPnL_EUR.toFixed(2), e.fxRate.toFixed(4), e.currency,
      'Topf 2 (Aktien)', e.realizedPnL_EUR >= 0 ? 'Z. 8' : 'Z. 9',
    ]);
  });

  report.stillhalterEvents?.forEach(e => {
    rows.push([
      e.date, `Stillhalter ${e.putCall}`, e.underlying, '', e.quantity,
      e.realizedPnL_EUR.toFixed(2), '', '', 'Topf 1 (Allgemein)', 'Z. 12',
    ]);
  });

  report.termingeschaeftEvents?.forEach(e => {
    rows.push([
      e.date, `Termingeschaeft ${e.putCall}`, e.underlying, '', e.quantity,
      e.realizedPnL_EUR.toFixed(2), '', '', 'Topf 3 (Termin)', e.realizedPnL_EUR >= 0 ? 'Z. 12' : 'Z. 13',
    ]);
  });

  report.dividends?.forEach(d => {
    rows.push([
      d.date, 'Dividende', d.symbol, d.isin || '', '',
      d.amountEUR.toFixed(2), d.fxRate.toFixed(4), d.currency, '-', 'Z. 7',
    ]);
  });

  report.interest?.forEach(i => {
    rows.push([
      i.date, 'Zinsen', '', '', '',
      i.amountEUR.toFixed(2), '', 'EUR', '-', 'Z. 14',
    ]);
  });

  rows.push([]);
  rows.push(['KAP-Zeile', 'Beschreibung', 'Betrag_EUR']);
  Object.entries(report.kapZeilen || {}).forEach(([zeile, betrag]) => {
    const beschreibung = {
      z7: 'Bardividenden', z8: 'Aktiengewinne', z9: 'Aktienverluste/Vorabpauschale',
      z12: 'Optionsgewinne', z13: 'Optionsverluste', z14: 'Zinsen', z41: 'Quellensteuer',
    }[zeile] || zeile;
    rows.push([zeile, beschreibung, betrag.toFixed(2)]);
  });

  return rows.map(r => r.join(';')).join('\n');
}

export function exportTaxJSON(report) {
  return JSON.stringify({
    year: report.year,
    summary: report.summary,
    kapZeilen: report.kapZeilen,
    tax: {
      totalGains: report.tax.totalGains,
      taxableGains: report.tax.taxableGains,
      abgeltungsteuer: report.tax.abgeltungsteuer,
      soli: report.tax.soli,
      kirchensteuer: report.tax.kirchensteuer,
      totalTax: report.tax.totalTax,
      netGain: report.tax.netGain,
      anrechenbareQSt: report.tax.anrechenbareQSt,
    },
    toepfe: report.toepfe,
    dailyBreakdown: report.dailyBreakdown,
    eventCounts: {
      stock: report.stockEvents?.length || 0,
      stillhalter: report.stillhalterEvents?.length || 0,
      termingeschaeft: report.termingeschaeftEvents?.length || 0,
      dividends: report.dividends?.length || 0,
      interest: report.interest?.length || 0,
    },
  }, null, 2);
}

export function generateTaxReportHTML(report, options = {}) {
  const {
    taxpayerName = '',
    taxId = '',
    churchTaxKey = 'none',
    isJointAccount = false,
    spouseName = '',
  } = options;

  const formatEUR = (n) => `€${(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

  const kirchensteuerText = {
    none: 'keine',
    bw_bayern: '8% (BW/Bayern)',
    other: '9% (andere Bundesländer)',
  }[churchTaxKey] || 'keine';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Steuerbericht ${report.year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; color: #333; line-height: 1.5; }
    .page { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 3px solid #1a5f2a; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1a5f2a; font-size: 28px; margin-bottom: 5px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .taxpayer-info { background: #f8f9fa; border-left: 4px solid #1a5f2a; padding: 15px 20px; margin-bottom: 25px; }
    .taxpayer-info h3 { color: #1a5f2a; margin-bottom: 10px; font-size: 16px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 13px; }
    .info-grid .label { color: #666; }
    .info-grid .value { font-weight: 600; }
    .section { margin-bottom: 25px; }
    .section h2 { color: #1a5f2a; font-size: 18px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 15px; }
    .kap-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .kap-table th { background: #1a5f2a; color: white; text-align: left; padding: 10px 12px; font-weight: 600; }
    .kap-table td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; }
    .kap-table tr:nth-child(even) { background: #f8f9fa; }
    .kap-table .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
    .kap-table .positive { color: #1a5f2a; }
    .kap-table .negative { color: #c0392b; }
    .summary-box { background: #1a5f2a; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .summary-box h3 { font-size: 16px; margin-bottom: 12px; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; }
    .summary-grid .row { display: flex; justify-content: space-between; }
    .summary-grid .total { border-top: 2px solid rgba(255,255,255,0.3); padding-top: 8px; margin-top: 8px; font-size: 16px; font-weight: 700; }
    .warning-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 15px; margin: 15px 0; font-size: 13px; }
    .warning-box strong { color: #856404; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #999; text-align: center; }
    .event-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    .event-table th { background: #e8f5e9; color: #1a5f2a; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 10px; text-transform: uppercase; }
    .event-table td { padding: 6px 8px; border-bottom: 1px solid #eee; }
    .event-table tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-topf1 { background: #e3f2fd; color: #1565c0; }
    .badge-topf2 { background: #f3e5f5; color: #7b1fa2; }
    .badge-topf3 { background: #fff3e0; color: #e65100; }
    .page-break { page-break-after: always; }
    @media print {
      body { background: white; }
      .page { box-shadow: none; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>📊 Steuerbericht Kapitalerträge</h1>
      <div class="subtitle">Anlage KAP – Steuerjahr ${report.year}</div>
    </div>

    <div class="taxpayer-info">
      <h3>📝 Steuerpflichtiger</h3>
      <div class="info-grid">
        <div><span class="label">Name:</span> <span class="value">${taxpayerName || 'Nicht angegeben'}</span></div>
        <div><span class="label">Steuer-ID:</span> <span class="value">${taxId || 'Nicht angegeben'}</span></div>
        <div><span class="label">Steuerjahr:</span> <span class="value">${report.year}</span></div>
        <div><span class="label">Kirchensteuer:</span> <span class="value">${kirchensteuerText}</span></div>
        ${isJointAccount ? `<div><span class="label">Kontoart:</span> <span class="value">Gemeinschaftskonto (50/50)</span></div><div><span class="label">Ehegatte:</span> <span class="value">${spouseName || 'Nicht angegeben'}</span></div>` : '<div><span class="label">Kontoart:</span> <span class="value">Einzelkonto</span></div>'}
      </div>
    </div>

    <div class="section">
      <h2>📋 Anlage KAP – Zeilenübersicht</h2>
      <table class="kap-table">
        <thead>
          <tr><th>Zeile</th><th>Beschreibung</th><th class="amount">Betrag (EUR)</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Z. 7</strong></td><td>Bardividenden</td><td class="amount ${report.kapZeilen?.z7 >= 0 ? 'positive' : 'negative'}">${formatEUR(report.kapZeilen?.z7)}</td></tr>
          <tr><td><strong>Z. 8</strong></td><td>Gewinne aus Aktienverkauf</td><td class="amount positive">${formatEUR(report.kapZeilen?.z8)}</td></tr>
          <tr><td><strong>Z. 9</strong></td><td>Verluste aus Aktienverkauf / ETF Vorabpauschale</td><td class="amount negative">${formatEUR(report.kapZeilen?.z9)}</td></tr>
          <tr><td><strong>Z. 12</strong></td><td>Gewinne aus Optionen (Stillhalter + Termingeschäfte)</td><td class="amount positive">${formatEUR(report.kapZeilen?.z12)}</td></tr>
          <tr><td><strong>Z. 13</strong></td><td>Verluste aus Optionen §20 Abs. 6</td><td class="amount negative">${formatEUR(report.kapZeilen?.z13)}</td></tr>
          <tr><td><strong>Z. 14</strong></td><td>Zinserträge</td><td class="amount positive">${formatEUR(report.kapZeilen?.z14)}</td></tr>
          <tr style="background:#e8f5e9;"><td><strong>Z. 41</strong></td><td>Anrechenbare ausländische Quellensteuer</td><td class="amount positive">${formatEUR(report.kapZeilen?.z41)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>📊 Verlustverrechnungstöpfe</h2>
      <table class="kap-table">
        <thead>
          <tr><th>Topf</th><th>Gewinne</th><th>Verluste</th><th>Saldo</th><th>Hinweis</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="badge badge-topf1">Topf 1</span> Allgemein</td>
            <td class="amount positive">${formatEUR(report.toepfe?.allgemein?.gains)}</td>
            <td class="amount negative">${formatEUR(report.toepfe?.allgemein?.losses)}</td>
            <td class="amount ${report.toepfe?.allgemein?.net >= 0 ? 'positive' : 'negative'}">${formatEUR(report.toepfe?.allgemein?.net)}</td>
            <td>Stillhalter, Zinsen</td>
          </tr>
          <tr>
            <td><span class="badge badge-topf2">Topf 2</span> Aktien</td>
            <td class="amount positive">${formatEUR(report.toepfe?.aktien?.gains)}</td>
            <td class="amount negative">${formatEUR(report.toepfe?.aktien?.losses)}</td>
            <td class="amount ${report.toepfe?.aktien?.net >= 0 ? 'positive' : 'negative'}">${formatEUR(report.toepfe?.aktien?.net)}</td>
            <td>Aktienveräußerungen</td>
          </tr>
          <tr>
            <td><span class="badge badge-topf3">Topf 3</span> Termingeschäfte</td>
            <td class="amount positive">${formatEUR(report.toepfe?.termin?.gains)}</td>
            <td class="amount negative">${formatEUR(report.toepfe?.termin?.losses)}</td>
            <td class="amount ${report.toepfe?.termin?.net >= 0 ? 'positive' : 'negative'}">${formatEUR(report.toepfe?.termin?.net)}</td>
            <td>Long-Optionen (max. €20k Verlust)</td>
          </tr>
        </tbody>
      </table>
      ${report.toepfe?.termin?.vortrag > 0 ? `
      <div class="warning-box">
        <strong>⚠️ Verlustvortrag Termingeschäfte:</strong> 
        ${formatEUR(report.toepfe.termin.vortrag)} können nicht im laufenden Jahr verrechnet werden und werden ins Folgejahr übertragen (§20 Abs. 6 Satz 5 EStG).
      </div>` : ''}
    </div>

    <div class="summary-box">
      <h3>💰 Steuerliche Zusammenfassung</h3>
      <div class="summary-grid">
        <div class="row"><span>Gesamte Kapitalerträge:</span><span>${formatEUR(report.tax?.totalGains)}</span></div>
        <div class="row"><span>Genutzter Sparer-Pauschbetrag:</span><span>${formatEUR(report.tax?.usedAllowance)}</span></div>
        <div class="row"><span>Steuerpflichtige Erträge:</span><span>${formatEUR(report.tax?.taxableGains)}</span></div>
        <div class="row"><span>Abgeltungsteuer (25%):</span><span>${formatEUR(report.tax?.abgeltungsteuer)}</span></div>
        <div class="row"><span>Solidaritätszuschlag (5,5%):</span><span>${formatEUR(report.tax?.soli)}</span></div>
        <div class="row"><span>Kirchensteuer:</span><span>${formatEUR(report.tax?.kirchensteuer)}</span></div>
        <div class="row"><span>Anrechenbare Quellensteuer:</span><span style="color:#90EE90">-${formatEUR(report.tax?.anrechenbareQSt)}</span></div>
        <div class="row total"><span>Gesamtsteuerlast:</span><span>${formatEUR(report.tax?.totalTax)}</span></div>
        <div class="row total" style="margin-top:5px;"><span>Netto nach Steuern:</span><span style="font-size:18px;">${formatEUR(report.tax?.netGain)}</span></div>
      </div>
    </div>

    ${report.summary?.termingschaeftPnL_EUR < -20000 ? `
    <div class="warning-box">
      <strong>⚠️ Hinweis:</strong> Ihre Termingeschäftsverluste übersteigen die jährliche Verrechnungsgrenze von €20.000. 
      Der nicht verrechenbare Teil wird als Verlustvortrag ins nächste Steuerjahr übertragen.
    </div>` : ''}

    <div class="footer">
      <p>Erstellt mit MomentumTrader DE – Steuerbericht ${report.year}</p>
      <p>Dieser Bericht dient als Orientierung. Bitte gegen die offizielle CapTrader-Steuerbescheinigung prüfen.</p>
      <p>Generiert am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}</p>
    </div>
  </div>

  ${report.stockEvents?.length > 0 ? `
  <div class="page page-break">
    <div class="header">
      <h1>📈 Aktiengeschäfte – Einzelnachweis</h1>
      <div class="subtitle">Steuerjahr ${report.year} – FIFO nach § 20 Abs. 4 Satz 7 EStG</div>
    </div>
    <table class="event-table">
      <thead>
        <tr><th>Datum</th><th>Symbol</th><th>ISIN</th><th>Typ</th><th>Menge</th><th>Realisiert</th><th>Topf</th></tr>
      </thead>
      <tbody>
        ${report.stockEvents.map(e => `
        <tr>
          <td>${formatDate(e.date)}</td>
          <td><strong>${e.symbol}</strong></td>
          <td>${e.isin || '-'}</td>
          <td>${e.buySell === 'SELL' ? 'Verkauf' : 'Kauf'}</td>
          <td>${e.quantity}</td>
          <td class="amount ${e.realizedPnL_EUR >= 0 ? 'positive' : 'negative'}">${formatEUR(e.realizedPnL_EUR)}</td>
          <td><span class="badge badge-topf2">Topf 2</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${report.stillhalterEvents?.length > 0 ? `
  <div class="page page-break">
    <div class="header">
      <h1>🎯 Stillhaltergeschäfte – Einzelnachweis</h1>
      <div class="subtitle">Steuerjahr ${report.year} – § 20 Abs. 1 Nr. 11 EStG (Topf 1)</div>
    </div>
    <table class="event-table">
      <thead>
        <tr><th>Datum</th><th>Underlying</th><th>Strike</th><th>Typ</th><th>Menge</th><th>Realisiert</th></tr>
      </thead>
      <tbody>
        ${report.stillhalterEvents.map(e => `
        <tr>
          <td>${formatDate(e.date)}</td>
          <td><strong>${e.underlying}</strong> ${e.putCall}</td>
          <td>${e.strike || '-'}</td>
          <td>${e.openClose === 'O' ? 'Eröffnung' : e.openClose === 'C' ? 'Glattstellung' : 'Verfall'}</td>
          <td>${e.quantity}</td>
          <td class="amount ${e.realizedPnL_EUR >= 0 ? 'positive' : 'negative'}">${formatEUR(e.realizedPnL_EUR)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${report.termingeschaeftEvents?.length > 0 ? `
  <div class="page page-break">
    <div class="header">
      <h1>📉 Termingeschäfte – Einzelnachweis</h1>
      <div class="subtitle">Steuerjahr ${report.year} – § 20 Abs. 6 EStG (Topf 3)</div>
    </div>
    <table class="event-table">
      <thead>
        <tr><th>Datum</th><th>Underlying</th><th>Strike</th><th>Typ</th><th>Menge</th><th>Realisiert</th></tr>
      </thead>
      <tbody>
        ${report.termingeschaeftEvents.map(e => `
        <tr>
          <td>${formatDate(e.date)}</td>
          <td><strong>${e.underlying}</strong> ${e.putCall}</td>
          <td>${e.strike || '-'}</td>
          <td>${e.openClose === 'O' ? 'Eröffnung' : 'Glattstellung'}</td>
          <td>${e.quantity}</td>
          <td class="amount ${e.realizedPnL_EUR >= 0 ? 'positive' : 'negative'}">${formatEUR(e.realizedPnL_EUR)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${report.dividends?.length > 0 ? `
  <div class="page page-break">
    <div class="header">
      <h1>💵 Dividenden – Einzelnachweis</h1>
      <div class="subtitle">Steuerjahr ${report.year} – Z. 7 Anlage KAP</div>
    </div>
    <table class="event-table">
      <thead>
        <tr><th>Datum</th><th>Symbol</th><th>ISIN</th><th>Brutto</th><th>Quellensteuer</th><th>Netto</th></tr>
      </thead>
      <tbody>
        ${report.dividends.map(d => `
        <tr>
          <td>${formatDate(d.date)}</td>
          <td><strong>${d.symbol}</strong></td>
          <td>${d.isin || '-'}</td>
          <td class="amount">${formatEUR(d.amountEUR)}</td>
          <td class="amount negative">${formatEUR(d.withholdingTaxEUR)}</td>
          <td class="amount">${formatEUR(d.amountEUR - d.withholdingTaxEUR)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}
</body>
</html>`;
}

export function exportTaxReportHTML(report, options = {}) {
  return generateTaxReportHTML(report, options);
}
