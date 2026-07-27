import { extractUnderlyings, calculatePositionsWithCostBasis } from './capTraderParser';

const STORAGE_KEY = 'captrader_portfolio_data';

export function savePortfolioData(parsedData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    timestamp: Date.now(),
    data: parsedData
  }));
}

export function loadPortfolioData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      console.log('Portfolio-Cache abgelaufen');
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearPortfolioData() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getCCScreenerInput(parsedData) {
  const positions = calculatePositionsWithCostBasis(parsedData);
  return positions
    .filter(p => p.quantity >= 100)
    .map(p => ({
      symbol: p.symbol,
      shares: Math.floor(p.quantity / 100) * 100,
      totalShares: p.quantity,
      avgCost: p.avgCost,
      marketPrice: p.marketPrice,
      marketValue: p.marketValue,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPnlPct: p.unrealizedPnlPct,
      costBasis: p.costBasisMoney,
      availableForCC: true,
      sharesAvailableForCC: Math.floor(p.quantity / 100),
      breakeven: p.avgCost,
      upsideCapAtm: ((p.marketPrice - p.avgCost) / p.avgCost * 100),
    }));
}

export function getCSPScreenerInput(parsedData) {
  const cash = parsedData.cashReports?.[parsedData.cashReports.length - 1];
  const eurCash = cash?.EUR?.endingSettledCash || 0;
  const usdCash = cash?.USD?.endingSettledCash || 0;
  const totalBuyingPower = eurCash + usdCash * 0.92;
  return { cashEUR: eurCash, cashUSD: usdCash, totalBuyingPower };
}

export function getEnhancedWatchlist(parsedData, kiWatchlist = []) {
  const portfolioSymbols = extractUnderlyings(parsedData);
  const portfolioEntries = portfolioSymbols.map(sym => ({
    symbol: sym, source: 'PORTFOLIO', reason: 'Im Bestand', priority: 1,
  }));
  const kiEntries = kiWatchlist
    .filter(ki => !portfolioSymbols.includes(ki.symbol))
    .map(ki => ({ ...ki, source: 'KI', priority: 2 }));
  return [...portfolioEntries, ...kiEntries];
}

export function calculatePortfolioMetrics(parsedData) {
  const positions = calculatePositionsWithCostBasis(parsedData);
  const cash = parsedData.cashReports?.[parsedData.cashReports.length - 1];
  const totalEquity = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasisMoney, 0);
  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalDividends = parsedData.allDividends?.reduce((sum, d) => sum + d.amount, 0) || 0;
  const totalCash = (cash?.EUR?.endingSettledCash || 0) + (cash?.USD?.endingSettledCash || 0) * 0.92;
  const maxPosition = positions.length > 0 ? Math.max(...positions.map(p => p.percentOfNAV)) : 0;
  const bySubCategory = {};
  positions.forEach(p => {
    const cat = p.subCategory || 'UNKNOWN';
    bySubCategory[cat] = (bySubCategory[cat] || 0) + p.marketValue;
  });
  return {
    totalEquity, totalCash, totalValue: totalEquity + totalCash,
    totalCostBasis, totalUnrealized,
    totalUnrealizedPct: totalCostBasis > 0 ? (totalUnrealized / totalCostBasis) * 100 : 0,
    totalDividends, positionCount: positions.length, maxConcentration: maxPosition,
    bySubCategory, positions,
    portfolioDelta: totalEquity * 0.01, portfolioTheta: 0,
  };
}

export function getOpenOptionPositions(parsedData) {
  const optionTrades = parsedData.allTrades?.filter(t => t.assetCategory === 'OPT') || [];
  const grouped = {};
  optionTrades.forEach(t => {
    const key = `${t.underlyingSymbol}_${t.strike}_${t.expiry}_${t.putCall}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });
  const openOptions = [];
  Object.entries(grouped).forEach(([key, trades]) => {
    const netQty = trades.reduce((sum, t) => {
      const qty = t.buySell === 'SELL' ? -Math.abs(t.quantity) : Math.abs(t.quantity);
      return sum + qty;
    }, 0);
    if (netQty !== 0) {
      const first = trades[0];
      openOptions.push({
        underlying: first.underlyingSymbol, symbol: first.symbol,
        strike: first.strike, expiry: first.expiry, putCall: first.putCall,
        netQuantity: netQty, isShort: netQty < 0,
        daysToExpiry: first.expiry ? Math.ceil((new Date(first.expiry) - new Date()) / (1000 * 60 * 60 * 24)) : null,
      });
    }
  });
  return openOptions;
}
