// Stub für CapTraderImport Kompatibilität
export default class TaxReportEngine {
  constructor(config) {
    this.config = config;
  }
  
  async processFlexQuery(xmlData) {
    console.warn('TaxReportEngine: FlexQuery-Import noch nicht mit neuer Engine integriert');
    return { trades: [], summary: {}, kap: {}, einkuenfte: {} };
  }
}
