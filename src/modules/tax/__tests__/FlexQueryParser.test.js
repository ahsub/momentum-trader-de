// src/modules/tax/__tests__/FlexQueryParser.test.js
import { describe, it, expect } from 'vitest';
import FlexQueryParser from '../report/FlexQueryParser.js';

describe('FlexQueryParser', () => {
  const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="Steuerreport" type="AF">
  <Trades>
    <Trade tradeID="12345" symbol="AAPL" isin="US0378331005" assetCategory="STK" 
           buySell="BUY" quantity="10" tradePrice="150" proceeds="-1500" 
           commission="-1.5" fifoPnlRealized="0" fifoPnlUnrealized="0"
           currency="USD" fxRateToBase="0.92" dateTime="2026-03-15T14:30:00"/>
    <Trade tradeID="12346" symbol="AAPL" isin="US0378331005" assetCategory="STK" 
           buySell="SELL" quantity="10" tradePrice="170" proceeds="1700" 
           commission="-1.5" fifoPnlRealized="200" fifoPnlUnrealized="0"
           currency="USD" fxRateToBase="0.92" dateTime="2026-04-20T10:15:00"
           costBasisMoney="-1500"/>
    <Trade tradeID="12347" symbol="SPY" assetCategory="ETF" 
           buySell="SELL" quantity="5" tradePrice="400" proceeds="2000"
           fifoPnlRealized="300" currency="USD" fxRateToBase="0.91" 
           dateTime="2026-05-10T09:00:00"/>
    <Trade tradeID="12348" symbol="AAPL230421C00150000" assetCategory="OPT"
           buySell="SELL" quantity="1" tradePrice="2.5" proceeds="250"
           multiplier="100" fifoPnlRealized="150" currency="USD" 
           fxRateToBase="0.92" dateTime="2026-03-20T11:00:00"/>
  </Trades>
  <CashTransactions>
    <CashTransaction type="Dividends" symbol="AAPL" isin="US0378331005"
                     amount="25" currency="USD" fxRateToBase="0.92"
                     dateTime="2026-02-15T00:00:00" description="AAPL DIV"/>
  </CashTransactions>
</FlexQueryResponse>`;

  it('sollte Trades korrekt parsen', async () => {
    const parser = new FlexQueryParser();
    const result = await parser.parseXml(mockXml);

    expect(result.trades).toHaveLength(3); // CASH wird ausgeschlossen
    expect(result.trades[0].symbol).toBe('AAPL');
    expect(result.trades[0].assetCategory).toBe('STK');
    expect(result.trades[2].assetCategory).toBe('OPT');
  });

  it('sollte Dividenden korrekt parsen', async () => {
    const parser = new FlexQueryParser();
    const result = await parser.parseXml(mockXml);

    expect(result.dividends).toHaveLength(1);
    expect(result.dividends[0].amount).toBe(25);
    expect(result.dividends[0].symbol).toBe('AAPL');
  });

  it('sollte Optionen mit Multiplier erkennen', async () => {
    const parser = new FlexQueryParser();
    const result = await parser.parseXml(mockXml);

    const option = result.trades.find(t => t.assetCategory === 'OPT');
    expect(option).toBeDefined();
    expect(option.multiplier).toBe(100);
    expect(option.fifoPnlRealized).toBe(150);
  });
});
