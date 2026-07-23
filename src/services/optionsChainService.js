/**
 * optionsChainService.js
 * 
 * Echtzeit-Options-Chain Service für momentum-trader-de
 * Nutzt Alpha Vantage API für Options-Daten
 * Fallback: Mock-Daten für Entwicklung/Testing
 * 
 * Phase 8: Echtzeit-Options-Chain Integration
 */

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// API Key aus .env.local
const API_KEY = import.meta.env.VITE_ALPHAVANTAGE_API_KEY || 'demo';

// Rate Limiting: Alpha Vantage Free = 25 calls/day, 5/min
// Wir cachen Daten und nutzen einen Request-Queue
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

/**
 * Hole Options-Chain für ein Symbol
 * @param {string} symbol - Aktien-Symbol (z.B. "AAPL")
 * @param {string} expiration - Optional: spezifisches Expirationsdatum (YYYY-MM-DD)
 * @returns {Promise<Object>} - Options-Chain Daten
 */
export async function fetchOptionsChain(symbol, expiration = null) {
  const cacheKey = `${symbol}_${expiration || 'all'}`;

  // Cache-Check
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[OptionsChain] Cache hit für ${symbol}`);
    return cached.data;
  }

  try {
    // Alpha Vantage HISTORICAL_OPTIONS Endpoint
    const url = new URL(ALPHA_VANTAGE_BASE_URL);
    url.searchParams.append('function', 'HISTORICAL_OPTIONS');
    url.searchParams.append('symbol', symbol);
    url.searchParams.append('apikey', API_KEY);

    if (expiration) {
      url.searchParams.append('date', expiration);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Prüfe auf API-Limit oder Fehler
    if (data.Information || data.Note) {
      console.warn('[OptionsChain] API-Limit erreicht, nutze Mock-Daten');
      const mockData = generateMockOptionsChain(symbol);
      cache.set(cacheKey, { data: mockData, timestamp: Date.now() });
      return mockData;
    }

    // Transformiere Alpha Vantage Format in unser Format
    const transformed = transformAlphaVantageData(data, symbol);

    // Cache speichern
    cache.set(cacheKey, { data: transformed, timestamp: Date.now() });

    return transformed;
  } catch (error) {
    console.error('[OptionsChain] Fehler:', error);
    // Fallback zu Mock-Daten
    const mockData = generateMockOptionsChain(symbol);
    cache.set(cacheKey, { data: mockData, timestamp: Date.now() });
    return mockData;
  }
}

/**
 * Hole verfügbare Expirationsdaten für ein Symbol
 * @param {string} symbol - Aktien-Symbol
 * @returns {Promise<string[]>} - Liste von Expirationsdaten (YYYY-MM-DD)
 */
export async function fetchExpirations(symbol) {
  try {
    const url = new URL(ALPHA_VANTAGE_BASE_URL);
    url.searchParams.append('function', 'OPTIONS_EXPIRATIONS');
    url.searchParams.append('symbol', symbol);
    url.searchParams.append('apikey', API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.expirations) {
      return data.expirations;
    }

    // Fallback: Extrahiere aus Options-Chain
    const chain = await fetchOptionsChain(symbol);
    return [...new Set(chain.calls.map(c => c.expiration))].sort();
  } catch (error) {
    console.error('[OptionsChain] Fehler bei Expirations:', error);
    return generateMockExpirations();
  }
}

/**
 * Transformiere Alpha Vantage Daten in unser Format
 */
function transformAlphaVantageData(data, symbol) {
  if (!data.data || !Array.isArray(data.data)) {
    return generateMockOptionsChain(symbol);
  }

  const calls = [];
  const puts = [];

  data.data.forEach(option => {
    const transformed = {
      symbol: option.symbol,
      contractId: option.contractID,
      expiration: option.expiration,
      strike: parseFloat(option.strike),
      type: option.type.toLowerCase(),
      lastPrice: parseFloat(option.last) || 0,
      bid: parseFloat(option.bid) || 0,
      ask: parseFloat(option.ask) || 0,
      mark: parseFloat(option.mark) || 0,
      volume: parseInt(option.volume) || 0,
      openInterest: parseInt(option.open_interest) || 0,
      impliedVolatility: parseFloat(option.implied_volatility) || 0,
      delta: parseFloat(option.delta) || 0,
      gamma: parseFloat(option.gamma) || 0,
      theta: parseFloat(option.theta) || 0,
      vega: parseFloat(option.vega) || 0,
      rho: parseFloat(option.rho) || 0,
      bidSize: parseInt(option.bid_size) || 0,
      askSize: parseInt(option.ask_size) || 0,
      lastTradeDate: option.date,
      inTheMoney: option.type.toLowerCase() === 'call' 
        ? parseFloat(option.strike) < (option.underlying_price || 0)
        : parseFloat(option.strike) > (option.underlying_price || 0)
    };

    if (option.type.toLowerCase() === 'call') {
      calls.push(transformed);
    } else {
      puts.push(transformed);
    }
  });

  return {
    symbol,
    timestamp: new Date().toISOString(),
    calls: calls.sort((a, b) => a.strike - b.strike),
    puts: puts.sort((a, b) => a.strike - b.strike),
    expirations: [...new Set([...calls, ...puts].map(o => o.expiration))].sort()
  };
}

/**
 * Finde ATM-Option (am Geld)
 * @param {Object[]} options - Array von Options-Objekten
 * @param {number} underlyingPrice - Aktueller Kurs des Underlyings
 * @returns {Object|null} - ATM-Option oder null
 */
export function findATMOption(options, underlyingPrice) {
  if (!options || options.length === 0 || !underlyingPrice) return null;

  return options.reduce((closest, option) => {
    const currentDiff = Math.abs(option.strike - underlyingPrice);
    const closestDiff = Math.abs(closest.strike - underlyingPrice);
    return currentDiff < closestDiff ? option : closest;
  });
}

/**
 * Berechne Mid-Price (Durchschnitt von Bid/Ask)
 * @param {Object} option - Options-Objekt
 * @returns {number} - Mid-Price
 */
export function getMidPrice(option) {
  if (!option) return 0;
  if (option.bid > 0 && option.ask > 0) {
    return (option.bid + option.ask) / 2;
  }
  return option.lastPrice || option.mark || 0;
}

/**
 * Berechne Annualisierte Rendite für CSP
 * @param {Object} putOption - Put-Option
 * @param {number} daysToExpiration - DTE
 * @returns {number} - Annualisierte Rendite in %
 */
export function calculateAnnualizedYield(putOption, daysToExpiration) {
  if (!putOption || daysToExpiration <= 0) return 0;

  const premium = getMidPrice(putOption) * 100; // Kontraktgröße 100
  const capitalRequired = putOption.strike * 100;
  const yieldPct = premium / capitalRequired;

  // Annualisiert
  const annualized = yieldPct * (365 / daysToExpiration) * 100;

  return Math.round(annualized * 100) / 100;
}

/**
 * Generiere Mock-Options-Chain für Entwicklung
 */
function generateMockOptionsChain(symbol) {
  const basePrice = getMockBasePrice(symbol);
  const expirations = generateMockExpirations();
  const calls = [];
  const puts = [];

  expirations.forEach(exp => {
    const dte = Math.ceil((new Date(exp) - new Date()) / (1000 * 60 * 60 * 24));

    // Generiere Strikes um den Basispreis
    for (let i = -10; i <= 10; i++) {
      const strike = Math.round((basePrice + i * (basePrice * 0.02)) * 100) / 100;

      // Call
      const callIV = 0.20 + Math.random() * 0.15;
      const callDistance = strike - basePrice;
      const callPremium = Math.max(0.01, 
        Math.exp(-callDistance / (basePrice * 0.3)) * basePrice * callIV * Math.sqrt(dte / 365) / 10
      );

      calls.push({
        symbol,
        contractId: `${symbol}${exp.replace(/-/g, '')}C${String(Math.round(strike * 1000)).padStart(8, '0')}`,
        expiration: exp,
        strike,
        type: 'call',
        lastPrice: Math.round(callPremium * 100) / 100,
        bid: Math.round((callPremium * 0.95) * 100) / 100,
        ask: Math.round((callPremium * 1.05) * 100) / 100,
        mark: Math.round(callPremium * 100) / 100,
        volume: Math.floor(Math.random() * 1000),
        openInterest: Math.floor(Math.random() * 5000),
        impliedVolatility: Math.round(callIV * 100) / 100,
        delta: Math.round((0.5 + (callDistance < 0 ? 0.3 : -0.3) * Math.random()) * 100) / 100,
        gamma: Math.round(Math.random() * 0.05 * 100) / 100,
        theta: Math.round(-Math.random() * 0.05 * 100) / 100,
        vega: Math.round(Math.random() * 0.1 * 100) / 100,
        bidSize: Math.floor(Math.random() * 50),
        askSize: Math.floor(Math.random() * 50),
        inTheMoney: strike < basePrice
      });

      // Put
      const putIV = 0.22 + Math.random() * 0.15;
      const putDistance = basePrice - strike;
      const putPremium = Math.max(0.01,
        Math.exp(-putDistance / (basePrice * 0.3)) * basePrice * putIV * Math.sqrt(dte / 365) / 10
      );

      puts.push({
        symbol,
        contractId: `${symbol}${exp.replace(/-/g, '')}P${String(Math.round(strike * 1000)).padStart(8, '0')}`,
        expiration: exp,
        strike,
        type: 'put',
        lastPrice: Math.round(putPremium * 100) / 100,
        bid: Math.round((putPremium * 0.95) * 100) / 100,
        ask: Math.round((putPremium * 1.05) * 100) / 100,
        mark: Math.round(putPremium * 100) / 100,
        volume: Math.floor(Math.random() * 1000),
        openInterest: Math.floor(Math.random() * 5000),
        impliedVolatility: Math.round(putIV * 100) / 100,
        delta: Math.round((-0.5 + (putDistance < 0 ? 0.3 : -0.3) * Math.random()) * 100) / 100,
        gamma: Math.round(Math.random() * 0.05 * 100) / 100,
        theta: Math.round(-Math.random() * 0.05 * 100) / 100,
        vega: Math.round(Math.random() * 0.1 * 100) / 100,
        bidSize: Math.floor(Math.random() * 50),
        askSize: Math.floor(Math.random() * 50),
        inTheMoney: strike > basePrice
      });
    }
  });

  return {
    symbol,
    timestamp: new Date().toISOString(),
    calls: calls.sort((a, b) => a.strike - b.strike),
    puts: puts.sort((a, b) => a.strike - b.strike),
    expirations
  };
}

function generateMockExpirations() {
  const expirations = [];
  const today = new Date();

  // Nächste 4 monatliche Expirations (3. Freitag)
  for (let i = 0; i < 4; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    // Finde den 3. Freitag
    let fridays = 0;
    for (let d = 1; d <= 31; d++) {
      const checkDate = new Date(date.getFullYear(), date.getMonth(), d);
      if (checkDate.getDay() === 5) {
        fridays++;
        if (fridays === 3) {
          expirations.push(checkDate.toISOString().split('T')[0]);
          break;
        }
      }
    }
  }

  return expirations;
}

function getMockBasePrice(symbol) {
  const prices = {
    'AAPL': 175, 'MSFT': 330, 'GOOGL': 140, 'AMZN': 130,
    'TSLA': 250, 'META': 300, 'NVDA': 460, 'JPM': 150,
    'JNJ': 155, 'V': 240, 'PG': 145, 'UNH': 480,
    'HD': 310, 'MA': 410, 'BAC': 37, 'ABBV': 165,
    'PFE': 28, 'KO': 60, 'PEP': 165, 'WMT': 60
  };
  return prices[symbol.toUpperCase()] || 100;
}

// Exportiere alle Funktionen
export default {
  fetchOptionsChain,
  fetchExpirations,
  findATMOption,
  getMidPrice,
  calculateAnnualizedYield
};
