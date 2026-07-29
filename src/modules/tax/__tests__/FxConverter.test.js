// src/modules/tax/__tests__/FxConverter.test.js
import { describe, it, expect } from 'vitest';
import FxConverter from '../report/FxConverter.js';

describe('FxConverter', () => {
  it('sollte EUR-Beträge unverändert lassen', () => {
    const converter = new FxConverter();
    const result = converter.konvertiereNachEuro(1000, 'EUR', '2026-03-15');

    expect(result.betragEUR).toBe(1000);
    expect(result.kurs).toBe(1);
    expect(result.quelle).toBe('EUR');
  });

  it('sollte USD mit IBKR-Kurs konvertieren', () => {
    const converter = new FxConverter();
    const result = converter.konvertiereNachEuro(1000, 'USD', '2026-03-15', 0.92);

    expect(result.betragEUR).toBeCloseTo(1086.96, 2);
    expect(result.kurs).toBe(0.92);
    expect(result.quelle).toBe('IBKR (nicht validiert)');
  });

  it('sollte Warnung bei großer Abweichung ausgeben', async () => {
    const converter = new FxConverter({ toleranz: 0.01 });

    // EZB-Kurs laden
    await converter.ladeEZBKurse('Date,USD\n2026-03-15,0.90');

    // IBKR-Kurs weicht >1% ab
    const result = converter.konvertiereNachEuro(1000, 'USD', '2026-03-15', 0.92);

    expect(result.warnung).not.toBeNull();
    expect(result.kurs).toBe(0.90); // EZB-Kurs bevorzugt
    expect(converter.getWarnungen()).toHaveLength(1);
  });

  it('sollte Trade korrekt konvertieren', () => {
    const converter = new FxConverter();
    const trade = {
      fifoPnlRealized: 200,
      proceeds: 1700,
      commission: -1.5,
      costBasisMoney: -1500,
      currency: 'USD',
      fxRateToBase: 0.92,
      date: '2026-04-20',
    };

    const result = converter.konvertiereTrade(trade);

    expect(result.fifoPnlRealizedEUR).toBeCloseTo(217.39, 2);
    expect(result.proceedsEUR).toBeCloseTo(1847.83, 2);
    expect(result.commissionEUR).toBeCloseTo(-1.63, 2);
  });
});
