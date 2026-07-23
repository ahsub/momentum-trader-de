import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'mcm_alerts_v1';
const HISTORY_KEY = 'mcm_alert_history_v1';
const WEBHOOKS_KEY = 'mcm_alert_webhooks_v1';

export const ALERT_TEMPLATES = [
  { id: 'breakout_high', name: 'Breakout über High', description: 'Preis über vorheriges Tages-High', icon: 'TrendingUp', config: { metric: 'price', operator: '>', threshold: 0, note: 'Breakout über Resistance' }, editableThreshold: true, thresholdLabel: 'Preis-Level $' },
  { id: 'breakdown_low', name: 'Breakdown unter Low', description: 'Preis unter vorheriges Tages-Low', icon: 'TrendingDown', config: { metric: 'price', operator: '<', threshold: 0, note: 'Breakdown unter Support' }, editableThreshold: true, thresholdLabel: 'Preis-Level $' },
  { id: 'volume_spike', name: 'Volume Spike', description: 'Volume über das Doppelte des Durchschnitts', icon: 'Activity', config: { metric: 'volume', operator: '>', threshold: 2000000, note: 'Unusual Volume Activity' }, editableThreshold: true, thresholdLabel: 'Min. Volume' },
  { id: 'gap_up', name: 'Gap Up > 3%', description: 'Eröffnungs-Gap nach oben', icon: 'ArrowUp', config: { metric: 'gapPercent', operator: '>', threshold: 3, note: 'Strong Gap Up' }, editableThreshold: true, thresholdLabel: 'Gap %' },
  { id: 'gap_down', name: 'Gap Down > 3%', description: 'Eröffnungs-Gap nach unten', icon: 'ArrowDown', config: { metric: 'gapPercent', operator: '<', threshold: -3, note: 'Strong Gap Down' }, editableThreshold: true, thresholdLabel: 'Gap % (negativ)' },
  { id: 'momentum_surge', name: 'Momentum Surge', description: 'Preis-Change > 5% in einer Session', icon: 'Zap', config: { metric: 'changePercent', operator: '>', threshold: 5, note: 'Strong Momentum' }, editableThreshold: true, thresholdLabel: 'Change %' },
  { id: 'sell_off', name: 'Sell-Off', description: 'Preis-Change < -5% in einer Session', icon: 'AlertTriangle', config: { metric: 'changePercent', operator: '<', threshold: -5, note: 'Heavy Selling' }, editableThreshold: true, thresholdLabel: 'Change % (negativ)' },
  { id: 'price_target', name: 'Preis-Target', description: 'Erreiche ein bestimmtes Preis-Level', icon: 'Target', config: { metric: 'price', operator: '>=', threshold: 0, note: 'Price Target Reached' }, editableThreshold: true, thresholdLabel: 'Target Preis $' },
];

const loadAlerts = () => { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } };
const loadHistory = () => { try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } };
const loadWebhooks = () => { try { const raw = localStorage.getItem(WEBHOOKS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } };
const saveAlerts = (alerts) => localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
const saveHistory = (history) => localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 500)));
const saveWebhooks = (webhooks) => localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(webhooks));

const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

const sendPushNotification = (alert, value) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(`🚨 Alert: ${alert.symbol}`, {
    body: `${alert.symbol}: ${alert.metric} = ${value.toFixed(2)} ${alert.operator} ${alert.threshold}\n${alert.note || ''}`,
    icon: '/favicon.ico', badge: '/favicon.ico', tag: alert.id,
    requireInteraction: false, silent: false,
  });
};

const sendWebhook = async (webhook, alert, value) => {
  const payload = {
    symbol: alert.symbol, metric: alert.metric, operator: alert.operator,
    threshold: alert.threshold, triggeredValue: value, note: alert.note,
    timestamp: new Date().toISOString(), source: 'momentum-trader-de',
  };
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhook.secret ? { 'Authorization': `Bearer ${webhook.secret}` } : {}),
      },
      body: JSON.stringify(webhook.format === 'discord' ? {
        content: null,
        embeds: [{
          title: `🚨 Alert Triggered: ${alert.symbol}`, color: 0xf59e0b,
          fields: [
            { name: 'Metric', value: alert.metric, inline: true },
            { name: 'Value', value: value.toFixed(2), inline: true },
            { name: 'Condition', value: `${alert.operator} ${alert.threshold}`, inline: true },
            { name: 'Note', value: alert.note || '—', inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      } : payload),
    });
    return res.ok;
  } catch (err) { console.error('Webhook failed:', err); return false; }
};

export const useAlerts = () => {
  const [alerts, setAlerts] = useState(loadAlerts);
  const [triggered, setTriggered] = useState([]);
  const [history, setHistory] = useState(loadHistory);
  const [webhooks, setWebhooks] = useState(loadWebhooks);
  const [isScanning, setIsScanning] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const triggeredRef = useRef(new Set());
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    audioRef.current.volume = 0.3;
  }, []);

  useEffect(() => saveAlerts(alerts), [alerts]);
  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveWebhooks(webhooks), [webhooks]);
  useEffect(() => { if ('Notification' in window) setPushEnabled(Notification.permission === 'granted'); }, []);

  const enablePush = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPushEnabled(granted);
    return granted;
  }, []);

  const addWebhook = useCallback((webhookData) => {
    const newWebhook = { id: crypto.randomUUID(), createdAt: Date.now(), enabled: true, ...webhookData };
    setWebhooks((prev) => [...prev, newWebhook]);
    return newWebhook.id;
  }, []);

  const deleteWebhook = useCallback((id) => { setWebhooks((prev) => prev.filter((w) => w.id !== id)); }, []);
  const toggleWebhook = useCallback((id) => { setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w)); }, []);

  const addAlert = useCallback((alertData) => {
    const newAlert = { id: crypto.randomUUID(), createdAt: Date.now(), enabled: true, triggeredCount: 0, lastTriggered: null, ...alertData };
    setAlerts((prev) => [...prev, newAlert]);
    return newAlert.id;
  }, []);

  const addAlertFromTemplate = useCallback((templateId, symbol, customThreshold = null) => {
    const template = ALERT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return null;
    const alertData = {
      symbol: symbol.toUpperCase().trim(), ...template.config,
      threshold: customThreshold !== null ? parseFloat(customThreshold) : template.config.threshold,
      templateId: template.id,
    };
    return addAlert(alertData);
  }, [addAlert]);

  const updateAlert = useCallback((id, updates) => { setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a))); }, []);
  const deleteAlert = useCallback((id) => { setAlerts((prev) => prev.filter((a) => a.id !== id)); triggeredRef.current.delete(id); }, []);
  const toggleAlert = useCallback((id) => { setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))); }, []);
  const clearTriggered = useCallback(() => { setTriggered([]); triggeredRef.current.clear(); }, []);
  const clearHistory = useCallback(() => { setHistory([]); saveHistory([]); }, []);

  const scanAlerts = useCallback((marketData) => {
    const now = Date.now();
    const newTriggered = [];
    const newHistoryEntries = [];
    const cooldownMs = 5 * 60 * 1000;

    alerts.forEach((alert) => {
      if (!alert.enabled) return;
      const data = marketData.find((d) => d.symbol === alert.symbol);
      if (!data) return;
      let isTriggered = false;
      const value = data[alert.metric];
      if (value === undefined) return;

      switch (alert.operator) {
        case '>': isTriggered = value > alert.threshold; break;
        case '<': isTriggered = value < alert.threshold; break;
        case '>=': isTriggered = value >= alert.threshold; break;
        case '<=': isTriggered = value <= alert.threshold; break;
        case '=': isTriggered = Math.abs(value - alert.threshold) < 0.001; break;
        default: break;
      }

      if (isTriggered) {
        const lastTrig = alert.lastTriggered;
        const inCooldown = lastTrig && (now - lastTrig) < cooldownMs;
        if (!inCooldown && !triggeredRef.current.has(alert.id)) {
          triggeredRef.current.add(alert.id);
          const triggeredAlert = { ...alert, triggeredAt: now, triggeredValue: value };
          newTriggered.push(triggeredAlert);
          const historyEntry = { id: crypto.randomUUID(), alertId: alert.id, symbol: alert.symbol, metric: alert.metric, operator: alert.operator, threshold: alert.threshold, triggeredValue: value, note: alert.note, timestamp: now, templateId: alert.templateId || null };
          newHistoryEntries.push(historyEntry);
          sendPushNotification(alert, value);
          if (audioRef.current) audioRef.current.play().catch(() => {});
          webhooks.filter((w) => w.enabled).forEach((w) => sendWebhook(w, alert, value));
          setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, triggeredCount: a.triggeredCount + 1, lastTriggered: now } : a));
        }
      } else { triggeredRef.current.delete(alert.id); }
    });

    if (newTriggered.length > 0) {
      setTriggered((prev) => [...newTriggered, ...prev].slice(0, 50));
      setHistory((prev) => [...newHistoryEntries, ...prev]);
    }
    return newTriggered;
  }, [alerts, webhooks]);

  return {
    alerts, triggered, history, webhooks, isScanning, pushEnabled,
    addAlert, addAlertFromTemplate, updateAlert, deleteAlert, toggleAlert,
    scanAlerts, clearTriggered, clearHistory, enablePush,
    addWebhook, deleteWebhook, toggleWebhook,
  };
};
