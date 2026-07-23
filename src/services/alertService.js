/**
 * alertService.js
 * 
 * Alert-System für Options-Strategien
 * Push-Benachrichtigungen bei Roll-Triggers, Gewinnzielen, etc.
 * 
 * Phase 8.3: Alert-System
 */

// Alert-Store (im Memory, später localStorage)
let alerts = [];
let alertHistory = [];
let notificationPermission = false;

/**
 * Initialisiere Benachrichtigungen
 */
export async function initNotifications() {
  if (!('Notification' in window)) {
    console.warn('[AlertService] Browser unterstützt keine Notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    notificationPermission = true;
    return true;
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission === 'granted';
    return notificationPermission;
  }

  return false;
}

/**
 * Erstelle einen neuen Alert
 * @param {Object} config - Alert-Konfiguration
 * @returns {Object} - Alert-Objekt
 */
export function createAlert(config) {
  const alert = {
    id: generateId(),
    type: config.type, // 'roll_trigger', 'profit_target', 'loss_limit', 'dte_warning', 'itm_warning'
    symbol: config.symbol,
    message: config.message,
    severity: config.severity || 'info', // 'info', 'warning', 'critical'
    triggered: false,
    acknowledged: false,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    conditions: config.conditions || {},
    actions: config.actions || [],
    autoDismiss: config.autoDismiss || false
  };

  alerts.push(alert);
  saveAlerts();

  return alert;
}

/**
 * Prüfe alle Alerts gegen aktuelle Marktdaten
 * @param {Object} marketData - Aktuelle Marktdaten { symbol, price, dte, itm, pnl, etc. }
 */
export function checkAlerts(marketData) {
  alerts.forEach(alert => {
    if (alert.triggered || alert.acknowledged) return;

    const shouldTrigger = evaluateConditions(alert.conditions, marketData);

    if (shouldTrigger) {
      triggerAlert(alert, marketData);
    }
  });
}

/**
 * Evaluiere Alert-Bedingungen
 */
function evaluateConditions(conditions, data) {
  // DTE Warning
  if (conditions.dteThreshold && data.dte !== undefined) {
    if (data.dte <= conditions.dteThreshold) return true;
  }

  // ITM Warning
  if (conditions.itm && data.itm === true) return true;

  // Profit Target
  if (conditions.profitTarget && data.pnl !== undefined) {
    if (data.pnl >= conditions.profitTarget) return true;
  }

  // Loss Limit
  if (conditions.lossLimit && data.pnl !== undefined) {
    if (data.pnl <= conditions.lossLimit) return true;
  }

  // Price Threshold (above/below)
  if (conditions.priceAbove && data.price > conditions.priceAbove) return true;
  if (conditions.priceBelow && data.price < conditions.priceBelow) return true;

  // IV Rank
  if (conditions.ivRankHigh && data.ivRank > conditions.ivRankHigh) return true;
  if (conditions.ivRankLow && data.ivRank < conditions.ivRankLow) return true;

  return false;
}

/**
 * Trigger einen Alert
 */
function triggerAlert(alert, marketData) {
  alert.triggered = true;
  alert.triggeredAt = new Date().toISOString();

  // In-App Notification
  showInAppNotification(alert);

  // Browser Push Notification
  if (notificationPermission) {
    showPushNotification(alert);
  }

  // Sound (optional)
  if (alert.severity === 'critical') {
    playAlertSound();
  }

  // Zur History hinzufügen
  alertHistory.push({
    ...alert,
    marketData: { ...marketData }
  });

  saveAlerts();
  saveHistory();
}

/**
 * Zeige In-App Notification
 */
function showInAppNotification(alert) {
  // Event für React-Components
  window.dispatchEvent(new CustomEvent('options-alert', {
    detail: alert
  }));
}

/**
 * Zeige Browser Push Notification
 */
function showPushNotification(alert) {
  const icons = {
    roll_trigger: '♻️',
    profit_target: '💰',
    loss_limit: '🚨',
    dte_warning: '⏰',
    itm_warning: '⚠️'
  };

  new Notification(`Options Alert: ${alert.symbol}`, {
    body: `${icons[alert.type] || '🔔'} ${alert.message}`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: alert.id,
    requireInteraction: alert.severity === 'critical',
    actions: alert.actions.map(a => ({
      action: a.id,
      title: a.label
    }))
  });
}

/**
 * Spiele Alert-Sound
 */
function playAlertSound() {
  try {
    const audio = new Audio('/alert-sound.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {
    // Silent fail
  }
}

/**
 * Bestätige einen Alert
 */
export function acknowledgeAlert(alertId) {
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    saveAlerts();
  }
}

/**
 * Lösche einen Alert
 */
export function deleteAlert(alertId) {
  alerts = alerts.filter(a => a.id !== alertId);
  saveAlerts();
}

/**
 * Hole alle aktiven Alerts
 */
export function getActiveAlerts() {
  return alerts.filter(a => !a.acknowledged);
}

/**
 * Hole Alert-History
 */
export function getAlertHistory(limit = 50) {
  return alertHistory.slice(-limit).reverse();
}

/**
 * Erstelle Standard-Alerts für eine Position
 */
export function createDefaultAlertsForPosition(position) {
  const alerts = [];

  // DTE Warning (7 Tage vor Expiration)
  alerts.push(createAlert({
    type: 'dte_warning',
    symbol: position.symbol,
    message: `⚠️ ${position.symbol}: DTE < 7 Tage - Rollen prüfen!`,
    severity: 'warning',
    conditions: {
      dteThreshold: 7,
      symbol: position.symbol
    },
    actions: [
      { id: 'roll', label: 'Rollen' },
      { id: 'close', label: 'Schließen' }
    ]
  }));

  // ITM Warning
  alerts.push(createAlert({
    type: 'itm_warning',
    symbol: position.symbol,
    message: `🚨 ${position.symbol}: Option ist ITM - Rollen empfohlen!`,
    severity: 'critical',
    conditions: {
      itm: true,
      symbol: position.symbol
    },
    actions: [
      { id: 'roll', label: 'Rollen' },
      { id: 'accept', label: 'Andienung akzeptieren' }
    ]
  }));

  // Profit Target (50% der Max-Prämie)
  if (position.premium) {
    const profitTarget = position.premium * 0.5;
    alerts.push(createAlert({
      type: 'profit_target',
      symbol: position.symbol,
      message: `💰 ${position.symbol}: 50% Gewinn erreicht - Prüfe Schließung!`,
      severity: 'info',
      conditions: {
        profitTarget: profitTarget,
        symbol: position.symbol
      },
      actions: [
        { id: 'close', label: 'Schließen' },
        { id: 'hold', label: 'Halten' }
      ]
    }));
  }

  // Loss Limit (200% der Prämie)
  if (position.premium) {
    const lossLimit = -position.premium * 2;
    alerts.push(createAlert({
      type: 'loss_limit',
      symbol: position.symbol,
      message: `🚨 ${position.symbol}: Verlust-Limit erreicht - Handeln!`,
      severity: 'critical',
      conditions: {
        lossLimit: lossLimit,
        symbol: position.symbol
      },
      actions: [
        { id: 'roll', label: 'Rollen' },
        { id: 'close', label: 'Schließen' }
      ]
    }));
  }

  return alerts;
}

/**
 * Erstelle Roll-Trigger Alert (nach Ludwig-Strategie)
 */
export function createRollTriggerAlert(symbol, currentDTE, strike, underlyingPrice) {
  const isITM = underlyingPrice < strike; // Für Puts

  return createAlert({
    type: 'roll_trigger',
    symbol,
    message: `♻️ ${symbol}: Roll-Trigger! DTE=${currentDTE}${isITM ? ', ITM' : ''}`,
    severity: isITM ? 'critical' : 'warning',
    conditions: {
      dteThreshold: currentDTE,
      itm: isITM,
      symbol
    },
    actions: [
      { id: 'roll_stufe1', label: 'Roll Stufe 1 (↓Strike)' },
      { id: 'roll_stufe2', label: 'Roll Stufe 2 (=Strike)' },
      { id: 'roll_stufe3', label: 'Roll Stufe 3 (2x)' }
    ]
  });
}

// Persistence
function saveAlerts() {
  try {
    localStorage.setItem('options_alerts', JSON.stringify(alerts));
  } catch (e) {}
}

function saveHistory() {
  try {
    localStorage.setItem('options_alert_history', JSON.stringify(alertHistory.slice(-100)));
  } catch (e) {}
}

function loadAlerts() {
  try {
    const stored = localStorage.getItem('options_alerts');
    if (stored) alerts = JSON.parse(stored);

    const storedHistory = localStorage.getItem('options_alert_history');
    if (storedHistory) alertHistory = JSON.parse(storedHistory);
  } catch (e) {}
}

function generateId() {
  return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialisiere beim Laden
loadAlerts();

export default {
  initNotifications,
  createAlert,
  checkAlerts,
  acknowledgeAlert,
  deleteAlert,
  getActiveAlerts,
  getAlertHistory,
  createDefaultAlertsForPosition,
  createRollTriggerAlert
};
