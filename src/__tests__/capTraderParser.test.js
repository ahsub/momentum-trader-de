import { describe, it, expect } from 'vitest';
import { parseCapTraderXML, filterOptionTrades, calculateTradeMetrics } from '../services/capTraderParser';

const sampleXML = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="TestQuery">
  <FlexStatements>
    <FlexStatement accountId="U1234567" fromDate="20260101" toDate="20260725">
      <OpenPositions>
        <OpenPosition>
          <symbol>AAPL</symbol>
          <assetCategory>STK</assetCategory>
          <position>100</position>
          <costBasisPrice>150.50</costBasisPrice>
          <markPrice>175.25</markPrice>
          <positionValue>17525.00</positionValue>
          <unrealizedPnl>2475.00</unrealizedPnl>
          <currency>USD</currency>
        </OpenPosition>
        <OpenPosition>
          <symbol>AAPL  250718C00180000</symbol>
          <assetCategory>OPT</assetCategory>
          <position>2</position>
          <costBasisPrice>5.50</costBasisPrice>
          <markPrice>3.25</markPrice>
          <positionValue>650.00</positionValue>
          <unrealizedPnl>-450.00</unrealizedPnl>
          <currency>USD</currency>
          <putCall>C</putCall>
          <strike>180</strike>
          <expiry>20250718</expiry>
          <underlyingSymbol>AAPL</underlyingSymbol>
        </OpenPosition>
      </OpenPositions>
      <Trades>
        <Trade>
          <symbol>MSFT  250620P00400000</symbol>
          <assetCategory>OPT</assetCategory>
          <tradeDate>20250615;120000</tradeDate>
          <quantity>-1</quantity>
          <tradePrice>2.50</tradePrice>
          <proceeds>250.00</proceeds>
          <ibCommission>-1.50</ibCommission>
          <realizedPnl>248.50</realizedPnl>
          <currency>USD</currency>
          <buySell>S</buySell>
          <putCall>P</putCall>
          <strike>400</strike>
          <expiry>20250620</expiry>
        </Trade>
        <Trade>
          <symbol>TSLA</symbol>
          <assetCategory>STK</assetCategory>
          <tradeDate>20250610;093000</tradeDate>
          <quantity>50</quantity>
          <tradePrice>220.00</tradePrice>
          <proceeds>-11000.00</proceeds>
          <ibCommission>-1.50</ibCommission>
          <realizedPnl>0</realizedPnl>
          <currency>USD</currency>
          <buySell>B</buySell>
        </Trade>
      </Trades>
      <EquitySummaryInBase>
        <netLiquidation>125000.00</netLiquidation>
        <cash>25000.00</cash>
        <buyingPower>100000.00</buyingPower>
        <currency>EUR</currency>
      </EquitySummaryInBase>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;

describe('CapTrader XML Parser', () => {
  it('parses complete XML successfully', () => {
    const result = parseCapTraderXML(sampleXML);
    expect(result.success).toBe(true);
    expect(result.accountId).toBe('U1234567');
    expect(result.openPositions).toHaveLength(2);
    expect(result.trades).toHaveLength(2);
  });

  it('parses open positions correctly', () => {
    const result = parseCapTraderXML(sampleXML);
    const stock = result.openPositions.find(p => p.assetClass === 'STOCK');
    expect(stock.symbol).toBe('AAPL');
    expect(stock.quantity).toBe(100);
    expect(stock.pnl).toBe(2475);

    const option = result.openPositions.find(p => p.assetClass === 'OPTION');
    expect(option.optionType).toBe('CALL');
    expect(option.strike).toBe(180);
    expect(option.underlying).toBe('AAPL');
  });

  it('parses trades correctly', () => {
    const result = parseCapTraderXML(sampleXML);
    const optionTrade = result.trades.find(t => t.assetClass === 'OPTION');
    expect(optionTrade.symbol).toContain('MSFT');
    expect(optionTrade.optionType).toBe('PUT');
    expect(optionTrade.pnl).toBe(248.50);
    expect(optionTrade.side).toBe('SELL');
  });

  it('parses account summary', () => {
    const result = parseCapTraderXML(sampleXML);
    expect(result.accountSummary.nav).toBe(125000);
    expect(result.accountSummary.cash).toBe(25000);
    expect(result.accountSummary.currency).toBe('EUR');
  });

  it('filters option trades', () => {
    const result = parseCapTraderXML(sampleXML);
    const options = filterOptionTrades(result.trades);
    expect(options).toHaveLength(1);
    expect(options[0].assetClass).toBe('OPTION');
  });

  it('calculates trade metrics', () => {
    const result = parseCapTraderXML(sampleXML);
    const metrics = calculateTradeMetrics(result.trades);
    expect(metrics.totalTrades).toBeGreaterThan(0);
    expect(metrics.profitFactor).toBeGreaterThan(0);
  });

  it('handles invalid XML gracefully', () => {
    const result = parseCapTraderXML('<invalid>xml');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
