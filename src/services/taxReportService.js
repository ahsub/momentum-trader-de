/**
 * Tax Report Service – FIFO P&L, Steuerberechnung für Deutschland
 * Tagesgenaue Aufstellung aller realisierten Erträge in EUR
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

/**
 * Konvertiert Betrag in EUR anhand des FX-Rates
 */
function toEUR(amount, fxRateToBase, currency) {
  if (!amount || isNaN(amount)) return 0;
  if (currency === 'EUR') return amount;
  if (fxRateToBase && fxRateToBase > 0) {
    return amount / fxRateToBase;
  }
  // Fallback-Kurse
  const fallbackRates = { USD: 1.08, GBP: 0.85, CHF: 0.94 };
  if (fallbackRates[currency]) {
    return amount / fallbackRates[currency];
  }
  return amount;
}

/**
 * Berechnet FIFO-realisierte Gewinne aus Trades mit tagesgenauer Aufstellung
 */
export function calculateFIFOPnL(trades, { symbol, isin } = {}) {
  const relevantTrades = symbol 
    ? trades.filter(t => t.symbol === symbol || t.isin === isin)
    : trades;

  const stockTrades = relevantTrades
    .filter(t => t.assetCategory === 'STK')
    .sort((a, b) => new Date(a.tradeDate) - new Date(b.tradeDate));

  const fifoQueue = [];
  const realizedTrades = [];
  const dailyPnL = {}; // Tagesgenaue Aufstellung

  for (const trade of stockTrades) {
    const qty = Math.abs(trade.quantity);
    const price = trade.tradePrice;
    const commissionEUR = toEUR(Math.abs(trade.commission || 0), trade.fxRateToBase, trade.commissionCurrency || trade.currency);
    const date = trade.tradeDate;
    const currency = trade.currency;

    if (trade.buySell === 'BUY') {
      fifoQueue.push({
        quantity: qty,
        price,
        commission: commissionEUR / qty,
        date,
        tradeId: trade.tradeId,
        currency,
        fxRate: trade.fxRateToBase,
      });
    } else if (trade.buySell === 'SELL') {
      let remainingToSell = qty;
      let totalCostEUR = 0;
      const matchedLots = [];

      while (remainingToSell > 0 && fifoQueue.length > 0) {
        const lot = fifoQueue[0];
        const sellFromLot = Math.min(remainingToSell, lot.quantity);

        const lotCostEUR = sellFromLot * lot.price / (lot.fxRate || 1) + sellFromLot * lot.commission;
        totalCostEUR += lotCostEUR;

        matchedLots.push({
          buyDate: lot.date,
          buyPrice: lot.price,
          buyFxRate: lot.fxRate,
          quantity: sellFromLot,
          costEUR: lotCostEUR,
        });

        lot.quantity -= sellFromLot;
        remainingToSell -= sellFromLot;

        if (lot.quantity <= 0) {
          fifoQueue.shift();
        }
      }

      const proceedsEUR = toEUR(qty * price, trade.fxRateToBase, currency) - commissionEUR;
      const realizedPnlEUR = proceedsEUR - totalCostEUR;
      const holdingPeriodDays = matchedLots.length > 0
        ? Math.ceil((new Date(date) - new Date(matchedLots[0].buyDate)) / (1000 * 60 * 60 * 24))
        : 0;

      const tradeRecord = {
        symbol: trade.symbol,
        isin: trade.isin,
        sellDate: date,
        sellDateFormatted: new Date(date).toLocaleDateString('de-DE'),
        quantity: qty,
        sellPrice: price,
        sellFxRate: trade.fxRateToBase,
        sellCurrency: currency,
        proceedsEUR,
        totalCostEUR,
        realizedPnlEUR,
        realizedPnl: realizedPnlEUR,
        holdingPeriodDays,
        isLongTerm: holdingPeriodDays > 365,
        matchedLots,
        tradeId: trade.tradeId,
        type: 'STOCK_SALE',
      };

      realizedTrades.push(tradeRecord);

      // Tagesgenaue Aufstellung
      if (!dailyPnL[date]) {
        dailyPnL[date] = {
          date,
          dateFormatted: new Date(date).toLocaleDateString('de-DE'),
          trades: [],
          totalRealized: 0,
          totalProceeds: 0,
          totalCost: 0,
        };
      }
      dailyPnL[date].trades.push(tradeRecord);
      dailyPnL[date].totalRealized += realizedPnlEUR;
      dailyPnL[date].totalProceeds += proceedsEUR;
      dailyPnL[date].totalCost += totalCostEUR;
    }
  }

  return {
    realizedTrades,
    totalRealized: realizedTrades.reduce((s, t) => s + t.realizedPnlEUR, 0),
    remainingShares: fifoQueue.reduce((s, l) => s + l.quantity, 0),
    remainingLots: fifoQueue,
    dailyPnL: Object.values(dailyPnL).sort((a, b) => new Date(a.date) - new Date(b.date)),
  };
}

/**
 * Berechnet Optionen-P&L mit tagesgenauer Aufstellung
 */
export function calculateOptionsPnL(trades) {
  const optionTrades = trades.filter(t => t.assetCategory === 'OPT');
  
  const grouped = {};
  optionTrades.forEach(t => {
    const key = `${t.underlyingSymbol}_${t.strike}_${t.expiry}_${t.putCall}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  const results = [];
  const dailyOptionPnL = {};

  Object.entries(grouped).forEach(([key, groupTrades]) => {
    const sorted = groupTrades.sort((a, b) => 
      new Date(a.tradeDate) - new Date(b.tradeDate)
    );

    let netPremiumEUR = 0;
    const tradeRecords = [];

    sorted.forEach(t => {
      const premium = Math.abs(t.quantity) * t.tradePrice * (t.multiplier || 100);
      const premiumEUR = toEUR(premium, t.fxRateToBase, t.currency);
      const commissionEUR = toEUR(Math.abs(t.commission || 0), t.fxRateToBase, t.commissionCurrency || t.currency);
      
      let pnlEUR = 0;
      if (t.buySell === 'SELL') {
        pnlEUR = premiumEUR - commissionEUR;
      } else {
        pnlEUR = -premiumEUR - commissionEUR;
      }
      
      netPremiumEUR += pnlEUR;

      const record = {
        date: t.tradeDate,
        dateFormatted: new Date(t.tradeDate).toLocaleDateString('de-DE'),
        buySell: t.buySell,
        quantity: Math.abs(t.quantity),
        price: t.tradePrice,
        premiumEUR,
        commissionEUR,
        pnlEUR,
        currency: t.currency,
        fxRate: t.fxRateToBase,
      };
      tradeRecords.push(record);

      // Tagesgenaue Aufstellung
      if (!dailyOptionPnL[t.tradeDate]) {
        dailyOptionPnL[t.tradeDate] = {
          date: t.tradeDate,
          dateFormatted: new Date(t.tradeDate).toLocaleDateString('de-DE'),
          trades: [],
          totalPremium: 0,
        };
      }
      dailyOptionPnL[t.tradeDate].trades.push(record);
      dailyOptionPnL[t.tradeDate].totalPremium += pnlEUR;
    });

    const hasAssignment = sorted.some(t => t.notes?.includes('A') || t.openCloseIndicator === '');

    results.push({
      key,
      underlying: sorted[0].underlyingSymbol,
      strike: sorted[0].strike,
      expiry: sorted[0].expiry,
      putCall: sorted[0].putCall,
      netPremiumEUR,
      tradeCount: sorted.length,
      status: hasAssignment ? 'ASSIGNED/EXPIRED' : 'OPEN/CLOSED',
      tradeRecords,
    });
  });

  return {
    positions: results,
    totalPremium: results.reduce((s, r) => s + r.netPremiumEUR, 0),
    dailyPnL: Object.values(dailyOptionPnL).sort((a, b) => new Date(a.date) - new Date(b.date)),
  };
}

/**
 * Berechnet Dividenden-Erträge in EUR
 */
export function calculateDividendIncome(dividends) {
  const dailyDividends = {};
  
  dividends?.forEach(d => {
    const amountEUR = d.amountEUR || toEUR(d.amount, d.fxRate, d.currency);
    const date = d.date;
    
    if (!dailyDividends[date]) {
      dailyDividends[date] = {
        date,
        dateFormatted: new Date(date).toLocaleDateString('de-DE'),
        dividends: [],
        totalEUR: 0,
      };
    }
    
    dailyDividends[date].dividends.push({
      symbol: d.symbol,
      description: d.description,
      amountOriginal: d.amount,
      currency: d.currency,
      fxRate: d.fxRate,
      amountEUR,
    });
    dailyDividends[date].totalEUR += amountEUR;
  });

  return {
    total: dividends?.reduce((s, d) => s + (d.amountEUR || toEUR(d.amount, d.fxRate, d.currency)), 0) || 0,
    daily: Object.values(dailyDividends).sort((a, b) => new Date(a.date) - new Date(b.date)),
    bySymbol: dividends?.reduce((acc, d) => {
      const sym = d.symbol || 'UNKNOWN';
      if (!acc[sym]) acc[sym] = 0;
      acc[sym] += d.amountEUR || toEUR(d.amount, d.fxRate, d.currency);
      return acc;
    }, {}) || {},
  };
}

/**
 * Steuerberechnung für Deutschland
 */
export function calculateGermanTaxes({ realizedPnL, dividendIncome, optionPremium, churchTaxKey = 'none', isJointAccount = false }) {
  const sparerPauschbetrag = isJointAccount ? 2000 : 1000;
  
  const totalIncome = realizedPnL + dividendIncome + optionPremium;
  const taxableGains = Math.max(0, totalIncome);
  const usedAllowance = Math.min(taxableGains, sparerPauschbetrag);
  const remainingTaxable = Math.max(0, taxableGains - sparerPauschbetrag);

  const abgeltung = remainingTaxable * TAX_RATES.abgeltungsteuer;
  const soli = abgeltung * TAX_RATES.soli;
  const kirchensteuerRate = TAX_RATES.kirchensteuer[churchTaxKey] || 0;
  const kirchensteuer = abgeltung * kirchensteuerRate;

  const totalTax = abgeltung + soli + kirchensteuer;
  const netGain = totalIncome - totalTax;

  return {
    totalIncome,
    realizedPnL,
    dividendIncome,
    optionPremium,
    sparerPauschbetrag,
    usedAllowance,
    remainingTaxable,
    abgeltungsteuer: abgeltung,
    soli,
    kirchensteuer,
    totalTax,
    netGain,
    effectiveTaxRate: totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0,
  };
}

/**
 * Vollständiger Jahresbericht mit tagesgenauer Aufstellung
 */
export function generateAnnualReport(parsedData, year, taxOptions = {}) {
  const yearTrades = parsedData.allTrades?.filter(t => {
    const tradeYear = new Date(t.tradeDate).getFullYear();
    return tradeYear === year;
  }) || [];

  const yearDividends = parsedData.allDividends?.filter(d => {
    const divYear = new Date(d.date).getFullYear();
    return divYear === year;
  }) || [];

  const stockPnL = calculateFIFOPnL(yearTrades);
  const optionsResult = calculateOptionsPnL(yearTrades);
  const dividendResult = calculateDividendIncome(yearDividends);
  
  const totalRealized = stockPnL.totalRealized + optionsResult.totalPremium;
  
  const tax = calculateGermanTaxes({
    realizedPnL: stockPnL.totalRealized,
    dividendIncome: dividendResult.total,
    optionPremium: optionsResult.totalPremium,
    ...taxOptions
  });

  // Erstelle tagesgenaue Gesamtaufstellung
  const allDates = new Set([
    ...Object.keys(stockPnL.dailyPnL.reduce((acc, d) => ({...acc, [d.date]: true}), {})),
    ...Object.keys(optionsResult.dailyPnL.reduce((acc, d) => ({...acc, [d.date]: true}), {})),
    ...Object.keys(dividendResult.daily.reduce((acc, d) => ({...acc, [d.date]: true}), {})),
  ]);

  const dailyReport = Array.from(allDates).sort().map(date => {
    const stockDay = stockPnL.dailyPnL.find(d => d.date === date);
    const optionDay = optionsResult.dailyPnL.find(d => d.date === date);
    const divDay = dividendResult.daily.find(d => d.date === date);
    
    return {
      date,
      dateFormatted: new Date(date).toLocaleDateString('de-DE'),
      stockTrades: stockDay?.trades || [],
      stockPnL: stockDay?.totalRealized || 0,
      optionTrades: optionDay?.trades || [],
      optionPremium: optionDay?.totalPremium || 0,
      dividends: divDay?.dividends || [],
      dividendIncome: divDay?.totalEUR || 0,
      totalDay: (stockDay?.totalRealized || 0) + (optionDay?.totalPremium || 0) + (divDay?.totalEUR || 0),
    };
  });

  return {
    year,
    summary: {
      totalTrades: yearTrades.length,
      stockTrades: yearTrades.filter(t => t.assetCategory === 'STK').length,
      optionTrades: yearTrades.filter(t => t.assetCategory === 'OPT').length,
      totalRealizedPnL: totalRealized,
      stockPnL: stockPnL.totalRealized,
      optionsPnL: optionsResult.totalPremium,
      dividendIncome: dividendResult.total,
      totalIncome: totalRealized + dividendResult.total,
    },
    fifoDetails: stockPnL,
    optionsDetails: optionsResult,
    dividendDetails: dividendResult,
    dailyReport,
    tax,
    dividends: yearDividends,
  };
}

/**
 * Export für Steuerberater (CSV) – tagesgenau
 */
export function exportTaxCSV(report) {
  const rows = [
    ['Datum', 'Typ', 'Symbol', 'ISIN', 'Währung', 'FX-Rate', 'Betrag Original', 'Betrag EUR', 'Kategorie', 'Hinweis'],
  ];

  // Tagesgenaue Aufstellung
  report.dailyReport?.forEach(day => {
    // Aktienverkäufe
    day.stockTrades.forEach(t => {
      rows.push([
        day.dateFormatted,
        'AKTIENVERKAUF',
        t.symbol,
        t.isin || '',
        t.sellCurrency,
        t.sellFxRate?.toFixed(4) || '',
        (t.proceedsEUR + t.totalCostEUR).toFixed(2),
        t.realizedPnlEUR.toFixed(2),
        'KAPITALERTRAG',
        `Verkauf ${t.quantity} Stück, Haltefrist ${t.holdingPeriodDays} Tage`,
      ]);
    });

    // Optionen
    day.optionTrades.forEach(t => {
      rows.push([
        day.dateFormatted,
        'OPTION',
        t.underlying || '',
        '',
        t.currency,
        t.fxRate?.toFixed(4) || '',
        t.premiumEUR.toFixed(2),
        t.pnlEUR.toFixed(2),
        'OPTIONSPRAEMIE',
        `${t.buySell} ${t.quantity} Kontrakt(e)`,
      ]);
    });

    // Dividenden
    day.dividends.forEach(d => {
      rows.push([
        day.dateFormatted,
        'DIVIDENDE',
        d.symbol,
        '',
        d.currency,
        d.fxRate?.toFixed(4) || '',
        d.amountOriginal.toFixed(2),
        d.amountEUR.toFixed(2),
        'DIVIDENDE',
        d.description || '',
      ]);
    });
  });

  // Zusammenfassung
  rows.push([]);
  rows.push(['ZUSAMMENFASSUNG', '', '', '', '', '', '', '', '', '']);
  rows.push(['Jahr', report.year, '', '', '', '', '', '', '', '']);
  rows.push(['Realisierte Gewinne', report.summary.stockPnL.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Optionsprämien', report.summary.optionsPnL.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Dividenden', report.summary.dividendIncome.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Gesamteinkünfte', report.summary.totalIncome.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Sparer-Pauschbetrag', report.tax.sparerPauschbetrag.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Steuerpflichtig', report.tax.remainingTaxable.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Abgeltungsteuer', report.tax.abgeltungsteuer.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Soli', report.tax.soli.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Kirchensteuer', report.tax.kirchensteuer.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Gesamtsteuer', report.tax.totalTax.toFixed(2), '', '', '', '', '', '', '', '']);
  rows.push(['Netto nach Steuer', report.tax.netGain.toFixed(2), '', '', '', '', '', '', '', '']);

  return rows.map(r => r.join(';')).join('\n');
}

/**
 * Export als JSON für ELSTER/Steuerberater
 */
export function exportTaxJSON(report) {
  return JSON.stringify({
    jahr: report.year,
    einkuenfte: {
      kapitalertraege: report.summary.stockPnL,
      optionspraemien: report.summary.optionsPnL,
      dividenden: report.summary.dividendIncome,
      gesamt: report.summary.totalIncome,
    },
    steuerberechnung: {
      sparerPauschbetrag: report.tax.sparerPauschbetrag,
      steuerpflichtig: report.tax.remainingTaxable,
      abgeltungsteuer: report.tax.abgeltungsteuer,
      soli: report.tax.soli,
      kirchensteuer: report.tax.kirchensteuer,
      gesamtsteuer: report.tax.totalTax,
    },
    tagesaufstellung: report.dailyReport?.map(d => ({
      datum: d.dateFormatted,
      gesamtertrag: d.totalDay,
      details: [
        ...d.stockTrades.map(t => ({
          typ: 'AKTIENVERKAUF',
          symbol: t.symbol,
          betragEUR: t.realizedPnlEUR,
        })),
        ...d.optionTrades.map(t => ({
          typ: 'OPTION',
          underlying: t.underlying,
          betragEUR: t.pnlEUR,
        })),
        ...d.dividends.map(div => ({
          typ: 'DIVIDENDE',
          symbol: div.symbol,
          betragEUR: div.amountEUR,
        })),
      ],
    })),
  }, null, 2);
}
