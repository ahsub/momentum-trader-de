/**
 * Tax Export Service
 * Generiert eine druckbare Steuererläuterung für die ESt-Erklärung
 * 
 * Features:
 * - Tagesgenaue Auflistung aller Transaktionen
 * - Wechselkurse pro Transaktion
 * - Kategorie-Summen
 * - Hinweise für nicht-deutsche Broker
 */

import { getFxRate } from './taxParser';

/**
 * Formatiert Betrag als EUR-String
 */
function fmtEur(n) {
  return n?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00';
}

/**
 * Formatiert Datum (YYYY-MM-DD → DD.MM.YYYY)
 */
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Generiert Steuererläuterung als HTML-String
 */
export function generateTaxReport(transactions, summary, settings, year) {
  const {
    isJointAccount = false,
    churchTaxKey = 'none',
    personAChurch = false,
    personBChurch = false,
  } = settings;

  // Sort transactions by date
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Group by category
  const byCategory = {};
  sorted.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  });

  const today = new Date().toLocaleDateString('de-DE');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Steuererläuterung Kapitalerträge ${year}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; }
    h1 { font-size: 16pt; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
    h2 { font-size: 12pt; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 11pt; margin-top: 12px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; }
    th { background: #f0f0f0; text-align: left; padding: 6px 4px; border-bottom: 1px solid #999; font-weight: 600; }
    td { padding: 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
    .right { text-align: right; }
    .sum-row { font-weight: 600; background: #f8f8f8; }
    .positive { color: #006400; }
    .negative { color: #8b0000; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 4px; }
    .info-box { background: #e7f3ff; border: 1px solid #2196F3; padding: 10px; margin: 10px 0; border-radius: 4px; }
    .header-info { margin-bottom: 16px; }
    .header-info p { margin: 2px 0; font-size: 10pt; }
    .page-break { page-break-before: always; }
    .small { font-size: 8pt; color: #555; }
  </style>
</head>
<body>
  <h1>Steuererläuterung Kapitalerträge — ${year}</h1>

  <div class="header-info">
    <p><strong>Erstellt am:</strong> ${today}</p>
    <p><strong>Konto:</strong> ${isJointAccount ? 'Gemeinschaftskonto (Ehepaar/Partner)' : 'Einzelkonto'}</p>
    <p><strong>Sparer-Pauschbetrag:</strong> ${isJointAccount ? '€2.000 (€1.000 pro Person)' : '€1.000'}</p>
    <p><strong>Broker:</strong> CapTrader (IBKR) — Nicht-deutscher Broker, keine Abgeltungsteuer einbehalten</p>
  </div>

  <div class="warning">
    <strong>Wichtiger Hinweis:</strong> Bei nicht-deutschen Brokern (CapTrader/IBKR/Lynx) wird keine deutsche 
    Kapitalertragsteuer einbehalten. Alle Kapitalerträge müssen in der Einkommensteuererklärung (Anlage KAP) 
    deklariert werden. Der Sparer-Pauschbetrag wird nicht automatisch angewendet und muss geltend gemacht werden.
  </div>

  <h2>1. Übersicht nach Kategorien</h2>
  <table>
    <thead>
      <tr>
        <th>Kategorie</th>
        <th class="right">Anzahl</th>
        <th class="right">Betrag (EUR)</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(summary.byCategory || {})
        .filter(([_, d]) => d.count > 0)
        .sort((a, b) => Math.abs(b[1].eurTotal) - Math.abs(a[1].eurTotal))
        .map(([cat, data]) => `
        <tr>
          <td>${cat}</td>
          <td class="right">${data.count}</td>
          <td class="right ${data.eurTotal >= 0 ? 'positive' : 'negative'}">€${fmtEur(data.eurTotal)}</td>
        </tr>
        `).join('')}
      <tr class="sum-row">
        <td><strong>Gesamt Kapitalerträge</strong></td>
        <td class="right">${summary.totalTransactions || 0}</td>
        <td class="right ${(summary.capitalGains + summary.investmentIncome) >= 0 ? 'positive' : 'negative'}">
          <strong>€${fmtEur(summary.capitalGains + summary.investmentIncome)}</strong>
        </td>
      </tr>
    </tbody>
  </table>

  <h2>2. Tagesgenaue Transaktionsliste</h2>
  <p class="small">Alle Beträge in EUR umgerechnet mit EZB-Referenzkurs (geschätzte Jahresdurchschnitte). 
  Tagesgenaue Kurse können vom tatsächlichen Kurs abweichen.</p>

  <table>
    <thead>
      <tr>
        <th>Datum</th>
        <th>Produkt</th>
        <th>Beschreibung</th>
        <th class="right">Betrag Orig.</th>
        <th class="right">Währung</th>
        <th class="right">Kurs</th>
        <th class="right">Betrag EUR</th>
        <th>Kategorie</th>
      </tr>
    </thead>
    <tbody>
      ${sorted.map(t => {
        const fx = getFxRate(t.currency);
        return `
        <tr>
          <td>${fmtDate(t.date)}</td>
          <td>${t.product || t.symbol || '—'}</td>
          <td>${t.description || '—'}</td>
          <td class="right ${t.amount >= 0 ? 'positive' : 'negative'}">${fmtEur(t.amount)}</td>
          <td class="right">${t.currency}</td>
          <td class="right">${fx.toFixed(4)}</td>
          <td class="right ${t.eurAmount >= 0 ? 'positive' : 'negative'}">€${fmtEur(t.eurAmount)}</td>
          <td>${t.category}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="page-break"></div>

  <h2>3. Details pro Kategorie</h2>
  ${Object.entries(byCategory).map(([cat, items]) => `
    <h3>${cat}</h3>
    <table>
      <thead>
        <tr><th>Datum</th><th>Produkt</th><th class="right">Betrag (EUR)</th></tr>
      </thead>
      <tbody>
        ${items.map(t => `
          <tr>
            <td>${fmtDate(t.date)}</td>
            <td>${t.product || t.symbol || '—'}</td>
            <td class="right ${t.eurAmount >= 0 ? 'positive' : 'negative'}">€${fmtEur(t.eurAmount)}</td>
          </tr>
        `).join('')}
        <tr class="sum-row">
          <td colspan="2"><strong>Summe ${cat}</strong></td>
          <td class="right ${items.reduce((s, t) => s + t.eurAmount, 0) >= 0 ? 'positive' : 'negative'}">
            <strong>€${fmtEur(items.reduce((s, t) => s + t.eurAmount, 0))}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  `).join('')}

  <div class="page-break"></div>

  <h2>4. Hinweise für die Steuererklärung</h2>

  <div class="info-box">
    <strong>Anlage KAP — Zeilen:</strong>
    <ul>
      <li><strong>Zeile 7:</strong> Kapitalerträge (ohne Dividenden) — €${fmtEur(summary.capitalGains || 0)}</li>
      <li><strong>Zeile 8:</strong> Dividenden — €${fmtEur(summary.investmentIncome || 0)}</li>
      <li><strong>Zeile 37:</strong> Anrechenbare ausländische Steuer — €${fmtEur(summary.totalTaxWithheld || 0)}</li>
      <li><strong>Zeile 41:</strong> Sparer-Pauschbetrag ${isJointAccount ? '(€2.000)' : '(€1.000)'}</li>
    </ul>
  </div>

  <div class="warning">
    <strong>Quellensteuer-Erstattungen:</strong> Erstattungsfrist für ${year}: 
    ${new Date(parseInt(year) + 4, 11, 31).toLocaleDateString('de-DE')} 
    (4 Jahre ab Jahresende). Anträge müssen direkt bei den ausländischen Finanzbehörden gestellt werden.
  </div>

  <p class="small" style="margin-top: 40px;">
    Diese Steuererläuterung wurde automatisch aus CapTrader-Kontoauszügen generiert. 
    Die Angaben dienen der Orientierung und ersetzen keine steuerliche Beratung. 
    Bitte überprüfen Sie alle Beträge vor Abgabe der Steuererklärung.
  </p>
</body>
</html>`;
}

/**
 * Öffnet den Steuerbericht in einem neuen Fenster zum Drucken/PDF-Speichern
 */
export function printTaxReport(transactions, summary, settings, year) {
  const html = generateTaxReport(transactions, summary, settings, year);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Bitte Popups erlauben, um die Steuererläuterung zu drucken.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();

  // Auto-print after images/styles load
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}
