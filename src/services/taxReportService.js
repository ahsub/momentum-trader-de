/**
 * Tax Report Service v3 – Korrekte Steuerberechnung für Deutschland
 * Basierend auf Refundex-Logik (ahsub/Refundex)
 *
 * KORREKTUR v3:
 * - Options-P&L: Prämie empfangen = Gewinn, Prämie gezahlt = Verlust
 * - Assignment: Prämie geht in Aktien-Cost-Basis ein, NICHT als Options-Gewinn
 * - Expired: Short = volle Prämie, Long = totaler Verlust
 * - FIFO für Aktien mit korrekter Cost-Basis-Anpassung
 * - Multiplier-Korrektur: IBKR liefert Prämie oft schon *100
 */

const TAX_RATES = {
  abgeltungsteuer: 0.25,
  soli: 0.055,
  kirchensteuer: {
    none: 0,
    bw_bayern: 0.08,
    other: 0.09,
  }
};

const SPARER_PAUSCHBETRAG = 1000;

function toEUR(amount, fxRateToBase, currency) {
  if (!amount) return 0;
  if (currency === 'EUR' || !fxRateToBase || fxRateToBase === 0) return amount;
  return amount / fxRateToBase;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════
// AKTIEN-FIFO (korrekt mit Options-Prämien-Anpassung)
// ═══════════════════════════════════════════════════════════════

export function calculateStockFIFOPnL(trades, optionsData = []) {
  const bySymbol = {};
  trades.filter(t => t.assetCategory === 'STK').forEach(t => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = [];
    bySymbol[t.symbol].push(t);
  });

  const optionAdjustments = {};
  optionsData.forEach(opt => {
    if (opt.assignment && opt.underlying) {
      if (!optionAdjustments[opt.underlying]) optionAdjustments[opt.underlying] = [];
      optionAdjustments[opt.underlying].push(opt);
    }
  });

  const realizedTrades = [];

  Object.entries(bySymbol).forEach(([symbol, symbolTrades]) => {
    const sorted = symbolTrades.sort((a, b) => new Date(a.tradeDate) - new Date(b.tradeDate));
    const fifoQueue = [];

    sorted.forEach(trade => {
      const qty = Math.abs(trade.quantity);
      const fxRate = trade.fxRateToBase || 1;
      const currency = trade.currency || 'EUR';
      const priceEUR = toEUR(trade.tradePrice, fxRate, currency);
      const commissionEUR = toEUR(Math.abs(trade.commission || 0), fxRate, currency);

      if (trade.buySell === 'BUY') {
        const optAdj = optionAdjustments[symbol]?.find(o =>
          o.assignmentDate === trade.tradeDate &&
          Math.abs(o.assignedQty - qty) < 0.01
        );

        const adjustedCost = priceEUR + (commissionEUR / qty);
        const optionPremiumPerShare = optAdj ? optAdj.premiumPerShareEUR : 0;

        fifoQueue.push({
          qty,
          price: adjustedCost,
          commission: commissionEUR / qty,
          date: trade.tradeDate,
          optionPremiumEUR: optionPremiumPerShare,
          tradeId: trade.tradeId,
          isAssignment: !!optAdj,
        });
      } else if (trade.buySell === 'SELL') {
        let remaining = qty;
        let totalCost = 0;
        const matchedLots = [];

        while (remaining > 0 && fifoQueue.length > 0) {
          const lot = fifoQueue[0];
          const sellQty = Math.min(remaining, lot.qty);

          const lotCost = sellQty * lot.price + sellQty * lot.commission;
          totalCost += lotCost;

          matchedLots.push({
            buyDate: lot.date,
            buyPrice: lot.price,
            quantity: sellQty,
            costEUR: lotCost,
            optionPremiumEUR: lot.optionPremiumEUR || 0,
            isAssignment: lot.isAssignment,
          });

          lot.qty -= sellQty;
          remaining -= sellQty;
          if (lot.qty <= 0) fifoQueue.shift();
        }

        const proceedsEUR = qty * priceEUR - commissionEUR;
        const realizedPnlEUR = proceedsEUR - totalCost;
        const holdingDays = matchedLots.length > 0
          ? Math.ceil((new Date(trade.tradeDate) - new Date(matchedLots[0].buyDate)) / (1000 * 60 * 60 * 24))
          : 0;

        realizedTrades.push({
          symbol,
          sellDate: trade.tradeDate,
          quantity: qty,
          sellPriceEUR: priceEUR,
          proceedsEUR,
          totalCostEUR: totalCost,
          realizedPnlEUR,
          commissionEUR,
          holdingDays,
          matchedLots,
          tradeId: trade.tradeId,
          description: trade.description,
        });
      }
    });
  });

  return {
    realizedTrades,
    totalRealizedEUR: round2(realizedTrades.reduce((s, t) => s + t.realizedPnlEUR, 0)),
  };
}

// ═══════════════════════════════════════════════════════════════
// OPTIONEN-P&L (korrigiert v3)
// ═══════════════════════════════════════════════════════════════

/**
 * KORREKTE Options-P&L Berechnung
 *
 * Regeln:
 * 1. SHORT OPEN: Prämie empfangen = Gewinn (positiv)
 * 2. LONG OPEN: Prämie gezahlt = Verlust (negativ)
 * 3. SHORT CLOSE (BUY back): Kaufpreis = Verlust (negativ)
 * 4. LONG CLOSE (SELL): Verkaufserlös = Gewinn (positiv)
 * 5. Assignment: Prämie geht NICHT in Options-P&L, sondern in Aktien-Cost-Basis
 * 6. Expired worthless: Short = volle Prämie, Long = totaler Verlust
 */
export function calculateOptionsPnL(trades) {
  const optionTrades = trades.filter(t => t.assetCategory === 'OPT');

  // Gruppiere nach Underlying + Strike + Expiry + PutCall
  const grouped = {};
  optionTrades.forEach(t => {
    const key = `${t.underlyingSymbol}_${t.strike}_${t.expiry}_${t.putCall}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  const positions = [];
  const dailyPnL = {};

  Object.entries(grouped).forEach(([key, trades]) => {
    const sorted = trades.sort((a, b) => new Date(a.tradeDate) - new Date(b.tradeDate));
    const first = sorted[0];

    let netPremiumEUR = 0;
    let isAssigned = false;
    let isExpired = false;
    const tradeDetails = [];

    sorted.forEach(t => {
      const fxRate = t.fxRateToBase || 1;
      const currency = t.currency || 'EUR';
      // Multiplier: IBKR liefert quantity oft schon *100, prüfe ob wir multiplizieren müssen
      // Wenn quantity z.B. 1 für 1 Contract ist, multiplier = 100
      // Wenn quantity schon 100 ist, multiplier = 1
      const rawQty = Math.abs(t.quantity);
      const multiplier = t.multiplier || 100;
      // Prämie: Bei IBKR ist tradePrice oft der Preis pro Share, also * multiplier für Contract
      // Aber: Wenn quantity schon 100 ist, ist es wahrscheinlich schon Contract-Prämie
      const isContractQty = rawQty >= 100 && Number.isInteger(rawQty / 100);
      const effectiveMultiplier = isContractQty ? 1 : multiplier;
      const contractQty = isContractQty ? rawQty / multiplier : rawQty;

      const premium = contractQty * t.tradePrice * effectiveMultiplier;
      const premiumEUR = toEUR(premium, fxRate, currency);
      const commissionEUR = toEUR(Math.abs(t.commission || 0), fxRate, currency);

      // Assignment erkennen: openCloseIndicator === '' oder notes enthält 'A'
      const isAssignment = !t.openCloseIndicator || t.openCloseIndicator === '' || t.notes?.includes('A');

      if (isAssignment) {
        isAssigned = true;
        // Prämie bei Assignment NICHT als Options-Gewinn zählen
        tradeDetails.push({
          date: t.tradeDate,
          type: 'ASSIGNMENT',
          buySell: t.buySell,
          quantity: contractQty,
          price: t.tradePrice,
          premiumEUR: 0,
          commissionEUR,
          fxRate,
          currency,
          assignedUnderlying: t.underlyingSymbol,
          assignedStrike: t.strike,
        });
      } else if (t.buySell === 'SELL') {
        // SELL = Prämie empfangen (Short-Open oder Long-Close)
        if (t.openCloseIndicator === 'O') {
          // Short Open: Gewinn
          netPremiumEUR += premiumEUR - commissionEUR;
          tradeDetails.push({
            date: t.tradeDate,
            type: 'OPEN_SHORT',
            buySell: 'SELL',
            quantity: contractQty,
            price: t.tradePrice,
            premiumEUR: premiumEUR - commissionEUR,
            commissionEUR,
            fxRate,
            currency,
          });
        } else if (t.openCloseIndicator === 'C') {
          // Long Close: Gewinn
          netPremiumEUR += premiumEUR - commissionEUR;
          tradeDetails.push({
            date: t.tradeDate,
            type: 'CLOSE_LONG',
            buySell: 'SELL',
            quantity: contractQty,
            price: t.tradePrice,
            premiumEUR: premiumEUR - commissionEUR,
            commissionEUR,
            fxRate,
            currency,
          });
        } else {
          // Fallback: SELL = immer Gewinn
          netPremiumEUR += premiumEUR - commissionEUR;
          tradeDetails.push({
            date: t.tradeDate,
            type: 'SELL',
            buySell: 'SELL',
            quantity: contractQty,
            price: t.tradePrice,
            premiumEUR: premiumEUR - commissionEUR,
            commissionEUR,
            fxRate,
            currency,
          });
        }
      } else if (t.buySell === 'BUY') {
        // BUY = Prämie gezahlt (Long-Open oder Short-Close)
        if (t.openCloseIndicator === 'O') {
          // Long Open: Verlust
          netPremiumEUR -= premiumEUR + commissionEUR;
          tradeDetails.push({
            date: t.tradeDate,
            type: 'OPEN_LONG',
            buySell: 'BUY',
            quantity: contractQty,
            price: t.tradePrice,
            premiumEUR: -(premiumEUR + commissionEUR),
            commissionEUR,
            fxRate,
            currency,
          });
        } else if (t.openCloseIndicator === 'C') {
          // Short Close: Verlust
          netPremiumEUR -= premiumEUR + commissionEUR;
          tradeDetails.push({
            date: t.tradeDate,
            type: 'CLOSE_SHORT',
            buySell: 'BUY',
            quantity: contractQty,
            price: t.tradePrice,
            premiumEUR: -(premiumEUR + commissionEUR),
            commissionEUR,
            fxRate,
            currency,
          });
        } else {
          // Fallback: BUY = immer Verlust
          netPremiumEUR -= premiumEUR + commissionEUR;
          tradeDetails.push({
            date: t.tradeDate,
            type: 'BUY',
            buySell: 'BUY',
            quantity: contractQty,
            price: t.tradePrice,
            premiumEUR: -(premiumEUR + commissionEUR),
            commissionEUR,
            fxRate,
            currency,
          });
        }
      }
    });

    // Prüfe auf Expiration: Wenn letzter Trade ein Short-Open war und keine Close/Assign
    const lastTrade = sorted[sorted.length - 1];
    if (lastTrade?.buySell === 'SELL' && !isAssigned && sorted.length === 1) {
      isExpired = true;
    }

    // Tagesgenaue Aufstellung (nur nicht-Assignment Trades mit Prämie)
    tradeDetails.forEach(td => {
      if (td.premiumEUR !== 0) {
        if (!dailyPnL[td.date]) {
          dailyPnL[td.date] = { date: td.date, stockPnL: 0, optionsPnL: 0, dividends: 0, total: 0 };
        }
        dailyPnL[td.date].optionsPnL += td.premiumEUR;
        dailyPnL[td.date].total += td.premiumEUR;
      }
    });

    positions.push({
      key,
      underlying: first.underlyingSymbol,
      symbol: first.symbol,
      strike: first.strike,
      expiry: first.expiry,
      putCall: first.putCall,
      netPremiumEUR: round2(netPremiumEUR),
      isAssigned,
      isExpired,
      tradeCount: sorted.length,
      tradeDetails,
      status: isAssigned ? 'ASSIGNED' : isExpired ? 'EXPIRED' : 'CLOSED',
    });
  });

  return {
    positions,
    totalPremiumEUR: round2(positions.reduce((s, p) => s + p.netPremiumEUR, 0)),
    dailyPnL,
  };
}

// ═══════════════════════════════════════════════════════════════
// DIVIDENDEN
// ═══════════════════════════════════════════════════════════════

export function calculateDividends(parsedData) {
  return parsedData.allDividends?.map(d => ({
    symbol: d.symbol,
    description: d.description,
    date: d.date,
    amountOriginal: d.amount,
    currency: d.currency || 'EUR',
    fxRate: d.fxRate || 1,
    amountEUR: round2(d.amountEUR || toEUR(d.amount, d.fxRate, d.currency)),
    isin: d.isin,
  })) || [];
}

// ═══════════════════════════════════════════════════════════════
// STEUERBERECHNUNG
// ═══════════════════════════════════════════════════════════════

export function calculateGermanTaxes({
  realizedStockPnL_EUR = 0,
  realizedOptionsPnL_EUR = 0,
  dividends_EUR = [],
  churchTaxKey = 'none',
  isJointAccount = false
}) {
  const sparerPauschbetrag = isJointAccount ? 2000 : 1000;

  const totalDividends = dividends_EUR.reduce((s, d) => s + d.amountEUR, 0);
  const totalRealized = realizedStockPnL_EUR + realizedOptionsPnL_EUR + totalDividends;

  // Kapitalerträge = Realisierte Gewinne + Dividenden
  const taxableGains = Math.max(0, totalRealized);
  const usedAllowance = Math.min(taxableGains, sparerPauschbetrag);
  const remainingTaxable = Math.max(0, taxableGains - sparerPauschbetrag);

  const abgeltung = remainingTaxable * TAX_RATES.abgeltungsteuer;
  const soli = abgeltung * TAX_RATES.soli;
  const kirchensteuerRate = TAX_RATES.kirchensteuer[churchTaxKey] || 0;
  const kirchensteuer = abgeltung * kirchensteuerRate;

  const totalTax = abgeltung + soli + kirchensteuer;
  const netGain = totalRealized - totalTax;

  // Quellensteuer auf Dividenden (15% Standard)
  const withholdingTax = dividends_EUR.reduce((s, d) => s + d.amountEUR * 0.15, 0);

  return {
    realizedStockPnL_EUR,
    realizedOptionsPnL_EUR,
    totalDividends,
    totalRealized,
    sparerPauschbetrag,
    usedAllowance,
    remainingTaxable,
    abgeltungsteuer: round2(abgeltung),
    soli: round2(soli),
    kirchensteuer: round2(kirchensteuer),
    totalTax: round2(totalTax),
    netGain: round2(netGain),
    withholdingTax: round2(withholdingTax),
    effectiveTaxRate: totalRealized > 0 ? round2((totalTax / totalRealized) * 100) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// JAHRESBERICHT (korrigiert v3)
// ═══════════════════════════════════════════════════════════════

export function generateAnnualReport(parsedData, year, taxOptions = {}) {
  const yearTrades = parsedData.allTrades?.filter(t => {
    const tradeYear = new Date(t.tradeDate).getFullYear();
    return tradeYear === year;
  }) || [];

  const yearDividends = parsedData.allDividends?.filter(d => {
    const divYear = new Date(d.date).getFullYear();
    return divYear === year;
  }) || [];

  // 1. Options-P&L berechnen (für Assignment-Daten)
  const optionsResult = calculateOptionsPnL(yearTrades);

  // 2. Aktien-FIFO mit Options-Prämien-Anpassung
  const stockPnL = calculateStockFIFOPnL(yearTrades, optionsResult.positions);

  const dividends = calculateDividends({ allDividends: yearDividends });

  const totalRealized = stockPnL.totalRealizedEUR + optionsResult.totalPremiumEUR;

  const tax = calculateGermanTaxes({
    realizedStockPnL_EUR: stockPnL.totalRealizedEUR,
    realizedOptionsPnL_EUR: optionsResult.totalPremiumEUR,
    dividends_EUR: dividends,
    ...taxOptions
  });

  // TAGESGENAUE Aufstellung
  const dailyBreakdown = {};

  // Aktienverkäufe
  stockPnL.realizedTrades.forEach(t => {
    if (!dailyBreakdown[t.sellDate]) {
      dailyBreakdown[t.sellDate] = { date: t.sellDate, stockPnL: 0, optionsPnL: 0, dividends: 0, total: 0 };
    }
    dailyBreakdown[t.sellDate].stockPnL = round2(dailyBreakdown[t.sellDate].stockPnL + t.realizedPnlEUR);
    dailyBreakdown[t.sellDate].total = round2(dailyBreakdown[t.sellDate].total + t.realizedPnlEUR);
  });

  // Optionen
  Object.values(optionsResult.dailyPnL).forEach(day => {
    if (!dailyBreakdown[day.date]) {
      dailyBreakdown[day.date] = { date: day.date, stockPnL: 0, optionsPnL: 0, dividends: 0, total: 0 };
    }
    dailyBreakdown[day.date].optionsPnL = round2(dailyBreakdown[day.date].optionsPnL + day.optionsPnL);
    dailyBreakdown[day.date].total = round2(dailyBreakdown[day.date].total + day.optionsPnL);
  });

  // Dividenden
  dividends.forEach(d => {
    if (!dailyBreakdown[d.date]) {
      dailyBreakdown[d.date] = { date: d.date, stockPnL: 0, optionsPnL: 0, dividends: 0, total: 0 };
    }
    dailyBreakdown[d.date].dividends = round2(dailyBreakdown[d.date].dividends + d.amountEUR);
    dailyBreakdown[d.date].total = round2(dailyBreakdown[d.date].total + d.amountEUR);
  });

  return {
    year,
    summary: {
      totalTrades: yearTrades.length,
      stockTrades: yearTrades.filter(t => t.assetCategory === 'STK').length,
      optionTrades: yearTrades.filter(t => t.assetCategory === 'OPT').length,
      totalRealizedPnL_EUR: round2(totalRealized),
      stockPnL_EUR: stockPnL.totalRealizedEUR,
      optionsPnL_EUR: optionsResult.totalPremiumEUR,
      dividendIncome_EUR: round2(dividends.reduce((s, d) => s + d.amountEUR, 0)),
    },
    fifoDetails: stockPnL,
    optionsDetails: optionsResult,
    dividends,
    tax,
    dailyBreakdown: Object.values(dailyBreakdown).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════

export function exportTaxCSV(report) {
  const rows = [
    ['Datum', 'Einkommensart', 'Symbol', 'ISIN', 'Menge', 'Kurs_EUR', 'Erloes_EUR', 'Kosten_EUR', 'Realisiert_EUR', 'FX_Rate', 'Waehrung', 'Hinweis'],
  ];

  // Aktienverkäufe
  report.fifoDetails.realizedTrades.forEach(t => {
    const isAssignment = t.matchedLots.some(l => l.isAssignment);
    rows.push([
      t.sellDate,
      'Aktienverkauf',
      t.symbol,
      t.isin || '',
      t.quantity,
      t.sellPriceEUR.toFixed(4),
      t.proceedsEUR.toFixed(2),
      t.totalCostEUR.toFixed(2),
      t.realizedPnlEUR.toFixed(2),
      t.sellFxRate?.toFixed(4) || '1.0000',
      t.sellCurrency || 'EUR',
      isAssignment ? 'inkl. Options-Assignment' : '',
    ]);
  });

  // Optionen (nur nicht-Assignment Trades)
  report.optionsDetails.positions.forEach(pos => {
    pos.tradeDetails.forEach(td => {
      if (td.type === 'ASSIGNMENT') return;
      rows.push([
        td.date,
        `Option_${pos.putCall}_${td.type}`,
        pos.underlying,
        '',
        td.quantity,
        td.price.toFixed(4),
        td.premiumEUR.toFixed(2),
        td.commissionEUR.toFixed(2),
        td.premiumEUR.toFixed(2),
        td.fxRate.toFixed(4),
        td.currency,
        pos.status,
      ]);
    });
  });

  // Dividenden
  report.dividends.forEach(d => {
    rows.push([
      d.date,
      'Dividende',
      d.symbol,
      d.isin || '',
      '',
      '',
      d.amountEUR.toFixed(2),
      '',
      d.amountEUR.toFixed(2),
      d.fxRate.toFixed(4),
      d.currency,
      '',
    ]);
  });

  return rows.map(r => r.join(';')).join('\n');
}

// ═══════════════════════════════════════════════════════════════
// JSON EXPORT
// ═══════════════════════════════════════════════════════════════

export function exportTaxJSON(report) {
  return JSON.stringify({
    year: report.year,
    summary: report.summary,
    tax: report.tax,
    dailyBreakdown: report.dailyBreakdown,
    fifoDetails: {
      totalRealizedEUR: report.fifoDetails.totalRealizedEUR,
      tradeCount: report.fifoDetails.realizedTrades.length,
    },
    optionsDetails: {
      totalPremiumEUR: report.optionsDetails.totalPremiumEUR,
      positionCount: report.optionsDetails.positions.length,
    },
    dividends: report.dividends,
  }, null, 2);
}

// ═══════════════════════════════════════════════════════════════
// MULTI-YEAR REPORT
// ═══════════════════════════════════════════════════════════════

export function generateMultiYearReport(parsedData, years, taxOptions = {}) {
  return years.map(year => generateAnnualReport(parsedData, year, taxOptions));
}
