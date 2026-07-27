/**
 * CapTrader / IBKR Flex Query XML Parser
 * Parst Steuerauswertung XML in strukturierte Portfolio-/Trade-Daten
 */

function getAttr(el, name, fallback = '') {
  return el.getAttribute(name) ?? fallback;
}

function parseNumber(val) {
  if (!val || val === '') return 0;
  return parseFloat(val);
}

/**
 * Parst eine einzelne FlexStatement XML
 */
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

  // === OPEN POSITIONS ===
  const openPositions = [];
  const openPosEls = stmt.querySelectorAll('OpenPosition');
  for (const el of openPosEls) {
    const assetCategory = getAttr(el, 'assetCategory');
    if (assetCategory !== 'STK') continue;

    openPositions.push({
      accountId: getAttr(el, 'accountId'),
      symbol: getAttr(el, 'symbol'),
      description: getAttr(el, 'description'),
      isin: getAttr(el, 'isin'),
      conid: getAttr(el, 'conid'),
      assetCategory: 'STK',
      subCategory: getAttr(el, 'subCategory'),
      quantity: parseNumber(getAttr(el, 'position')),
      marketPrice: parseNumber(getAttr(el, 'markPrice')),
      marketValue: parseNumber(getAttr(el, 'positionValue')),
      costBasisPrice: parseNumber(getAttr(el, 'costBasisPrice')),
      costBasisMoney: parseNumber(getAttr(el, 'costBasisMoney')),
      unrealizedPnl: parseNumber(getAttr(el, 'fifoPnlUnrealized')),
      unrealizedPnlPct: 0,
      side: getAttr(el, 'side'),
      currency: getAttr(el, 'currency'),
      fxRateToBase: parseNumber(getAttr(el, 'fxRateToBase')),
      listingExchange: getAttr(el, 'listingExchange'),
      openDateTime: getAttr(el, 'openDateTime'),
      percentOfNAV: parseNumber(getAttr(el, 'percentOfNAV')),
    });
  }

  // === TRADES ===
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
      strike: parseNumber(getAttr(el, 'strike')) || null,
      expiry: getAttr(el, 'expiry') || null,
      putCall: getAttr(el, 'putCall') || null,
      multiplier: parseNumber(getAttr(el, 'multiplier')) || 1,
      underlyingSymbol: getAttr(el, 'underlyingSymbol') || null,
      realizedPnl: parseNumber(getAttr(el, 'fifoPnlRealized')),
      mtmPnl: parseNumber(getAttr(el, 'mtmPnl')),
    });
  }

  // === STATEMENT OF FUNDS ===
  const funds = [];
  const fundEls = stmt.querySelectorAll('StatementOfFundsLine');
  for (const el of fundEls) {
    const levelOfDetail = getAttr(el, 'levelOfDetail');
    if (levelOfDetail !== 'BaseCurrency') continue;

    funds.push({
      accountId: getAttr(el, 'accountId'),
      currency: getAttr(el, 'currency'),
      fxRateToBase: parseNumber(getAttr(el, 'fxRateToBase')),
      assetCategory: getAttr(el, 'assetCategory'),
      subCategory: getAttr(el, 'subCategory'),
      symbol: getAttr(el, 'symbol'),
      description: getAttr(el, 'description'),
      activityCode: getAttr(el, 'activityCode'),
      activityDescription: getAttr(el, 'activityDescription'),
      reportDate: getAttr(el, 'reportDate'),
      date: getAttr(el, 'date'),
      settleDate: getAttr(el, 'settleDate'),
      tradeId: getAttr(el, 'tradeID'),
      buySell: getAttr(el, 'buySell'),
      quantity: parseNumber(getAttr(el, 'tradeQuantity')),
      tradePrice: parseNumber(getAttr(el, 'tradePrice')),
      tradeGross: parseNumber(getAttr(el, 'tradeGross')),
      commission: parseNumber(getAttr(el, 'tradeCommission')),
      tax: parseNumber(getAttr(el, 'tradeTax')),
      debit: parseNumber(getAttr(el, 'debit')),
      credit: parseNumber(getAttr(el, 'credit')),
      amount: parseNumber(getAttr(el, 'amount')),
      balance: parseNumber(getAttr(el, 'balance')),
      transactionId: getAttr(el, 'transactionID'),
      actionId: getAttr(el, 'actionID'),
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

  // === DIVIDENDS ===
  const dividends = funds.filter(f => 
    f.activityCode === 'DIV' && f.assetCategory === 'STK'
  ).map(f => ({
    symbol: f.symbol,
    description: f.description,
    date: f.date,
    amount: f.amount,
    currency: f.currency,
    isin: f.isin,
    fxRate: f.fxRateToBase,
    amountEUR: f.fxRateToBase ? f.amount / f.fxRateToBase : f.amount,
  }));

  return {
    meta: {
      accountId,
      fromDate,
      toDate,
      generated: getAttr(stmt, 'whenGenerated'),
    },
    openPositions,
    trades,
    funds,
    cashReport,
    dividends,
    summary: {
      totalOpenPositions: openPositions.length,
      totalTrades: trades.length,
      totalDividends: dividends.length,
    }
  };
}

/**
 * Parst mehrere XML-Dateien und merged sie
 */
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

  const merged = {
    meta: results.map(r => r.meta),
    openPositions: results[results.length - 1].openPositions,
    allTrades: results.flatMap(r => r.trades),
    allFunds: results.flatMap(r => r.funds),
    allDividends: results.flatMap(r => r.dividends),
    cashReports: results.map(r => r.cashReport),
  };

  return merged;
}

/**
 * Extrahiert einzigartige Underlyings
 */
export function extractUnderlyings(parsedData) {
  const symbols = new Set();
  parsedData.openPositions?.forEach(p => symbols.add(p.symbol));
  parsedData.allTrades?.forEach(t => {
    if (t.assetCategory === 'STK') symbols.add(t.symbol);
    if (t.underlyingSymbol) symbols.add(t.underlyingSymbol);
  });
  return Array.from(symbols).filter(Boolean).sort();
}

/**
 * Berechnet Positionen mit Durchschnittskosten
 */
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
