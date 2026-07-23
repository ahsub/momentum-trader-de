/**
 * Positions Engine
 * Aggregates trades into open/closed positions with P&L and Greeks
 */

import { differenceInDays, parseISO, isAfter } from 'date-fns';

/**
 * Calculate simplified Greeks for an option position
 * @param {Object} position 
 * @returns {Object} - { delta, gamma, theta, vega }
 */
export function calculatePositionGreeks(position) {
  if (position.assetClass !== 'OPTION') {
    // Stock: delta = 1 per share, others = 0
    return {
      delta: position.netQuantity,
      gamma: 0,
      theta: 0,
      vega: 0
    };
  }

  const { optionType, strike, expiry, netQuantity, underlyingPrice } = position;
  const daysToExpiry = differenceInDays(parseISO(expiry), new Date());

  if (daysToExpiry <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  // Simplified Greeks (approximation)
  const moneyness = underlyingPrice ? (underlyingPrice - strike) / strike : 0;
  const isITM = optionType === 'CALL' ? moneyness > 0 : moneyness < 0;
  const isATM = Math.abs(moneyness) < 0.02;

  // Delta: 0.5 ATM, 0.8 ITM, 0.2 OTM (approx)
  let delta = isATM ? 0.5 : isITM ? 0.75 : 0.25;
  if (optionType === 'PUT') delta = -delta;

  // For short positions, invert Greeks
  if (netQuantity < 0) delta = -delta;

  // Gamma: highest ATM, decreases as ITM/OTM
  const gamma = isATM ? 0.05 : 0.02;

  // Theta: negative for long options, positive for short (time decay)
  // Approx: $0.01 per day per contract ATM
  const theta = isATM ? -0.5 : -0.2;
  const thetaSign = netQuantity < 0 ? 1 : -1; // Short = collect theta

  // Vega: sensitivity to IV changes
  const vega = isATM ? 0.1 : 0.05;
  const vegaSign = netQuantity < 0 ? -1 : 1;

  return {
    delta: Math.round(delta * netQuantity * 100) / 100,
    gamma: Math.round(gamma * Math.abs(netQuantity) * 100) / 100,
    theta: Math.round(theta * thetaSign * Math.abs(netQuantity) * 100) / 100,
    vega: Math.round(vega * vegaSign * Math.abs(netQuantity) * 100) / 100,
    daysToExpiry
  };
}

/**
 * Aggregate trades into positions
 * @param {Array} trades - normalized trades
 * @param {Object} marketPrices - { symbol: currentPrice }
 * @returns {Array} - positions
 */
export function aggregatePositions(trades, marketPrices = {}) {
  // Group trades by underlying + option attributes
  const positionMap = new Map();

  trades.forEach(trade => {
    const key = trade.assetClass === 'OPTION' 
      ? `${trade.underlying}_${trade.optionType}_${trade.strike}_${trade.expiry}`
      : trade.symbol;

    if (!positionMap.has(key)) {
      positionMap.set(key, {
        symbol: trade.symbol,
        underlying: trade.underlying,
        assetClass: trade.assetClass,
        optionType: trade.optionType || null,
        strike: trade.strike || null,
        expiry: trade.expiry || null,
        openingTrades: [],
        closingTrades: [],
        netQuantity: 0,
        totalCost: 0,
        totalPremium: 0,
        realizedPnl: 0,
        strategy: trade.strategy || 'SINGLE'
      });
    }

    const pos = positionMap.get(key);

    if (trade.status === 'OPEN' || trade.status === 'ASSIGNED' || trade.status === 'EXERCISED') {
      pos.openingTrades.push(trade);
      pos.netQuantity += trade.netQuantity;
      pos.totalCost += Math.abs(trade.proceeds);
      if (trade.assetClass === 'OPTION') {
        pos.totalPremium += trade.side === 'SELL' ? Math.abs(trade.premium * trade.quantity * 100) : -Math.abs(trade.premium * trade.quantity * 100);
      }
    } else if (trade.status === 'CLOSED' || trade.status === 'EXPIRED') {
      pos.closingTrades.push(trade);
      pos.realizedPnl += (trade.realizedPnl || 0);
      // Adjust net quantity for closing trades
      pos.netQuantity += trade.netQuantity;
    }

    // Update strategy if more specific
    if (trade.strategy && trade.strategy !== 'SINGLE') {
      pos.strategy = trade.strategy;
    }
  });

  // Convert to array and calculate derived metrics
  return Array.from(positionMap.values()).map(pos => {
    const marketPrice = marketPrices[pos.underlying] || marketPrices[pos.symbol] || 0;
    const greeks = calculatePositionGreeks({
      ...pos,
      underlyingPrice: marketPrice
    });

    // Calculate cost basis
    const avgCost = pos.openingTrades.length > 0 
      ? pos.totalCost / pos.openingTrades.reduce((sum, t) => sum + t.quantity, 0)
      : 0;

    // Market value
    let marketValue = 0;
    if (pos.assetClass === 'STOCK') {
      marketValue = pos.netQuantity * marketPrice;
    } else if (pos.assetClass === 'OPTION') {
      // For options, use intrinsic value as proxy
      if (pos.optionType === 'CALL' && marketPrice > pos.strike) {
        marketValue = pos.netQuantity * (marketPrice - pos.strike) * 100;
      } else if (pos.optionType === 'PUT' && marketPrice < pos.strike) {
        marketValue = pos.netQuantity * (pos.strike - marketPrice) * 100;
      }
    }

    // Unrealized P&L
    const unrealizedPnl = pos.assetClass === 'STOCK' 
      ? (marketPrice - avgCost) * pos.netQuantity
      : 0; // Options: complex, use realized for now

    // Days to expiry
    const daysToExpiry = pos.expiry 
      ? differenceInDays(parseISO(pos.expiry), new Date())
      : null;

    // Assignment risk for short options
    let assignmentRisk = 'NONE';
    if (pos.assetClass === 'OPTION' && pos.netQuantity < 0) {
      if (daysToExpiry !== null && daysToExpiry <= 1) {
        assignmentRisk = 'HIGH';
      } else if (pos.optionType === 'PUT' && marketPrice < pos.strike * 0.98) {
        assignmentRisk = 'ELEVATED';
      } else if (pos.optionType === 'CALL' && marketPrice > pos.strike * 1.02) {
        assignmentRisk = 'ELEVATED';
      }
    }

    return {
      ...pos,
      avgCost: Math.round(avgCost * 100) / 100,
      marketPrice,
      marketValue: Math.round(marketValue * 100) / 100,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      unrealizedPnlPercent: avgCost > 0 ? Math.round((unrealizedPnl / (avgCost * pos.netQuantity)) * 10000) / 100 : 0,
      isOpen: pos.netQuantity !== 0,
      daysToExpiry,
      assignmentRisk,
      ...greeks
    };
  }).filter(pos => pos.isOpen || pos.realizedPnl !== 0);
}

/**
 * Calculate portfolio summary
 * @param {Array} positions 
 * @param {number} cashBalance
 * @returns {Object} - portfolio summary
 */
export function calculatePortfolioSummary(positions, cashBalance = 50000) {
  const openPositions = positions.filter(p => p.isOpen);
  const closedPositions = positions.filter(p => !p.isOpen);

  const investedValue = openPositions.reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
  const totalValue = investedValue + cashBalance;

  const realizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  // Portfolio Greeks
  const portfolioDelta = openPositions.reduce((sum, p) => sum + (p.delta || 0), 0);
  const portfolioTheta = openPositions.reduce((sum, p) => sum + (p.theta || 0), 0);
  const portfolioVega = openPositions.reduce((sum, p) => sum + (p.vega || 0), 0);

  // Allocation
  const stockValue = openPositions.filter(p => p.assetClass === 'STOCK').reduce((s, p) => s + Math.abs(p.marketValue), 0);
  const optionValue = openPositions.filter(p => p.assetClass === 'OPTION').reduce((s, p) => s + Math.abs(p.marketValue), 0);

  // Concentration risk
  const maxPositionValue = Math.max(...openPositions.map(p => Math.abs(p.marketValue)), 0);
  const concentrationRisk = totalValue > 0 ? (maxPositionValue / totalValue) * 100 : 0;

  // Win rate (from closed positions)
  const winningTrades = closedPositions.filter(p => p.realizedPnl > 0).length;
  const totalClosed = closedPositions.length;
  const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
    investedValue: Math.round(investedValue * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    totalReturn: Math.round((realizedPnl + unrealizedPnl) * 100) / 100,

    portfolioDelta: Math.round(portfolioDelta * 100) / 100,
    portfolioTheta: Math.round(portfolioTheta * 100) / 100,
    portfolioVega: Math.round(portfolioVega * 100) / 100,

    cashPercent: totalValue > 0 ? Math.round((cashBalance / totalValue) * 10000) / 100 : 0,
    stockPercent: totalValue > 0 ? Math.round((stockValue / totalValue) * 10000) / 100 : 0,
    optionPercent: totalValue > 0 ? Math.round((optionValue / totalValue) * 10000) / 100 : 0,

    concentrationRisk: Math.round(concentrationRisk * 100) / 100,
    maxPositionValue: Math.round(maxPositionValue * 100) / 100,

    openPositions: openPositions.length,
    closedPositions: totalClosed,
    winRate: Math.round(winRate * 100) / 100,

    // Position list
    positions: openPositions
  };
}
