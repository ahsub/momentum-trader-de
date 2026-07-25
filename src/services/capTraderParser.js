/**
 * CapTrader Flex-Query XML Parser
 * Phase 8.6 — momentum-trader-de
 * 
 * Parst CapTrader (IBKR) Flex-Query XML Exporte:
 * - OpenPositions (offene Optionen + Aktien)
 * - Trades (geschlossene Optionstrades)
 * - EquitySummary (Account-Metriken)
 */

/**
 * Parst XML String zu DOM
 */
function parseXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Invalid XML: ' + parseError.textContent);
  return doc;
}

/**
 * Extrahiert Text-Inhalt eines Elements
 */
function getText(el, tag, fallback = '') {
  if (!el) return fallback;
  const child = el.querySelector(tag);
  return child ? child.textContent.trim() : fallback;
}

function getAttr(el, attr, fallback = '') {
  if (!el) return fallback;
  return el.getAttribute(attr) || fallback;
}

/**
 * Parst eine Zahl aus XML
 */
function getNumber(el, tag, fallback = 0) {
  const text = getText(el, tag, String(fallback));
  const num = parseFloat(text.replace(/,/g, ''));
  return isNaN(num) ? fallback : num;
}

/**
 * Parst ein Datum aus IBKR Format (YYYYMMDD)
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Parst DateTime aus IBKR Format (YYYYMMDD;HHMMSS)
 */
function parseDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const [datePart, timePart] = dateTimeStr.split(';');
  const date = parseDate(datePart);
  if (!date) return null;
  if (!timePart) return date;
  const hours = timePart.substring(0, 2);
  const minutes = timePart.substring(2, 4);
  const seconds = timePart.substring(4, 6);
  return `${date}T${hours}:${minutes}:${seconds}`;
}

/**
 * Bestimmt AssetClass aus Flex-Query Daten
 */
function detectAssetClass(assetType, symbol) {
  const type = (assetType || '').toUpperCase();
  if (type.includes('OPT')) return 'OPTION';
  if (type.includes('STK')) return 'STOCK';
  if (type.includes('FUT')) return 'FUTURE';
  if (type.includes('CASH') || symbol === 'EUR' || symbol === 'USD') return 'CASH';
  return 'STOCK';
}

/**
 * Bestimmt Optionstyp (CALL/PUT)
 */
function detectOptionType(putCall) {
  const pc = (putCall || '').toUpperCase();
  if (pc === 'P' || pc === 'PUT') return 'PUT';
  if (pc === 'C' || pc === 'CALL') return 'CALL';
  return null;
}

/**
 * Parst Open Positions aus Flex-Query XML
 */
export function parseOpenPositions(doc) {
  const positions = [];
  const openPosElements = doc.querySelectorAll('OpenPosition');

  openPosElements.forEach(el => {
    const symbol = getText(el, 'symbol');
    if (!symbol) return;

    const assetClass = detectAssetClass(getText(el, 'assetCategory'), symbol);
    const quantity = getNumber(el, 'position');
    const avgCost = getNumber(el, 'costBasisPrice');
    const marketPrice = getNumber(el, 'markPrice');
    const marketValue = getNumber(el, 'positionValue');
    const unrealizedPnl = getNumber(el, 'unrealizedPnl');
    const currency = getText(el, 'currency', 'USD');

    const pos = {
      id: `ct-${symbol}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      symbol,
      assetClass,
      quantity,
      entryPrice: avgCost,
      currentPrice: marketPrice || avgCost,
      marketValue,
      pnl: unrealizedPnl,
      currency,
      isOpen: true,
      status: 'open',
      source: 'CapTrader',
      importedAt: new Date().toISOString(),
    };

    // Option-spezifische Felder
    if (assetClass === 'OPTION') {
      pos.optionType = detectOptionType(getText(el, 'putCall'));
      pos.strike = getNumber(el, 'strike');
      pos.expiration = parseDate(getText(el, 'expiry'));
      pos.underlying = getText(el, 'underlyingSymbol') || symbol.replace(/\d+[CP]\d+$/i, '');
      pos.multiplier = getNumber(el, 'multiplier', 100);
    }

    positions.push(pos);
  });

  return positions;
}

/**
 * Parst Trades (geschlossene + offene) aus Flex-Query XML
 */
export function parseTrades(doc) {
  const trades = [];
  const tradeElements = doc.querySelectorAll('Trade');

  tradeElements.forEach(el => {
    const symbol = getText(el, 'symbol');
    if (!symbol) return;

    const assetClass = detectAssetClass(getText(el, 'assetCategory'), symbol);
    const tradeDate = parseDateTime(getText(el, 'tradeDate'));
    const quantity = getNumber(el, 'quantity');
    const tradePrice = getNumber(el, 'tradePrice');
    const proceeds = getNumber(el, 'proceeds');
    const commFee = getNumber(el, 'ibCommission');
    const realizedPnl = getNumber(el, 'realizedPnl');
    const currency = getText(el, 'currency', 'USD');
    const buySell = getText(el, 'buySell');

    const trade = {
      id: `ct-trade-${symbol}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      symbol,
      assetClass,
      quantity,
      entryPrice: tradePrice,
      tradeDate,
      proceeds,
      commission: Math.abs(commFee),
      pnl: realizedPnl,
      currency,
      side: buySell === 'B' ? 'BUY' : buySell === 'S' ? 'SELL' : buySell,
      source: 'CapTrader',
      importedAt: new Date().toISOString(),
    };

    // Option-spezifisch
    if (assetClass === 'OPTION') {
      trade.optionType = detectOptionType(getText(el, 'putCall'));
      trade.strike = getNumber(el, 'strike');
      trade.expiration = parseDate(getText(el, 'expiry'));
      trade.underlying = getText(el, 'underlyingSymbol') || symbol.replace(/\d+[CP]\d+$/i, '');
    }

    trades.push(trade);
  });

  return trades;
}

/**
 * Parst Account Summary (NAV, Cash, Buying Power)
 */
export function parseAccountSummary(doc) {
  const summary = {};
  const equityElements = doc.querySelectorAll('EquitySummaryInBase');

  equityElements.forEach(el => {
    summary.nav = getNumber(el, 'netLiquidation');
    summary.cash = getNumber(el, 'cash');
    summary.buyingPower = getNumber(el, 'buyingPower');
    summary.grossPositionValue = getNumber(el, 'grossPositionValue');
    summary.unrealizedPnl = getNumber(el, 'unrealizedPnl');
    summary.realizedPnl = getNumber(el, 'realizedPnl');
    summary.currency = getText(el, 'currency', 'EUR');
  });

  return summary;
}

/**
 * Haupt-Parser: Parst komplettes Flex-Query XML
 */
export function parseCapTraderXML(xmlString) {
  try {
    const doc = parseXML(xmlString);

    const flexStatement = doc.querySelector('FlexStatement');
    return {
      success: true,
      accountId: getAttr(flexStatement, 'accountId'),
      fromDate: parseDate(getAttr(flexStatement, 'fromDate')),
      toDate: parseDate(getAttr(flexStatement, 'toDate')),
      openPositions: parseOpenPositions(doc),
      trades: parseTrades(doc),
      accountSummary: parseAccountSummary(doc),
      rawTradeCount: doc.querySelectorAll('Trade').length,
      rawPositionCount: doc.querySelectorAll('OpenPosition').length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Filtert Optionstrades aus allen Trades
 */
export function filterOptionTrades(trades) {
  return trades.filter(t => t.assetClass === 'OPTION');
}

/**
 * Filtert geschlossene Trades (mit realizedPnl)
 */
export function filterClosedTrades(trades) {
  return trades.filter(t => t.pnl !== 0 || t.side === 'SELL');
}

/**
 * Berechnet Performance-Metriken aus Trades
 */
export function calculateTradeMetrics(trades) {
  const optionTrades = filterOptionTrades(trades);
  const closedTrades = filterClosedTrades(optionTrades);

  const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winners = closedTrades.filter(t => t.pnl > 0);
  const losers = closedTrades.filter(t => t.pnl < 0);

  return {
    totalTrades: closedTrades.length,
    totalPnl,
    winRate: closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0,
    winners: winners.length,
    losers: losers.length,
    avgWin: winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0,
    avgLoss: losers.length > 0 ? losers.reduce((s, t) => s + t.pnl, 0) / losers.length : 0,
    profitFactor: Math.abs(
      winners.reduce((s, t) => s + t.pnl, 0) / 
      (losers.reduce((s, t) => s + t.pnl, 0) || 1)
    ),
  };
}
