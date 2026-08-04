// src/services/tax/config/TaxConfigLoader.ts
import type { TaxRule, AssetClass } from '@/types/tax';
import taxRules from './tax-rules.json';

export interface TaxConfig {
  version: string;
  description: string;
  lastUpdated: string;
  rules: Record<string, TaxRule>;
  changelog: Array<{
    version: string;
    date: string;
    changes: string[];
  }>;
}

export class TaxConfigLoader {
  private static config: TaxConfig = taxRules as TaxConfig;

  static getRule(assetClass: AssetClass): TaxRule {
    const rule = this.config.rules[assetClass];
    if (!rule) {
      throw new Error(`No tax rule defined for asset class: ${assetClass}`);
    }
    return rule;
  }

  static getAllRules(): Record<string, TaxRule> {
    return { ...this.config.rules };
  }

  static getVersion(): string {
    return this.config.version;
  }

  static getChangelog() {
    return this.config.changelog;
  }

  static setCustomRule(assetClass: AssetClass, rule: TaxRule): void {
    this.config.rules[assetClass] = rule;
  }
}
