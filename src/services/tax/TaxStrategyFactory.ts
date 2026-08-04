// src/services/tax/TaxStrategyFactory.ts
import type { AssetClass, TaxRule } from '@/types/tax';
import {
  BaseTaxStrategy,
  EquityStrategy,
  CryptoStrategy,
  PreciousMetalStrategy,
  DerivativeStrategy,
} from './strategies';
import { TaxConfigLoader } from './config/TaxConfigLoader';

export class TaxStrategyFactory {
  private static strategies: Map<AssetClass, typeof BaseTaxStrategy> = new Map([
    [AssetClass.EQUITY, EquityStrategy],
    [AssetClass.CRYPTO, CryptoStrategy],
    [AssetClass.PRECIOUS_METAL, PreciousMetalStrategy],
    [AssetClass.DERIVATIVE, DerivativeStrategy],
    [AssetClass.BOND, EquityStrategy], // Anleihen nutzen gleiche Logik wie Aktien
  ]);

  static createStrategy(assetClass: AssetClass, customRule?: TaxRule): BaseTaxStrategy {
    const rule = customRule ?? TaxConfigLoader.getRule(assetClass);
    const StrategyClass = this.strategies.get(assetClass);

    if (!StrategyClass) {
      throw new Error(`No strategy registered for asset class: ${assetClass}`);
    }

    return new StrategyClass(rule);
  }

  static registerStrategy(
    assetClass: AssetClass,
    strategyClass: typeof BaseTaxStrategy,
    rule: TaxRule
  ): void {
    this.strategies.set(assetClass, strategyClass);
    TaxConfigLoader.setCustomRule(assetClass, rule);
  }

  static getRegisteredAssetClasses(): AssetClass[] {
    return Array.from(this.strategies.keys());
  }
}
