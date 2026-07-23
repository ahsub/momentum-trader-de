#!/usr/bin/env node
/**
 * Daily Snapshot Generator
 * Fetches market data from Yahoo Finance and generates snapshot JSON
 * Run: node scripts/generate-snapshot.js [--date YYYY-MM-DD]
 */

const fs = require('fs');
const path = require('path');

const SNAPSHOTS_DIR = path.join(process.cwd(), 'public', 'data', 'snapshots');

// Yahoo Finance proxy URL (use environment variable or default)
const YAHOO_PROXY = process.env.YAHOO_PROXY_URL || 'https://query1.finance.yahoo.com/v8/finance/chart';

const TICKERS = {
  vix: '^VIX',
  spx: '^GSPC',
  nya: '^NYA',
  tnx: '^TNX',
  dxy: 'DX-Y.NYB'
};

async function fetchYahooData(ticker, range = '1y', interval = '1d') {
  const url = `${YAHOO_PROXY}/${ticker}?range=${range}&interval=${interval}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${ticker}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      throw new Error(`No data for ${ticker}`);
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    const series = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: closes[i],
      volume: volumes[i] || 0
    })).filter(d => d.close !== null && d.close !== undefined);

    return series;
  } catch (error) {
    console.error(`Failed to fetch ${ticker}:`, error.message);
    return null;
  }
}

function calculateSMA(data, period) {
  if (data.length < period) return null;
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculatePercentile(current, history) {
  const sorted = [...history].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= current);
  return (index / sorted.length) * 100;
}

function calculateRegime(vixCurrent, vixMa20, spxCurrent, spxMa50, spxMa200, nyaChange) {
  if (vixCurrent > 30 && spxCurrent < spxMa200) return 'CRISIS';
  if (vixCurrent > 25 || nyaChange < -2.0) return 'BEAR_VOLATILE';
  if (vixCurrent < 15 && spxCurrent > spxMa50 && spxMa50 > spxMa200) return 'BULL_QUIET';
  if (vixCurrent > 20 && spxCurrent > spxMa200) return 'BULL_VOLATILE';
  if (spxCurrent < spxMa200) return 'BEAR_QUIET';
  return 'BULL_QUIET';
}

function calculateRiskScore(regime, vixPercentile) {
  const baseScores = {
    BULL_QUIET: 15,
    BULL_VOLATILE: 50,
    BEAR_QUIET: 70,
    BEAR_VOLATILE: 85,
    CRISIS: 95
  };

  const base = baseScores[regime] || 50;
  let adjustment = 0;

  switch (regime) {
    case 'BULL_QUIET':
      adjustment = vixPercentile < 30 ? -10 : vixPercentile < 50 ? 5 : 15;
      break;
    case 'BULL_VOLATILE':
      adjustment = vixPercentile < 50 ? -5 : 10;
      break;
    case 'BEAR_QUIET':
      adjustment = 5;
      break;
    default:
      adjustment = 0;
  }

  return Math.max(0, Math.min(100, base + adjustment));
}

async function generateSnapshot(targetDate = null) {
  const date = targetDate || new Date().toISOString().split('T')[0];
  console.log(`📊 Generating snapshot for ${date}...`);

  // Fetch all data in parallel
  const [vixData, spxData, nyaData, tnxData, dxyData] = await Promise.all([
    fetchYahooData(TICKERS.vix, '3mo', '1d'),
    fetchYahooData(TICKERS.spx, '1y', '1d'),
    fetchYahooData(TICKERS.nya, '3mo', '1d'),
    fetchYahooData(TICKERS.tnx, '3mo', '1d'),
    fetchYahooData(TICKERS.dxy, '3mo', '1d')
  ]);

  if (!vixData || !spxData) {
    console.error('❌ Critical data missing. Aborting.');
    process.exit(1);
  }

  // Extract latest values
  const vixCurrent = vixData[vixData.length - 1].close;
  const vixCloses = vixData.map(d => d.close);
  const vixMa20 = calculateSMA(vixCloses, 20);
  const vixPercentile = calculatePercentile(vixCurrent, vixCloses);

  const spxCurrent = spxData[spxData.length - 1].close;
  const spxCloses = spxData.map(d => d.close);
  const spxMa50 = calculateSMA(spxCloses, 50);
  const spxMa200 = calculateSMA(spxCloses, 200);

  const nyaCurrent = nyaData ? nyaData[nyaData.length - 1].close : null;
  const nyaPrev = nyaData && nyaData.length > 1 ? nyaData[nyaData.length - 2].close : nyaCurrent;
  const nyaChange = nyaCurrent && nyaPrev ? ((nyaCurrent - nyaPrev) / nyaPrev) * 100 : 0;

  const tnxCurrent = tnxData ? tnxData[tnxData.length - 1].close : null;
  const dxyCurrent = dxyData ? dxyData[dxyData.length - 1].close : null;

  // Calculate regime and risk
  const regime = calculateRegime(vixCurrent, vixMa20, spxCurrent, spxMa50, spxMa200, nyaChange);
  const riskScore = calculateRiskScore(regime, vixPercentile);
  const circuitBreaker = regime === 'CRISIS' || riskScore >= 90;

  const snapshot = {
    date,
    vix: {
      current: Math.round(vixCurrent * 100) / 100,
      ma20: Math.round(vixMa20 * 100) / 100,
      percentile: Math.round(vixPercentile * 10) / 10
    },
    spx: {
      current: Math.round(spxCurrent * 100) / 100,
      ma50: Math.round(spxMa50 * 100) / 100,
      ma200: Math.round(spxMa200 * 100) / 100,
      aboveMa50: spxCurrent > spxMa50,
      aboveMa200: spxCurrent > spxMa200,
      trend: spxCurrent > spxMa200 ? 'bull' : 'bear'
    },
    breadth: {
      nyaCurrent: nyaCurrent ? Math.round(nyaCurrent * 100) / 100 : null,
      nyaChangePercent: Math.round(nyaChange * 100) / 100,
      volume: nyaData ? nyaData[nyaData.length - 1].volume : 0,
      volumeMa20: nyaData ? Math.round(calculateSMA(nyaData.map(d => d.volume), 20)) : 0
    },
    treasury10y: tnxCurrent ? Math.round(tnxCurrent * 100) / 100 : null,
    dxy: dxyCurrent ? Math.round(dxyCurrent * 100) / 100 : null,
    computed: {
      regime,
      riskScore: Math.round(riskScore),
      circuitBreaker,
      timestamp: new Date().toISOString()
    }
  };

  // Ensure directory exists
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  // Save dated snapshot
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${date}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`✅ Snapshot saved: ${snapshotPath}`);

  // Update latest.json symlink
  const latestPath = path.join(SNAPSHOTS_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(snapshot, null, 2));
  console.log(`✅ Latest updated: ${latestPath}`);

  // Print summary
  console.log(`
📈 Summary for ${date}:`);
  console.log(`   Regime: ${regime}`);
  console.log(`   Risk Score: ${riskScore}/100`);
  console.log(`   Circuit Breaker: ${circuitBreaker ? '🔴 ACTIVE' : '🟢 Inactive'}`);
  console.log(`   VIX: ${vixCurrent.toFixed(2)} (p${vixPercentile.toFixed(1)})`);
  console.log(`   SPX: ${spxCurrent.toFixed(2)} (MA50: ${spxMa50?.toFixed(2)}, MA200: ${spxMa200?.toFixed(2)})`);

  return snapshot;
}

// CLI entry point
const targetDate = process.argv.find(arg => arg.startsWith('--date='))?.split('=')[1];
generateSnapshot(targetDate).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
