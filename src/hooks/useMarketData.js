import { useState, useEffect, useCallback } from 'react';

const YAHOO_PROXY = import.meta.env.VITE_YAHOO_PROXY_URL || '';

/**
 * Hook: fetches real-time market data from Yahoo Finance proxy
 * Falls back to snapshot data on failure
 */
export function useMarketData(ticker, period = '1d', interval = '1m') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!ticker) return;

    setLoading(true);
    setError(null);

    try {
      const url = `${YAHOO_PROXY}/v8/finance/chart/${ticker}?period1=${getPeriodStart(period)}&period2=${Math.floor(Date.now() / 1000)}&interval=${interval}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Market data fetch failed: ${response.status}`);
      }

      const json = await response.json();
      const result = json.chart?.result?.[0];

      if (!result) {
        throw new Error('No data in response');
      }

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];

      const series = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString(),
        close: closes[i] ?? null
      })).filter(d => d.close !== null);

      const latest = series[series.length - 1];

      setData({
        ticker,
        latest: latest?.close ?? null,
        series,
        meta: result.meta
      });
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ticker, period, interval]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(intervalId);
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

function getPeriodStart(period) {
  const now = Math.floor(Date.now() / 1000);
  const periods = {
    '1d': 86400,
    '5d': 86400 * 5,
    '1mo': 86400 * 30,
    '3mo': 86400 * 90,
    '6mo': 86400 * 180,
    '1y': 86400 * 365
  };
  return now - (periods[period] || 86400);
}
