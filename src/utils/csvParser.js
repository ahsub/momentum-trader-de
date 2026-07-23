/**
 * CapTrader / IBKR Activity Statement CSV Parser
 * Transforms raw IBKR CSV into unified trade schema
 */

import { parse } from 'date-fns';

// IBKR Option symbol format: "AAPL  240816P00200000"
// Pattern: SYMBOL + 6 chars date (YYMMDD) + C/P + 8 chars strike (with leading zeros)
const OPTION_SYMBOL_REGEX = /^([A-Z]+)\s+(\d{6})([CP])(\d{8})$/;

/**
 * Parse IBKR option symbol into components
 * @param {string} symbol - e.g. "AAPL  240816P00200000"
 * @returns {Object|null} - { underlying, expiry, optionType, strike }
 */
export function parseOptionSymbol(symbol) {
  const match = symbol.match(OPTION_SYMBOL_REGEX);
  if (!match) return null;

  const [, underlying, dateStr, typeCode, strikeStr] = match;

  // Parse expiry: YYMMDD
  const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10);
  const day = parseInt(dateStr.substring(4, 6), 10);

  // Parse strike: divide by 1000 for standard options
  const strike = parseInt(strikeStr, 10) / 1000;

  return {
    underlying: underlying.trim(),
    expiry: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    optionType: typeCode === 'C' ? 'CALL' : 'PUT',
    strike: strike
  };
}

/**
 * Determine trade status from IBKR codes
 * @param {string} code - IBKR code field
 * @param {string} assetClass - STK, OPT, etc.
 * @param {number} quantity - positive or negative
 * @returns {string} - OPEN, CLOSED, ASSIGNED, EXPIRED, EXERCISED
 */
export function determineTradeStatus(code, assetClass, quantity) {
  if (!code) return 'OPEN';

  const codes = code.split(';');

  if (codes.includes('Ep')) return 'EXPIRED';
  if (codes.includes('Ex')) return 'EXERCISED';
  if (codes.includes('A')) return 'ASSIGNED';
  if (codes.includes('C')) return 'CLOSED';
  if (codes.includes('O')) return 'OPEN';
  if (codes.includes('R')) return 'ROLLED';

  // For options: negative quantity = SELL/SHORT = OPENING
  // positive quantity = BUY/CLOSE = CLOSING (if it was short)
  if (assetClass === 'OPT') {
    return quantity < 0 ? 'OPEN' : 'CLOSED';
  }

  return 'OPEN';
}

/**
 * Detect strategy from trade context
 * @param {Object} trade - normalized trade
 * @param {Array} allTrades - all trades for context
 * @returns {string} - strategy name
 */
export function detectStrategy(trade, allTrades = []) {
  if (trade.assetClass !== 'OPT') return 'BUY_AND_HOLD';

  const { optionType, side } = trade;

  // Cash Secured Put: SELL PUT
  if (optionType === 'PUT' && side === 'SELL') {
    return 'CASH_SECURED_PUT';
  }

  // Covered Call: SELL CALL
  if (optionType === 'CALL' && side === 'SELL') {
    // Check if user owns underlying
    const hasUnderlying = allTrades.some(t => 
      t.symbol === trade.underlying && 
      t.assetClass === 'STK' && 
      t.netQuantity > 0
    );
    return hasUnderlying ? 'COVERED_CALL' : 'NAKED_CALL';
  }

  // Long options
  if (side === 'BUY') {
    return optionType === 'CALL' ? 'LONG_CALL' : 'LONG_PUT';
  }

  return 'SINGLE';
}

/**
 * Parse a single CSV row into unified trade schema
 * @param {Object} row - raw CSV row
 * @returns {Object|null} - normalized trade or null if invalid
 */
export function parseTradeRow(row) {
  // Skip non-trade rows (dividends, interest, etc.)
  if (!row.Symbol || !row['Buy/Sell']) {
    return null;
  }

  const symbol = row.Symbol.trim();
  const optionData = parseOptionSymbol(symbol);

  const quantity = parseFloat(row.Quantity) || 0;
  const price = parseFloat(row['T. Price']) || 0;
  const proceeds = parseFloat(row.Proceeds) || 0;
  const commission = parseFloat(row['Comm/Fee']) || 0;
  const realizedPL = row['Realized P/L'] ? parseFloat(row['Realized P/L']) : null;

  const assetClass = row.AssetClass || (optionData ? 'OPT' : 'STK');
  const side = row['Buy/Sell'].trim().toUpperCase();
  const code = row.Code || '';
  const status = determineTradeStatus(code, assetClass, quantity);

  const trade = {
    id: `${symbol}_${row['Date/Time']}_${Math.random().toString(36).substr(2, 9)}`,
    date: row['Date/Time'],
    symbol: optionData ? symbol : symbol,
    underlying: optionData ? optionData.underlying : symbol,
    assetClass: assetClass === 'OPT' ? 'OPTION' : assetClass === 'STK' ? 'STOCK' : assetClass,
    side: side,
    quantity: Math.abs(quantity),
    netQuantity: side === 'BUY' ? Math.abs(quantity) : -Math.abs(quantity),
    price: price,
    proceeds: proceeds,
    commission: commission,
    fees: Math.abs(commission),
    realizedPnl: realizedPL,
    status: status,
    code: code,
    orderType: row['Order Type'] || '',
    description: row.Description || '',
    tags: [],

    // Option-specific
    ...(optionData && {
      optionType: optionData.optionType,
      strike: optionData.strike,
      expiry: optionData.expiry,
      premium: side === 'SELL' ? price : -price,
      dteAtOpen: null // calculated later
    })
  };

  // Calculate DTE at opening
  if (trade.expiry && trade.date) {
    const tradeDate = new Date(trade.date.split(',')[0]);
    const expiryDate = new Date(trade.expiry);
    trade.dteAtOpen = Math.ceil((expiryDate - tradeDate) / (1000 * 60 * 60 * 24));
  }

  return trade;
}

/**
 * Parse entire CSV content into trades array
 * @param {string} csvContent - raw CSV string
 * @returns {Array} - array of normalized trades
 */
export function parseCapTraderCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const trades = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });

    const trade = parseTradeRow(row);
    if (trade) trades.push(trade);
  }

  // Second pass: detect strategies with full context
  return trades.map(trade => ({
    ...trade,
    strategy: detectStrategy(trade, trades)
  }));
}

/**
 * Validate parsed trades
 * @param {Array} trades 
 * @returns {Object} - { valid: boolean, errors: [], stats: {} }
 */
export function validateTrades(trades) {
  const errors = [];
  const stats = {
    total: trades.length,
    stocks: trades.filter(t => t.assetClass === 'STOCK').length,
    options: trades.filter(t => t.assetClass === 'OPTION').length,
    opens: trades.filter(t => t.status === 'OPEN').length,
    closes: trades.filter(t => t.status === 'CLOSED').length,
    expired: trades.filter(t => t.status === 'EXPIRED').length,
    assigned: trades.filter(t => t.status === 'ASSIGNED').length,
    exercised: trades.filter(t => t.status === 'EXERCISED').length
  };

  // Check for required fields
  trades.forEach((trade, i) => {
    if (!trade.date) errors.push(`Row ${i}: Missing date`);
    if (!trade.symbol) errors.push(`Row ${i}: Missing symbol`);
    if (trade.quantity === 0) errors.push(`Row ${i}: Zero quantity`);
  });

  return {
    valid: errors.length === 0,
    errors,
    stats
  };
}
