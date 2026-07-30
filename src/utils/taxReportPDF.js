// src/utils/taxReportPDF.js
// ═══════════════════════════════════════════════════════════════════════════════
// PDF-Export für Steuerbericht — Client-seitig mit jsPDF
// ═══════════════════════════════════════════════════════════════════════════════
// 
// INSTALLATION (falls noch nicht vorhanden):
//   npm install jspdf jspdf-autotable
//
// Dieses Modul versucht zuerst jsPDF zu laden. Falls nicht verfügbar,
// wird ein Fallback auf Browser-Print + CSS verwendet.

/**
 * Generiert ein PDF aus dem Steuerreport
 * @param {Object} report - Der Steuerreport (Legacy-Format)
 */
export async function generateTaxPDF(report) {
  // Versuche jsPDF zu laden
  let jsPDF, autoTable;
  try {
    const jspdfModule = await import('jspdf');
    jsPDF = jspdfModule.jsPDF || jspdfModule.default;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
  } catch (e) {
    console.warn('jsPDF nicht verfügbar, verwende Browser-Print-Fallback');
    return generatePrintFallback(report);
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 20;

  // ─── Helper: Add text with positioning ───
  const addText = (text, x, yPos, options = {}) => {
    doc.text(text, x, yPos, options);
    return yPos;
  };

  const addLine = (yPos, color = [200, 200, 200]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // ─── HEADER ───
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  addText('Steuerreport Kapitalerträge', margin, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  addText(`Steuerjahr: ${report.year || new Date().getFullYear()}`, margin, y);
  y += 5;
  addText(`Steuerpflichtiger: ${report.taxpayer || '—'}`, margin, y);
  y += 5;
  addText(`Broker: CapTrader (Interactive Brokers)`, margin, y);
  y += 5;
  addText(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, margin, y);

  y += 8;
  addLine(y);
  y += 10;

  // ─── SECTION 1: ZUSAMMENFASSUNG ───
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  addText('1. Zusammenfassung', margin, y);
  y += 8;

  const summaryData = [
    ['Gesamtergebnis', formatDE(report.summary?.saldo)],
    ['Gewinne gesamt', formatDE(report.summary?.totalGewinn)],
    ['Verluste gesamt', formatDE(-(report.summary?.totalVerlust || 0))],
    ['Steuer ohne Kirchensteuer', formatDE(report.summary?.steuerOhneKirche)],
    ['Steuer mit Kirchensteuer (9%)', formatDE(report.summary?.steuerMitKirche9)],
    ['Steuer mit Kirchensteuer (8%)', formatDE(report.summary?.steuerMitKirche8)],
  ];

  if (autoTable) {
    autoTable(doc, {
      startY: y,
      head: [['Position', 'Betrag']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 40, halign: 'right', font: 'courier' },
      },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    // Fallback ohne autoTable
    summaryData.forEach(([label, value]) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      addText(label, margin, y);
      doc.setFont('helvetica', 'normal');
      addText(value, pageWidth - margin - 40, y, { align: 'right' });
      y += 6;
    });
    y += 4;
  }

  // ─── SECTION 2: ERGEBNIS NACH KATEGORIE ───
  if (y > 250) { doc.addPage(); y = 20; }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  addText('2. Ergebnis nach Kategorie', margin, y);
  y += 8;

  const categoryData = [
    ['Aktien', formatDE(report.stockPnL)],
    ['Termingeschäfte (Optionen, Futures)', formatDE(report.optionsPnL)],
    ['Allgemein (ETF, Fonds)', formatDE(report.etfPnL)],
  ];

  if (autoTable) {
    autoTable(doc, {
      startY: y,
      head: [['Kategorie', 'Betrag']],
      body: categoryData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'right', font: 'courier' },
      },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    categoryData.forEach(([label, value]) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      addText(label, margin, y);
      doc.setFont('helvetica', 'normal');
      addText(value, pageWidth - margin - 40, y, { align: 'right' });
      y += 6;
    });
    y += 4;
  }

  // ─── SECTION 3: ANLAGE KAP ───
  if (report.anlageKAP && Object.keys(report.anlageKAP).length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    addText('3. Anlage KAP — Zeilen-Mapping', margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    addText('Für die Übertragung in die elektronische Steuererklärung', margin, y);
    doc.setTextColor(40, 40, 40);
    y += 8;

    const kapRows = Object.entries(report.anlageKAP)
      .filter(([_, data]) => data.wert !== undefined && data.wert !== 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([zeile, data]) => [
        zeile,
        data.beschreibung || '',
        typeof data.wert === 'number' ? formatDE(data.wert) : data.wert,
      ]);

    if (kapRows.length > 0 && autoTable) {
      autoTable(doc, {
        startY: y,
        head: [['Zeile', 'Beschreibung', 'Betrag']],
        body: kapRows,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 20, font: 'courier' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 35, halign: 'right', font: 'courier' },
        },
        margin: { left: margin, right: margin },
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // ─── SECTION 4: VERLUSTTÖPFE ───
  if (y > 250) { doc.addPage(); y = 20; }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  addText('4. Verlusttöpfe (Verlustvorträge)', margin, y);
  y += 8;

  const verlustData = [
    ['Aktien-Verlusttopf', formatDE(report.verlustToepfe?.AKTIEN)],
    ['Allgemeiner Verlusttopf', formatDE(report.verlustToepfe?.ALLGEMEIN)],
    ['Termingeschäfts-Verlusttopf', formatDE(report.verlustToepfe?.TERMINGESCHAEFTE)],
  ];

  if (autoTable) {
    autoTable(doc, {
      startY: y,
      head: [['Verlusttopf', 'Betrag']],
      body: verlustData,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'right', font: 'courier' },
      },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ─── SECTION 5: WARNUNGEN ───
  if (report.warnings && report.warnings.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    addText('5. Warnungen', margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9);

    report.warnings.slice(0, 20).forEach((w, i) => {
      const text = typeof w === 'string' ? w : formatWarning(w);
      const lines = doc.splitTextToSize(`• ${text}`, contentWidth);
      lines.forEach(line => {
        if (y > 280) { doc.addPage(); y = 20; }
        addText(line, margin, y);
        y += 4;
      });
    });

    if (report.warnings.length > 20) {
      doc.setTextColor(100, 100, 100);
      addText(`... und ${report.warnings.length - 20} weitere Warnungen`, margin, y);
    }

    doc.setTextColor(40, 40, 40);
    y += 6;
  }

  // ─── FOOTER ───
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    addText(
      `Momentum Trader DE · Steuerreport · Seite ${i} von ${totalPages} · ${new Date().toLocaleDateString('de-DE')}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  // ─── SAVE ───
  const filename = `steuerreport-${report.year || 'unbekannt'}-${(report.taxpayer || 'steuerpflichtiger').replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

// ─── Fallback: Browser Print ───
function generatePrintFallback(report) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Bitte Popups erlauben, um den PDF-Export zu nutzen.');
    return;
  }

  const html = generatePrintHTML(report);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}

function generatePrintHTML(report) {
  const warnings = report.warnings || [];
  const kapEntries = report.anlageKAP ? Object.entries(report.anlageKAP).filter(([_, d]) => d.wert !== undefined && d.wert !== 0) : [];

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Steuerreport ${report.year || ''}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.5; color: #333; max-width: 210mm; margin: 0 auto; padding: 20mm; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #1a1a1a; }
    h2 { font-size: 14px; margin: 24px 0 12px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
    .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    td.num { text-align: right; font-family: 'SF Mono', Monaco, monospace; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .warning { background: #fffbeb; border: 1px solid #f59e0b; padding: 8px; border-radius: 4px; margin: 4px 0; font-size: 9px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; font-size: 8px; color: #999; text-align: center; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>Steuerreport Kapitalerträge</h1>
  <div class="meta">
    Steuerjahr: ${report.year || '—'}<br>
    Steuerpflichtiger: ${report.taxpayer || '—'}<br>
    Broker: CapTrader (Interactive Brokers)<br>
    Erstellt am: ${new Date().toLocaleDateString('de-DE')}
  </div>

  <h2>1. Zusammenfassung</h2>
  <table>
    <tr><th>Position</th><th class="num">Betrag</th></tr>
    <tr><td>Gesamtergebnis</td><td class="num ${(report.summary?.saldo || 0) >= 0 ? 'positive' : 'negative'}">${formatDE(report.summary?.saldo)}</td></tr>
    <tr><td>Gewinne gesamt</td><td class="num positive">${formatDE(report.summary?.totalGewinn)}</td></tr>
    <tr><td>Verluste gesamt</td><td class="num negative">${formatDE(-(report.summary?.totalVerlust || 0))}</td></tr>
    <tr><td>Steuer ohne Kirchensteuer</td><td class="num">${formatDE(report.summary?.steuerOhneKirche)}</td></tr>
    <tr><td>Steuer mit Kirchensteuer (9%)</td><td class="num">${formatDE(report.summary?.steuerMitKirche9)}</td></tr>
    <tr><td>Steuer mit Kirchensteuer (8%)</td><td class="num">${formatDE(report.summary?.steuerMitKirche8)}</td></tr>
  </table>

  <h2>2. Ergebnis nach Kategorie</h2>
  <table>
    <tr><th>Kategorie</th><th class="num">Betrag</th></tr>
    <tr><td>Aktien</td><td class="num ${(report.stockPnL || 0) >= 0 ? 'positive' : 'negative'}">${formatDE(report.stockPnL)}</td></tr>
    <tr><td>Termingeschäfte</td><td class="num ${(report.optionsPnL || 0) >= 0 ? 'positive' : 'negative'}">${formatDE(report.optionsPnL)}</td></tr>
    <tr><td>Allgemein (ETF)</td><td class="num ${(report.etfPnL || 0) >= 0 ? 'positive' : 'negative'}">${formatDE(report.etfPnL)}</td></tr>
  </table>

  ${kapEntries.length > 0 ? `
  <h2>3. Anlage KAP — Zeilen-Mapping</h2>
  <table>
    <tr><th>Zeile</th><th>Beschreibung</th><th class="num">Betrag</th></tr>
    ${kapEntries.map(([zeile, data]) => `
      <tr><td style="font-family:monospace;font-size:9px">${zeile}</td><td>${data.beschreibung}</td><td class="num ${(typeof data.wert === 'number' && data.wert < 0) ? 'negative' : 'positive'}">${typeof data.wert === 'number' ? formatDE(data.wert) : data.wert}</td></tr>
    `).join('')}
  </table>
  ` : ''}

  <h2>4. Verlusttöpfe</h2>
  <table>
    <tr><th>Verlusttopf</th><th class="num">Betrag</th></tr>
    <tr><td>Aktien</td><td class="num negative">${formatDE(report.verlustToepfe?.AKTIEN)}</td></tr>
    <tr><td>Allgemein</td><td class="num negative">${formatDE(report.verlustToepfe?.ALLGEMEIN)}</td></tr>
    <tr><td>Termingeschäfte</td><td class="num negative">${formatDE(report.verlustToepfe?.TERMINGESCHAEFTE)}</td></tr>
  </table>

  ${warnings.length > 0 ? `
  <h2>5. Warnungen (${warnings.length})</h2>
  ${warnings.slice(0, 15).map(w => `
    <div class="warning">• ${typeof w === 'string' ? w : formatWarning(w)}</div>
  `).join('')}
  ${warnings.length > 15 ? `<div style="font-size:9px;color:#999">... und ${warnings.length - 15} weitere Warnungen</div>` : ''}
  ` : ''}

  <div class="footer">
    Momentum Trader DE · Steuerreport · Erstellt am ${new Date().toLocaleDateString('de-DE')}
  </div>
</body>
</html>
  `;
}

// ─── Helpers ───

function formatDE(value) {
  if (value === undefined || value === null) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatWarning(w) {
  if (typeof w === 'string') return w;
  if (w.type === 'FX_ABWEICHUNG') {
    return `Wechselkurs-Abweichung: ${w.waehrung} am ${w.datum} (EZB: ${w.ezbKurs?.toFixed(6)}, IBKR: ${w.ibkrKurs?.toFixed(6)})`;
  }
  if (w.type === 'FX_NICHT_VALIDIERT') {
    return `Nicht validierter Kurs: ${w.waehrung} am ${w.datum}`;
  }
  if (w.type === 'FX_FEHLEND') {
    return `Fehlender Kurs: ${w.waehrung} am ${w.datum}`;
  }
  return JSON.stringify(w);
}
