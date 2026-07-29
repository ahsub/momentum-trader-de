// src/modules/tax/index.js
// ═══════════════════════════════════════════════════════════════════════════════
// Tax Module — Haupt-Export
// ═══════════════════════════════════════════════════════════════════════════════

export { default as TaxEngine } from './TaxEngine.js';
export { default as TaxReportEngine } from './report/TaxReportEngine.js';
export { default as FlexQueryParser } from './report/FlexQueryParser.js';
export { default as FxConverter } from './report/FxConverter.js';
export { default as FifoValidator } from './report/FifoValidator.js';
export { default as KapReportGenerator } from './report/KapReportGenerator.js';

export * from './taxConfig.js';
export * from './instrumentTypes.js';
