import { describe, it, expect } from 'vitest';
import { parseCapTraderXml, validateFlexQueryXml, calculatePerformanceMetrics } from '../services/capTraderFlexService';

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement accountId="U1234567" fromDate="20260101" toDate="20260725" currency="USD">
      <OpenPositions>
        <OpenPosition symbol="AAPL" assetCategory="STK" position="100" markPrice="225.50" costBasisMoney="21000" marketValue="22550" currency="USD" />
        <OpenPosition symbol="TSLA" assetCategory="STK" position="-50" markPrice="248.50" costBasisMoney="-13000" marketValue="-12425" currency="USD" />
        <OpenPosition symbol="SPY" assetCategory="OPT" putCall="C" strike="450" expiry="20261220" position="2" markPrice="12.50" costBasisMoney="2200" marketValue="2500" underlyingPrice="445" delta="0.65" gamma="0.02" theta="-0.15" vega="0.35" currency="USD" />
      </OpenPositions>
      <Trades>
        <Trade symbol="AAPL" assetCategory="STK" quantity="-100" tradePrice="230.00" proceeds="23000" commFee="-1.00" realizedPnl="1500" tradeDate="20260715" currency="USD" />
        <Trade symbol="TSLA" assetCategory="STK" quantity="50" tradePrice="240.00" proceeds="-12000" commFee="-1.00" realizedPnl="-800" tradeDate="20260710" currency="USD" />
        <Trade symbol="SPY" assetCategory="OPT" putCall="P" strike="440" expiry="20250919" quantity="-1" tradePrice="5.50" proceeds="550" commFee="-0.65" realizedPnl="450" tradeDate="20260720" currency="USD" />
      </Trades>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;

describe('CapTrader Flex-Query Parser', () => {
  it('validates correct XML', () => {
    const result = validateFlexQueryXml(sampleXml);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid XML', () => {
    const result = validateFlexQueryXml('<not>valid');
    expect(result.valid).toBe(false);
  });

  it('rejects non-Flex XML', () => {
    const result = validateFlexQueryXml('<root><item>1</item></root>');
    expect(result.valid).toBe(false);
  });

  it('parses account info', () => {
    const result = parseCapTraderXml(sampleXml);
    expect(result.accountInfo.accountId).toBe('U1234567');
    expect(result.accountInfo.currency).toBe('USD');
  });

  it('parses open positions', () => {
    const result = parseCapTraderXml(sampleXml);
    expect(result.openPositions).toHaveLength(3);

    const aapl = result.openPositions.find(p => p.symbol === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl.assetType).toBe('STOCK');
    expect(aapl.quantity).toBe(100);
    expect(aapl.currentPrice).toBe(225.50);

    const spy = result.openPositions.find(p => p.symbol === 'SPY');
    expect(spy).toBeDefined();
    expect(spy.assetType).toBe('OPTION');
    expect(spy.optionType).toBe('call');
    expect(spy.strike).toBe(450);
    expect(spy.greeks.delta).toBe(0.65);
  });

  it('parses trades', () => {
    const result = parseCapTraderXml(sampleXml);
    expect(result.trades).toHaveLength(3);

    const aaplTrade = result.trades.find(t => t.symbol === 'AAPL');
    expect(aaplTrade).toBeDefined();
    expect(aaplTrade.pnl).toBe(1500);
    expect(aaplTrade.status).toBe('closed');

    const spyTrade = result.trades.find(t => t.symbol === 'SPY');
    expect(spyTrade).toBeDefined();
    expect(spyTrade.optionType).toBe('put');
    expect(spyTrade.strike).toBe(440);
  });

  it('parses cash', () => {
    const result = parseCapTraderXml(sampleXml);
    expect(result.cash).toBeDefined();
    expect(result.cash.currency).toBe('USD');
  });

  it('calculates performance metrics', () => {
    const result = parseCapTraderXml(sampleXml);
    const metrics = calculatePerformanceMetrics(result.trades);

    expect(metrics.totalTrades).toBe(3);
    expect(metrics.winners).toBe(2);
    expect(metrics.losers).toBe(1);
    expect(metrics.totalPnl).toBe(1150); // 1500 - 800 + 450
    expect(metrics.bestTrade).toBe(1500);
    expect(metrics.worstTrade).toBe(-800);
    expect(metrics.winRate).toBeCloseTo(66.67, 1);
  });

  it('handles empty trades gracefully', () => {
    const metrics = calculatePerformanceMetrics([]);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.totalPnl).toBe(0);
  });
});
