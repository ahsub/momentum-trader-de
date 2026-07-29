// src/modules/tax/__tests__/TaxEngine.test.js
import { describe, it, expect } from 'vitest';
import TaxEngine from '../TaxEngine.js';

describe('TaxEngine', () => {
  describe('Steuersatz-Berechnung', () => {
    it('sollte 26,375% ohne Kirchensteuer berechnen', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: null });
      expect(engine.getEffektiverSteuersatz()).toBeCloseTo(0.26375, 5);
      expect(engine.getSteuersatzProzent()).toBe('26.375%');
    });

    it('sollte 27,99% mit Kirchensteuer 9% berechnen', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: 'rest' });
      expect(engine.getEffektiverSteuersatz()).toBeCloseTo(0.2799, 4);
    });

    it('sollte 27,82% mit Kirchensteuer 8% berechnen', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: 'bwBayern' });
      expect(engine.getEffektiverSteuersatz()).toBeCloseTo(0.2782, 4);
    });
  });

  describe('Steuerberechnung ohne Freibetrag (CapTrader)', () => {
    it('sollte Steuer auf Aktiengewinn korrekt berechnen', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: null });
      const result = engine.berechneSteuer({
        realizedPnl: 1000,
        secType: 'STK',
      });

      expect(result.steuerNetto).toBeCloseTo(263.75, 2);
      expect(result.verlusttopf).toBe('AKTIEN');
      expect(result.freibetragGenutzt).toBe(0); // Kein Freibetrag
    });

    it('sollte Steuer auf ETF-Gewinn mit Teilfreistellung berechnen', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: null });
      const result = engine.berechneSteuer({
        realizedPnl: 1000,
        secType: 'ETF',
        fondsKategorie: 'aktienfonds',
      });

      expect(result.teilfreistellungProzent).toBe(30);
      expect(result.steuerpflichtigVorFreibetrag).toBe(700); // 1000 - 30%
      expect(result.steuerNetto).toBeCloseTo(184.625, 2); // 700 * 26,375%
    });

    it('sollte Termingeschäfts-Verluste nur gegen Termingeschäfts-Gewinne verrechnen', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: null });

      // Verlust verbuchen
      engine.verbucheVerlust(500, 'CFD');

      // Gewinn berechnen
      const result = engine.berechneSteuer({
        realizedPnl: 1200,
        secType: 'CFD',
      });

      expect(result.verlustTopfGenutzt).toBe(500);
      expect(result.steuerpflichtigNachVerlust).toBe(700);
      expect(result.steuerNetto).toBeCloseTo(184.625, 2);
    });

    it('sollte Aktienverluste gegen Aktiengewinne verrechnen', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: null });

      engine.verbucheVerlust(300, 'STK');

      const result = engine.berechneSteuer({
        realizedPnl: 1000,
        secType: 'STK',
      });

      expect(result.verlustTopfGenutzt).toBe(300);
      expect(result.steuerpflichtigNachVerlust).toBe(700);
    });
  });

  describe('Verlusttöpfe', () => {
    it('sollte drei getrennte Verlusttöpfe verwalten', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: null });

      engine.verbucheVerlust(100, 'STK');
      engine.verbucheVerlust(200, 'CFD');
      engine.verbucheVerlust(300, 'ETF');

      const toepfe = engine.getVerlustToepfe();
      expect(toepfe.AKTIEN).toBe(100);
      expect(toepfe.TERMINGESCHAEFTE).toBe(200);
      expect(toepfe.ALLGEMEIN).toBe(300);
    });
  });

  describe('Serialisierung', () => {
    it('sollte JSON serialisieren und deserialisieren', () => {
      const engine = new TaxEngine({ kirchensteuerSatz: 'rest' });
      engine.verbucheVerlust(500, 'CFD');

      const json = engine.toJSON();
      const restored = TaxEngine.fromJSON(json);

      expect(restored.getVerlustToepfe().TERMINGESCHAEFTE).toBe(500);
      expect(restored.kirchensteuerSatz).toBe('rest');
    });
  });
});
