/**
 * CapTrader Flex-Query XML Parser
 * Importiert offene Positionen & historische Trades aus CapTrader (IBKR)
 * 
 * Unterstützt:
 * - OpenPositions (Aktien, Optionen)
 * - Trades (geschlossene Transaktionen)
 * - CashReport (Cash-Bestand)
 * 
 * Phase 9 — momentum-trader-de
 */

/**
 * Parst CapTrader Flex-Query XML String
 * @param {string} xmlString - Der XML-Inhalt der Flex-Query
 * @returns {Object} - { openPositions, trades, cash, accountInfo }
 */
export function parseCapTraderXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Prüfe auf Parser-Fehler
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }

  const result = {
    accountInfo: parseAccountInfo(doc),
    openPositions: parseOpenPositions(doc),
    trades: parseTrades(doc),
    cash: parseCash(doc),
  };

  return result;
}

function parseAccountInfo(doc) {
  const stmt = doc.querySelector('FlexStatement');
  if (!stmt) return {};

  return {
    accountId: stmt.getAttribute('accountId') || '',
    fromDate: stmt.getAttribute('fromDate') || '',
    toDate: stmt.getAttribute('toDate') || '',
    currency: stmt.getAttribute('currency') || 'USD',
  };
}

function parseOpenPositions(doc) {
  const positions = [];
  const openPosElements = doc.querySelectorAll('OpenPosition');

  openPosElements.forEach(pos => {
    const assetType = pos.getAttribute('assetCategory') || pos.getAttribute('assetType') || 'STK';
    const isOption = assetType === 'OPT' || assetType === 'Option';

    const position = {
      id: `ct-${pos.getAttribute('conid') || Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      symbol: pos.getAttribute('symbol') || pos.getAttribute('underlyingSymbol') || 'UNKNOWN',
      description: pos.getAttribute('description') || '',
      assetType: isOption ? 'OPTION' : 'STOCK',
      quantity: parseFloat(pos.getAttribute('position') || pos.getAttribute('quantity') || 0),
      entryPrice: parseFloat(pos.getAttribute('markPrice') || pos.getAttribute('avgPrice') || pos.getAttribute('costBasisPrice') || 0),
      currentPrice: parseFloat(pos.getAttribute('markPrice') || pos.getAttribute('closePrice') || 0),
      costBasis: parseFloat(pos.getAttribute('costBasisMoney') || pos.getAttribute('costBasis') || 0),
      marketValue: parseFloat(pos.getAttribute('marketValue') || pos.getAttribute('mktValue') || 0),
      currency: pos.getAttribute('currency') || 'USD',
      isOpen: true,
      isPaper: false,
      source: 'CapTrader',
      importedAt: new Date().toISOString(),
    };

    // Optionen-spezifische Felder
    if (isOption) {
      position.optionType = (pos.getAttribute('putCall') || '').toUpperCase() === 'P' ? 'put' : 'call';
      position.strike = parseFloat(pos.getAttribute('strike') || 0);
      position.expiration = pos.getAttribute('expiry') || pos.getAttribute('expiration') || '';
      position.underlyingPrice = parseFloat(pos.getAttribute('underlyingPrice') || 0);
      position.greeks = {
        delta: parseFloat(pos.getAttribute('delta') || 0),
        gamma: parseFloat(pos.getAttribute('gamma') || 0),
        theta: parseFloat(pos.getAttribute('theta') || 0),
        vega: parseFloat(pos.getAttribute('vega') || 0),
      };
    }

    positions.push(position);
  });

  return positions;
}

function parseTrades(doc) {
  const trades = [];
  const tradeElements = doc.querySelectorAll('Trade');

  tradeElements.forEach(trade => {
    const assetType = trade.getAttribute('assetCategory') || trade.getAttribute('assetType') || 'STK';
    const isOption = assetType === 'OPT' || assetType === 'Option';
    const quantity = parseFloat(trade.getAttribute('quantity') || trade.getAttribute('units') || 0);
    const tradePrice = parseFloat(trade.getAttribute('tradePrice') || trade.getAttribute('price') || 0);
    const proceeds = parseFloat(trade.getAttribute('proceeds') || 0);
    const commFee = parseFloat(trade.getAttribute('commFee') || trade.getAttribute('commission') || 0);
    const pnl = parseFloat(trade.getAttribute('realizedPnl') || trade.getAttribute('pnl') || 0);

    const entry = {
      id: `ct-trade-${trade.getAttribute('tradeID') || trade.getAttribute('transactionID') || Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      symbol: trade.getAttribute('symbol') || trade.getAttribute('underlyingSymbol') || 'UNKNOWN',
      description: trade.getAttribute('description') || '',
      assetType: isOption ? 'OPTION' : 'STOCK',
      quantity: Math.abs(quantity),
      entryPrice: tradePrice,
      exitPrice: tradePrice, // Bei geschlossenen Trades aus Flex-Query
      pnl: pnl,
      proceeds: proceeds,
      commission: Math.abs(commFee),
      currency: trade.getAttribute('currency') || 'USD',
      tradeDate: trade.getAttribute('tradeDate') || trade.getAttribute('dateTime') || '',
      status: 'closed',
      isPaper: false,
      source: 'CapTrader',
      strategy: 'manual', // Kann später vom User überschrieben werden
    };

    if (isOption) {
      entry.optionType = (trade.getAttribute('putCall') || '').toUpperCase() === 'P' ? 'put' : 'call';
      entry.strike = parseFloat(trade.getAttribute('strike') || 0);
      entry.expiration = trade.getAttribute('expiry') || trade.getAttribute('expiration') || '';
    }

    trades.push(entry);
  });

  return trades;
}

function parseCash(doc) {
  const cashElements = doc.querySelectorAll('CashReport');
  let totalCash = 0;

  cashElements.forEach(c => {
    totalCash += parseFloat(c.getAttribute('endingCash') || c.getAttribute('cash') || 0);
  });

  // Fallback: Suche nach Cash in anderen Knoten
  if (totalCash === 0) {
    const stmt = doc.querySelector('FlexStatement');
    if (stmt) {
      totalCash = parseFloat(stmt.getAttribute('endingCash') || stmt.getAttribute('cash') || 0);
    }
  }

  return {
    totalCash,
    currency: 'USD',
  };
}

/**
 * Berechnet Performance-Metriken aus importierten Trades
 */
export function calculatePerformanceMetrics(trades) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgHoldingDays: 0,
    };
  }

  const closed = trades.filter(t => t.status === 'closed');
  const winners = closed.filter(t => t.pnl > 0);
  const losers = closed.filter(t => t.pnl < 0);

  const totalPnl = closed.reduce((sum, t) => sum + t.pnl, 0);
  const avgPnl = totalPnl / closed.length;
  const bestTrade = Math.max(...closed.map(t => t.pnl));
  const worstTrade = Math.min(...closed.map(t => t.pnl));

  return {
    totalTrades: closed.length,
    winRate: closed.length > 0 ? (winners.length / closed.length) * 100 : 0,
    avgPnl,
    totalPnl,
    bestTrade,
    worstTrade,
    winners: winners.length,
    losers: losers.length,
  };
}

/**
 * Validiert, ob die XML-Struktur einer CapTrader Flex-Query entspricht
 */
export function validateFlexQueryXml(xmlString) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) {
      return { valid: false, reason: 'XML parsing error' };
    }

    const hasFlexQuery = !!doc.querySelector('FlexQueryResponse');
    const hasFlexStatement = !!doc.querySelector('FlexStatement');

    if (!hasFlexQuery && !hasFlexStatement) {
      return { valid: false, reason: 'Not a CapTrader Flex-Query XML' };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, reason: e.message };
  }
}
