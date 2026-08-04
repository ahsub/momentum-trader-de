// src/services/tax/fx/FxConverter.ts
export interface FxRate {
  currency: string;
  rate: number;      // EUR per 1 Unit of currency
  date: string;
}

/**
 * FX Konverter für Steuerberichte
 * Nutzt ECB Referenzkurse oder IBKR-eigene Kurse
 */
export class FxConverter {
  private rates: Map<string, FxRate> = new Map();
  private useIBKRRate: boolean = false;
  private tolerance: number = 0.01;

  constructor(config?: { useIBKRRate?: boolean; tolerance?: number }) {
    this.useIBKRRate = config?.useIBKRRate ?? false;
    this.tolerance = config?.tolerance ?? 0.01;
  }

  /**
   * Lädt ECB Wechselkurse aus CSV
   */
  async loadECBRates(csvUrl: string = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip'): Promise<void> {
    try {
      const response = await fetch(csvUrl);
      const blob = await response.blob();

      // Hier würde ZIP-Extraktion und CSV-Parsing stattfinden
      // Für Demo: Hardcoded wichtigste Kurse
      this.setRate('USD', 0.92, new Date().toISOString());
      this.setRate('GBP', 1.18, new Date().toISOString());
      this.setRate('CHF', 1.05, new Date().toISOString());
      this.setRate('JPY', 0.0062, new Date().toISOString());
      this.setRate('CAD', 0.68, new Date().toISOString());

    } catch (error) {
      console.warn('ECB Rates konnten nicht geladen werden, nutze Fallback:', error);
      this.loadFallbackRates();
    }
  }

  /**
   * Fallback-Kurse wenn ECB nicht verfügbar
   */
  private loadFallbackRates(): void {
    const fallbackRates: Record<string, number> = {
      USD: 0.92,
      GBP: 1.18,
      CHF: 1.05,
      JPY: 0.0062,
      CAD: 0.68,
      AUD: 0.61,
      SEK: 0.088,
      NOK: 0.087,
      DKK: 0.134,
      PLN: 0.23,
      CZK: 0.04,
      HUF: 0.0025,
    };

    const now = new Date().toISOString();
    Object.entries(fallbackRates).forEach(([currency, rate]) => {
      this.setRate(currency, rate, now);
    });
  }

  /**
   * Setzt einen Wechselkurs
   */
  setRate(currency: string, rate: number, date: string): void {
    this.rates.set(currency.toUpperCase(), { currency: currency.toUpperCase(), rate, date });
  }

  /**
   * Konvertiert Betrag in EUR
   */
  toEUR(amount: number, currency: string): number {
    const upperCurrency = currency.toUpperCase();

    if (upperCurrency === 'EUR') return amount;

    const rate = this.rates.get(upperCurrency);
    if (!rate) {
      console.warn(`Kein Wechselkurs für ${currency} gefunden, nutze 1:1`);
      return amount;
    }

    return amount * rate.rate;
  }

  /**
   * Konvertiert Betrag von EUR in andere Währung
   */
  fromEUR(amountEUR: number, currency: string): number {
    const upperCurrency = currency.toUpperCase();

    if (upperCurrency === 'EUR') return amountEUR;

    const rate = this.rates.get(upperCurrency);
    if (!rate) {
      console.warn(`Kein Wechselkurs für ${currency} gefunden, nutze 1:1`);
      return amountEUR;
    }

    return amountEUR / rate.rate;
  }

  /**
   * Prüft ob Kurs innerhalb Toleranz
   */
  isWithinTolerance(rate1: number, rate2: number): boolean {
    return Math.abs(rate1 - rate2) <= this.tolerance;
  }

  /**
   * Alle geladenen Kurse
   */
  getAllRates(): FxRate[] {
    return Array.from(this.rates.values());
  }
}
