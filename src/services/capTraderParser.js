/**
 * CapTrader / IBKR Flex Query XML Parser v3 – GENERISCH
 * Parst ALLE in der Flex Query möglichen Cash Transactions
 * 
 * v3 Änderungen:
 * - Generische Cash Transaction Verarbeitung (alle activityCodes)
 * - Automatische Klassifizierung nach Steuerkategorien
 * - Erweiterbar für CFD, Forex, Crypto, Zertifikate ohne Parser-Änderung
 * - Mapping: activityCode → { type, taxCategory, description }
 */

function getAttr(el, name, fallback = '') {
  return el.getAttribute(name) ?? fallback;
}

function parseNumber(val) {
  if (!val || val === '') return 0;
  return parseFloat(val);
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY CODE MAPPING – Erweiterbar für neue Einkunftsarten
// ═══════════════════════════════════════════════════════════════

/**
 * Mapping aller bekannten IBKR Activity Codes zu Steuerkategorien.
 * Neue Codes können einfach hier hinzugefügt werden –
 * der Parser selbst muss nicht geändert werden.
 */
const ACTIVITY_CODE_MAP = {
  // === DIVIDENDEN ===
  DIV:  { type: 'dividend',     taxCategory: 'KAP_Z7',   description: 'Dividende' },
  DIVC: { type: 'dividend',     taxCategory: 'KAP_Z7',   description: 'Dividende (korrigiert)' },
  DIVN: { type: 'dividend',     taxCategory: 'KAP_Z7',   description: 'Dividende (Netto)' },
  DIVS: { type: 'dividend',     taxCategory: 'KAP_Z7',   description: 'Dividende (Sonder)' },

  // === QUELLENSTEUER ===
  WHT:  { type: 'withholding',  taxCategory: 'KAP_Z41',  description: 'Quellensteuer' },
  WHTX: { type: 'withholding',  taxCategory: 'KAP_Z41',  description: 'Quellensteuer (korrigiert)' },

  // === ZINSEN ===
  BINT: { type: 'interest',     taxCategory: 'KAP_Z14',  description: 'Broker-Zinsen' },
  INT:  { type: 'interest',     taxCategory: 'KAP_Z14',  description: 'Zinsen' },
  INTN: { type: 'interest',     taxCategory: 'KAP_Z14',  description: 'Zinsen (Netto)' },
  MI:   { type: 'interest',     taxCategory: 'KAP_Z14',  description: 'Margin Interest' },

  // === EIN-/AUSZAHLUNGEN ===
  DEP:  { type: 'deposit',      taxCategory: 'NONE',     description: 'Einzahlung' },
  WDR:  { type: 'withdrawal',   taxCategory: 'NONE',     description: 'Auszahlung' },

  // === GEBÜHREN & KOSTEN ===
  FEE:  { type: 'fee',          taxCategory: 'KAP_Z9',   description: 'Gebühr' },
  COM:  { type: 'commission',   taxCategory: 'KAP_Z9',   description: 'Provision' },
  TAX:  { type: 'tax',          taxCategory: 'KAP_Z9',   description: 'Steuer' },

  // === CORPORATE ACTIONS ===
  CA:   { type: 'corporate',    taxCategory: 'KAP_Z8',   description: 'Corporate Action' },
  SP:   { type: 'corporate',    taxCategory: 'KAP_Z8',   description: 'Stock Split' },

  // === FOREX / CFD / CRYPTO (Erweiterbar) ===
  FX:   { type: 'forex',        taxCategory: 'ANLAGE_SO', description: 'Devisengeschäft' },
  FXT:  { type: 'forex',        taxCategory: 'ANLAGE_SO', description: 'Forex Trade' },
  CFD:  { type: 'cfd',          taxCategory: 'KAP_Z12',  description: 'CFD-Geschäft' },
  CRY:  { type: 'crypto',       taxCategory: 'KAP_Z12',  description: 'Kryptohandel' },

  // === SONSTIGES ===
  ADJ:  { type: 'adjustment',   taxCategory: 'KAP_Z9',   description: 'Anpassung' },
  OTH:  { type: 'other',        taxCategory: 'NONE',     description: 'Sonstiges' },

  // Fallback für unbekannte Codes
  _DEFAULT: { type: 'unknown',  taxCategory: 'NONE',     description: 'Unbekannt' },
};

/**
 * Gibt die Klassifizierung für einen Activity Code zurück
 */
function classifyActivityCode(code) {
  if (!code) return ACTIVITY_CODE_MAP._DEFAULT;
  return ACTIVITY_CODE_MAP[code] || { 
    type: 'unknown', 
    taxCategory: 'NONE', 
    description: `Unbekannt (${code})` 
  };
}

/**
 * Asset Category Mapping für Steuerklassifizierung
 */
const ASSET_CATEGORY_MAP = {
  STK:  { name: 'Aktien',         taxCategory: 'KAP_Z8' },
  OPT:  { name: 'Optionen',       taxCategory: 'KAP_Z12' },
  FUT:  { name: 'Futures',        taxCategory: 'KAP_Z12' },
  CFD:  { name: 'CFD',            taxCategory: 'KAP_Z12' },
  FOP:  { name: 'Future-Option',  taxCategory: 'KAP_Z12' },
  WAR:  { name: 'Zertifikat',     taxCategory: 'KAP_Z12' },
  BOND: { name: 'Anleihe',        taxCategory: 'KAP_Z14' },
  FUND: { name: 'Fonds',          taxCategory: 'KAP_Z7' },
  CASH: { name: 'Cash',           taxCategory: 'NONE' },
  CMDTY:{ name: 'Rohstoff',       taxCategory: 'KAP_Z12' },
  IOPT: { name: 'Index-Option',   taxCategory: 'KAP_Z12' },
};

// ═══════════════════════════════════════════════════════════════
// HAUPT-PARSER
// ═══════════════════════════════════════════════════════════════

export function parseFlexStatement(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML Parse Error: ' + parserError.textContent);
  }

  const stmt = doc.querySelector('FlexStatement');
  if (!stmt) throw new Error('Kein FlexStatement in XML gefunden');

  const accountId = getAttr(stmt, 'accountId');
  const fromDate = getAttr(stmt, 'fromDate');
  const toDate = getAttr(stmt, 'toDate');

  // === ACCOUNT INFORMATION ===
  const accountInfo = {
    accountId,
    accountName: getAttr(stmt.querySelector('AccountInformation'), 'name'),
    accountType: getAttr(stmt.querySelector('AccountInformation'), 'accountType'),
    currency: getAttr(stmt.querySelector('AccountInformation'), 'currency'),
    fromDate,
    toDate,
    generated: getAttr(stmt, 'whenGenerated'),
  };

  // === OPEN POSITIONS (alle Asset Classes) ===
  const openPositions = [];
  const openPosEls = stmt.querySelectorAll('OpenPosition');
  for (const el of openPosEls) {
    const assetCategory = getAttr(el, 'assetCategory');

    openPositions.push({
      accountId: getAttr(el, 'accountId'),
      symbol: getAttr(el, 'symbol'),
      description: getAttr(el, 'description'),
      isin: getAttr(el, 'isin'),
      conid: getAttr(el, 'conid'),
      assetCategory,
      subCategory: getAttr(el, 'subCategory'),
      quantity: parseNumber(getAttr(el, 'position')),
      marketPrice: parseNumber(getAttr(el, 'markPrice')),
      marketValue: parseNumber(getAttr(el, 'positionValue')),
      costBasisPrice: parseNumber(getAttr(el, 'costBasisPrice')),
      costBasisMoney: parseNumber(getAttr(el, 'costBasisMoney')),
      unrealizedPnl: parseNumber(getAttr(el, 'fifoPnlUnrealized')),
      side: getAttr(el, 'side'),
      currency: getAttr(el, 'currency'),
      fxRateToBase: parseNumber(getAttr(el, 'fxRateToBase')),
      listingExchange: getAttr(el, 'listingExchange'),
      openDateTime: getAttr(el, 'openDateTime'),
      percentOfNAV: parseNumber(getAttr(el, 'percentOfNAV')),
      // Derivative-Details
      strike: parseNumber(getAttr(el, 'strike')) || null,
      expiry: getAttr(el, 'expiry') || null,
      putCall: getAttr(el, 'putCall') || null,
      multiplier: parseNumber(getAttr(el, 'multiplier')) || 1,
      underlyingSymbol: getAttr(el, 'underlyingSymbol') || null,
    });
  }

  // === TRADES (alle Asset Classes) ===
  const trades = [];
  const tradeEls = stmt.querySelectorAll('Trade');
  for (const el of tradeEls) {
    const assetCategory = getAttr(el, 'assetCategory');

    trades.push({
      accountId: getAttr(el, 'accountId'),
      tradeId: getAttr(el, 'tradeID'),
      symbol: getAttr(el, 'symbol'),
      description: getAttr(el, 'description'),
      isin: getAttr(el, 'isin'),
      conid: getAttr(el, 'conid'),
      assetCategory,
      subCategory: getAttr(el, 'subCategory'),
      buySell: getAttr(el, 'buySell'),
      quantity: parseNumber(getAttr(el, 'quantity')),
      tradePrice: parseNumber(getAttr(el, 'tradePrice')),
      tradeMoney: parseNumber(getAttr(el, 'tradeMoney')),
      proceeds: parseNumber(getAttr(el, 'proceeds')),
      commission: parseNumber(getAttr(el, 'ibCommission')),
      commissionCurrency: getAttr(el, 'ibCommissionCurrency'),
      netCash: parseNumber(getAttr(el, 'netCash')),
      currency: getAttr(el, 'currency'),
      fxRateToBase: parseNumber(getAttr(el, 'fxRateToBase')),
      tradeDate: getAttr(el, 'tradeDate'),
      settleDate: getAttr(el, 'settleDateTarget'),
      orderId: getAttr(el, 'ibOrderID'),
      transactionType: getAttr(el, 'transactionType'),
      exchange: getAttr(el, 'exchange'),
      openCloseIndicator: getAttr(el, 'openCloseIndicator'),
      notes: getAttr(el, 'notes'),
      // Derivative-Details
      strike: parseNumber(getAttr(el, 'strike')) || null,
      expiry: getAttr(el, 'expiry') || null,
      putCall: getAttr(el, 'putCall') || null,
      multiplier: parseNumber(getAttr(el, 'multiplier')) || 1,
      underlyingSymbol: getAttr(el, 'underlyingSymbol') || null,
      // P&L
      realizedPnl: parseNumber(getAttr(el, 'fifoPnlRealized')),
      mtmPnl: parseNumber(getAttr(el, 'mtmPnl')),
    });
  }

  // === STATEMENT OF FUNDS – GENERISCH ===
  // Parst ALLE Zeilen unabhängig vom activityCode
  const funds = [];
  const fundEls = stmt.querySelectorAll('StatementOfFundsLine');
  for (const el of fundEls) {
    const levelOfDetail = getAttr(el, 'levelOfDetail');
    if (levelOfDetail !== 'BaseCurrency') continue;

    const activityCode = getAttr(el, 'activityCode');
    const classification = classifyActivityCode(activityCode);
    const amount = parseNumber(getAttr(el, 'amount'));
    const fxRate = parseNumber(getAttr(el, 'fxRateToBase'));
    const currency = getAttr(el, 'currency');

    funds.push({
      // Identifikation
      accountId: getAttr(el, 'accountId'),
      transactionId: getAttr(el, 'transactionID'),
      actionId: getAttr(el, 'actionID'),

      // Klassifizierung
      activityCode,
      activityDescription: getAttr(el, 'activityDescription'),
      type: classification.type,
      taxCategory: classification.taxCategory,

      // Wertpapiere
      symbol: getAttr(el, 'symbol'),
      isin: getAttr(el, 'isin'),
      assetCategory: getAttr(el, 'assetCategory'),
      subCategory: getAttr(el, 'subCategory'),
      description: getAttr(el, 'description'),

      // Beträge
      amount,
      amountEUR: fxRate && fxRate !== 0 ? amount / fxRate : amount,
      currency,
      fxRateToBase: fxRate,

      // Details
      debit: parseNumber(getAttr(el, 'debit')),
      credit: parseNumber(getAttr(el, 'credit')),
      balance: parseNumber(getAttr(el, 'balance')),
      tradePrice: parseNumber(getAttr(el, 'tradePrice')),
      tradeGross: parseNumber(getAttr(el, 'tradeGross')),
      commission: parseNumber(getAttr(el, 'tradeCommission')),
      tax: parseNumber(getAttr(el, 'tradeTax')),

      // Daten
      date: getAttr(el, 'date'),
      reportDate: getAttr(el, 'reportDate'),
      settleDate: getAttr(el, 'settleDate'),

      // Trade-Referenz
      tradeId: getAttr(el, 'tradeID'),
      buySell: getAttr(el, 'buySell'),
      quantity: parseNumber(getAttr(el, 'tradeQuantity')),

      // Derivative
      strike: parseNumber(getAttr(el, 'strike')) || null,
      expiry: getAttr(el, 'expiry') || null,
      putCall: getAttr(el, 'putCall') || null,
      underlyingSymbol: getAttr(el, 'underlyingSymbol') || null,
    });
  }

  // === CASH REPORT ===
  const cashReport = {};
  const cashEls = stmt.querySelectorAll('CashReportCurrency');
  for (const el of cashEls) {
    const currency = getAttr(el, 'currency');
    cashReport[currency] = {
      startingCash: parseNumber(getAttr(el, 'startingCash')),
      endingCash: parseNumber(getAttr(el, 'endingCash')),
      endingSettledCash: parseNumber(getAttr(el, 'endingSettledCash')),
      deposits: parseNumber(getAttr(el, 'deposits')),
      withdrawals: parseNumber(getAttr(el, 'withdrawals')),
      dividends: parseNumber(getAttr(el, 'dividends')),
      withholdingTax: parseNumber(getAttr(el, 'withholdingTax')),
      commissions: parseNumber(getAttr(el, 'commissions')),
      netTradesSales: parseNumber(getAttr(el, 'netTradesSales')),
      netTradesPurchases: parseNumber(getAttr(el, 'netTradesPurchases')),
      brokerInterest: parseNumber(getAttr(el, 'brokerInterest')),
      otherFees: parseNumber(getAttr(el, 'otherFees')),
    };
  }

  // === GENERISCHE CASH TRANSACTIONS ===
  // Alle Funds-Zeilen als normalisierte Cash Transactions
  const cashTransactions = funds.map(f => ({
    id: f.transactionId || f.actionId || `${f.symbol}_${f.date}_${f.activityCode}`,
    type: f.type,
    taxCategory: f.taxCategory,
    activityCode: f.activityCode,
    symbol: f.symbol,
    description: f.description || f.activityDescription,
    date: f.date,
    amount: f.amount,
    amountEUR: f.amountEUR,
    currency: f.currency,
    fxRate: f.fxRateToBase,
    assetCategory: f.assetCategory,
  }));

  // === DIVIDENDEN (aus generischen Funds gefiltert) ===
  const dividends = funds
    .filter(f => f.type === 'dividend')
    .map(div => {
      // Suche passende WHT für gleiches Symbol+Datum
      const matchingWht = funds.find(wht => 
        wht.type === 'withholding' &&
        wht.symbol === div.symbol && 
        wht.date === div.date &&
        Math.abs(wht.amount) > 0
      );

      return {
        symbol: div.symbol,
        description: div.description,
        date: div.date,
        amount: div.amount,
        amountEUR: div.amountEUR,
        currency: div.currency,
        isin: div.isin,
        fxRate: div.fxRateToBase,
        withholdingTax: matchingWht ? Math.abs(matchingWht.amount) : 0,
        withholdingTaxEUR: matchingWht ? Math.abs(matchingWht.amountEUR) : 0,
      };
    });

  // === ZINSEN (aus generischen Funds gefiltert) ===
  const interest = funds
    .filter(f => f.type === 'interest')
    .map(i => ({
      date: i.date,
      amount: i.amount,
      amountEUR: i.amountEUR,
      currency: i.currency,
      fxRate: i.fxRateToBase,
      description: i.description || i.activityDescription,
    }));

  // === STEUERRELEVANTE KATEGORIEN (automatisch gruppiert) ===
  const taxCategories = {
    KAP_Z7:  funds.filter(f => f.taxCategory === 'KAP_Z7').reduce((s, f) => s + f.amountEUR, 0),
    KAP_Z8:  funds.filter(f => f.taxCategory === 'KAP_Z8').reduce((s, f) => s + f.amountEUR, 0),
    KAP_Z9:  funds.filter(f => f.taxCategory === 'KAP_Z9').reduce((s, f) => s + f.amountEUR, 0),
    KAP_Z12: funds.filter(f => f.taxCategory === 'KAP_Z12').reduce((s, f) => s + f.amountEUR, 0),
    KAP_Z13: funds.filter(f => f.taxCategory === 'KAP_Z13').reduce((s, f) => s + f.amountEUR, 0),
    KAP_Z14: funds.filter(f => f.taxCategory === 'KAP_Z14').reduce((s, f) => s + f.amountEUR, 0),
    KAP_Z41: funds.filter(f => f.taxCategory === 'KAP_Z41').reduce((s, f) => s + f.amountEUR, 0),
    ANLAGE_SO: funds.filter(f => f.taxCategory === 'ANLAGE_SO').reduce((s, f) => s + f.amountEUR, 0),
  };

  // === UNBEKANNTE CODES (für Debugging/Erweiterung) ===
  const unknownCodes = [...new Set(
    funds.filter(f => f.type === 'unknown').map(f => f.activityCode)
  )];

  return {
    meta: {
      accountId,
      fromDate,
      toDate,
      generated: getAttr(stmt, 'whenGenerated'),
    },
    accountInformation: [accountInfo],
    openPositions,
    trades,
    funds,
    cashReport,
    cashReports: [cashReport],
    cashTransactions,
    dividends,
    interest,
    taxCategories,
    unknownCodes,
    summary: {
      totalOpenPositions: openPositions.length,
      totalTrades: trades.length,
      totalFunds: funds.length,
      totalDividends: dividends.length,
      totalInterest: interest.length,
      unknownActivityCodes: unknownCodes.length,
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// MERGE & UTILITIES
// ═══════════════════════════════════════════════════════════════

export function parseMultipleFlexQueries(xmlStrings) {
  const results = xmlStrings.map((xml, i) => {
    try {
      return parseFlexStatement(xml);
    } catch (err) {
      console.error(`Fehler beim Parsen von XML ${i}:`, err);
      return null;
    }
  }).filter(Boolean);

  if (results.length === 0) {
    throw new Error('Keine gültigen XML-Dateien gefunden');
  }

  // Merge mit Deduplizierung
  const allFunds = [];
  const fundIds = new Set();

  results.forEach(r => {
    r.funds?.forEach(f => {
      const id = f.transactionId || f.actionId || `${f.symbol}_${f.date}_${f.activityCode}_${f.amount}`;
      if (!fundIds.has(id)) {
        fundIds.add(id);
        allFunds.push(f);
      }
    });
  });

  const merged = {
    meta: results.map(r => r.meta),
    accountInformation: results.flatMap(r => r.accountInformation || []),
    openPositions: results[results.length - 1].openPositions,
    allTrades: results.flatMap(r => r.trades),
    allFunds: allFunds,
    cashReports: results.map(r => r.cashReport),
    cashTransactions: allFunds.map(f => ({
      id: f.transactionId || f.actionId || `${f.symbol}_${f.date}_${f.activityCode}`,
      type: f.type,
      taxCategory: f.taxCategory,
      activityCode: f.activityCode,
      symbol: f.symbol,
      description: f.description || f.activityDescription,
      date: f.date,
      amount: f.amount,
      amountEUR: f.amountEUR,
      currency: f.currency,
      fxRate: f.fxRateToBase,
      assetCategory: f.assetCategory,
    })),
    allDividends: results.flatMap(r => r.dividends),
    allInterest: results.flatMap(r => r.interest),
    unknownCodes: [...new Set(results.flatMap(r => r.unknownCodes || []))],
  };

  return merged;
}

export function extractUnderlyings(parsedData) {
  const symbols = new Set();
  parsedData.openPositions?.forEach(p => symbols.add(p.symbol));
  parsedData.allTrades?.forEach(t => {
    if (t.assetCategory === 'STK') symbols.add(t.symbol);
    if (t.underlyingSymbol) symbols.add(t.underlyingSymbol);
  });
  return Array.from(symbols).filter(Boolean).sort();
}

export function calculatePositionsWithCostBasis(parsedData) {
  const { openPositions, allTrades } = parsedData;

  const tradeHistory = {};
  allTrades?.forEach(t => {
    if (t.assetCategory !== 'STK') return;
    if (!tradeHistory[t.symbol]) tradeHistory[t.symbol] = [];
    tradeHistory[t.symbol].push(t);
  });

  return openPositions?.map(pos => {
    const history = tradeHistory[pos.symbol] || [];
    const buyTrades = history.filter(t => t.buySell === 'BUY').sort((a, b) => 
      new Date(a.tradeDate) - new Date(b.tradeDate)
    );

    let totalQty = 0;
    let totalCost = 0;
    buyTrades.forEach(t => {
      totalQty += Math.abs(t.quantity);
      totalCost += Math.abs(t.quantity) * t.tradePrice + Math.abs(t.commission || 0);
    });

    const avgCost = totalQty > 0 ? totalCost / totalQty : pos.costBasisPrice;
    const currentValue = pos.quantity * pos.marketPrice;
    const invested = pos.quantity * avgCost;
    const unrealized = currentValue - invested;

    return {
      ...pos,
      avgCost,
      totalInvested: invested,
      unrealizedPnl: unrealized,
      unrealizedPnlPct: invested > 0 ? (unrealized / invested) * 100 : 0,
      tradeCount: history.length,
      firstTradeDate: buyTrades[0]?.tradeDate || null,
      lastTradeDate: buyTrades[buyTrades.length - 1]?.tradeDate || null,
    };
  }) || [];
}

// ═══════════════════════════════════════════════════════════════
// ERWEITERUNGSHILFE
// ═══════════════════════════════════════════════════════════════

/**
 * Gibt alle unbekannten Activity Codes zurück –
 * nützlich um den ACTIVITY_CODE_MAP zu erweitern.
 */
export function getUnknownActivityCodes(parsedData) {
  return parsedData.unknownCodes || [];
}

/**
 * Gibt eine Zusammenfassung aller Activity Codes in den Daten zurück.
 */
export function getActivityCodeSummary(parsedData) {
  const summary = {};
  parsedData.allFunds?.forEach(f => {
    if (!summary[f.activityCode]) {
      summary[f.activityCode] = { count: 0, totalEUR: 0, type: f.type, taxCategory: f.taxCategory };
    }
    summary[f.activityCode].count++;
    summary[f.activityCode].totalEUR += f.amountEUR;
  });
  return summary;
}
