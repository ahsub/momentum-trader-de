/**
 * Greeks Calculator...
 *//**
 * Greeks Calculator — Black-Scholes Formeln im Frontend
 * Phase 8.4 — momentum-trader-de
 * 
 * Berechnet Delta, Gamma, Theta, Vega für jede Options-Position
 * Unterstützt Calls und Puts
 */

/**
 * Kumulierende Standardnormalverteilung (CDF)
 * Approximation nach Abramowitz & Stegun
 */
function cumulativeNormalDistribution(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  
  return 0.5 * (1 + sign * y);
}

/**
 * Dichtefunktion der Standardnormalverteilung (PDF)
 */
function standardNormalPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Berechnet d1 und d2 für Black-Scholes
 */
function calculateD1D2(S, K, T, r, sigma) {
  if (T <= 0 || sigma <= 0) return { d1: 0, d2: 0 };
  
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return { d1, d2 };
}

/**
 * Berechnet alle Greeks für eine Options-Position
 * @param {Object} params
 * @param {number} params.S — Aktueller Underlying-Preis
 * @param {number} params.K — Strike-Preis
 * @param {number} params.T — Zeit bis Verfall in Jahren (z.B. 30/365)
 * @param {number} params.r — Risikofreier Zinssatz (z.B. 0.045 für 4.5%)
 * @param {number} params.sigma — Implizite Volatilität (z.B. 0.30 für 30%)
 * @param {string} params.optionType — 'call' oder 'put'
 * @param {number} params.quantity — Anzahl Kontrakte (kann negativ sein für Short)
 * @returns {Object} — { delta, gamma, theta, vega, rho, theoreticalPrice }
 */
export function calculateGreeks({ S, K, T, r, sigma, optionType, quantity = 1 }) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return {
      delta: optionType === 'call' ? (quantity > 0 ? 1 : -1) : (quantity > 0 ? -1 : 1),
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
      theoreticalPrice: Math.max(0, optionType === 'call' ? S - K : K - S),
    };
  }
  
  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma);
  const Nd1 = cumulativeNormalDistribution(d1);
  const Nd2 = cumulativeNormalDistribution(d2);
  const NNegD1 = cumulativeNormalDistribution(-d1);
  const NNegD2 = cumulativeNormalDistribution(-d2);
  const pdfD1 = standardNormalPDF(d1);
  
  let delta, gamma, theta, vega, rho, theoreticalPrice;
  
  // Delta
  if (optionType === 'call') {
    delta = Nd1;
  } else {
    delta = Nd1 - 1;
  }
  
  // Gamma (gleich für Call und Put)
  gamma = pdfD1 / (S * sigma * Math.sqrt(T));
  
  // Theta (pro Tag, nicht pro Jahr)
  const sqrtT = Math.sqrt(T);
  if (optionType === 'call') {
    theta = -(S * pdfD1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * Nd2;
  } else {
    theta = -(S * pdfD1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * NNegD2;
  }
  theta = theta / 365;
  
  // Vega (pro 1% Volatilitätsänderung)
  vega = S * pdfD1 * sqrtT / 100;
  
  // Rho (pro 1% Zinsänderung)
  if (optionType === 'call') {
    rho = K * T * Math.exp(-r * T) * Nd2 / 100;
  } else {
    rho = -K * T * Math.exp(-r * T) * NNegD2 / 100;
  }
  
  // Theoretischer Preis (Black-Scholes)
  if (optionType === 'call') {
    theoreticalPrice = S * Nd1 - K * Math.exp(-r * T) * Nd2;
  } else {
    theoreticalPrice = K * Math.exp(-r * T) * NNegD2 - S * NNegD1;
  }
  
  const multiplier = 100;
  
  return {
    delta: parseFloat((delta * quantity * multiplier).toFixed(4)),
    gamma: parseFloat((gamma * quantity * multiplier).toFixed(6)),
    theta: parseFloat((theta * quantity * multiplier).toFixed(4)),
    vega: parseFloat((vega * quantity * multiplier).toFixed(4)),
    rho: parseFloat((rho * quantity * multiplier).toFixed(4)),
    theoreticalPrice: parseFloat(theoreticalPrice.toFixed(2)),
  };
}

/**
 * Berechnet Portfolio-Greeks (Aggregation aller Positionen)
 */
export function calculatePortfolioGreeks(positions) {
  const totals = {
    totalDelta: 0,
    totalGamma: 0,
    totalTheta: 0,
    totalVega: 0,
    totalRho: 0,
  };
  
  positions.forEach(pos => {
    if (pos.greeks) {
      totals.totalDelta += pos.greeks.delta || 0;
      totals.totalGamma += pos.greeks.gamma || 0;
      totals.totalTheta += pos.greeks.theta || 0;
      totals.totalVega += pos.greeks.vega || 0;
      totals.totalRho += pos.greeks.rho || 0;
    }
  });
  
  Object.keys(totals).forEach(key => {
    totals[key] = parseFloat(totals[key].toFixed(4));
  });
  
  return totals;
}

/**
 * Schätzt die implizite Volatilität (IV) aus dem Marktpreis
 * Einfache Newton-Raphson-Approximation
 */
export function estimateImpliedVolatility(S, K, T, r, marketPrice, optionType, maxIterations = 100, tolerance = 0.0001) {
  let sigma = 0.3;
  
  for (let i = 0; i < maxIterations; i++) {
    const greeks = calculateGreeks({ S, K, T, r, sigma, optionType });
    const priceDiff = greeks.theoreticalPrice - marketPrice;
    
    if (Math.abs(priceDiff) < tolerance) {
      return parseFloat(sigma.toFixed(4));
    }
    
    const vega = greeks.vega * 100;
    if (Math.abs(vega) < 0.0001) break;
    
    sigma = sigma - priceDiff / vega;
    
    if (sigma < 0.01) sigma = 0.01;
    if (sigma > 5) sigma = 5;
  }
  
  return parseFloat(sigma.toFixed(4));
}

/**
 * Berechnet Greeks für eine komplette Position
 */
export function calculatePositionGreeks(position) {
  const {
    underlyingPrice,
    strike,
    daysToExpiration,
    riskFreeRate = 0.045,
    impliedVolatility,
    optionType,
    quantity,
    marketPrice,
  } = position;
  
  const T = daysToExpiration / 365;
  
  let sigma = impliedVolatility;
  if (!sigma && marketPrice && underlyingPrice && strike && T > 0) {
    sigma = estimateImpliedVolatility(underlyingPrice, strike, T, riskFreeRate, marketPrice, optionType);
  }
  
  if (!sigma) {
    sigma = 0.30;
  }
  
  return calculateGreeks({
    S: underlyingPrice,
    K: strike,
    T,
    r: riskFreeRate,
    sigma,
    optionType,
    quantity,
  });
}

export default {
  calculateGreeks,
  calculatePortfolioGreeks,
  estimateImpliedVolatility,
  calculatePositionGreeks,
};
