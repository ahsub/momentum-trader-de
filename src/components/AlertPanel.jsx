import { useState } from 'react';
import { Bell, Plus, Trash2, Edit2, Power, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Activity, History, BellRing, BellOff, Zap, ArrowUp, ArrowDown, Target, LayoutTemplate, Webhook } from 'lucide-react';
import { ALERT_TEMPLATES } from '../hooks/useAlerts';

const METRICS = [
  { key: 'price', label: 'Preis', icon: DollarSign, unit: '$' },
  { key: 'changePercent', label: '% Change', icon: Activity, unit: '%' },
  { key: 'change', label: 'Abs. Change', icon: TrendingUp, unit: '$' },
  { key: 'volume', label: 'Volume', icon: Activity, unit: '' },
  { key: 'gapPercent', label: 'Gap %', icon: TrendingDown, unit: '%' },
];

const OPERATORS = [
  { key: '>', label: '>' }, { key: '<', label: '<' }, { key: '>=', label: '≥' },
  { key: '<=', label: '≤' }, { key: '=', label: '=' },
];

const TEMPLATE_ICONS = { TrendingUp, TrendingDown, Activity, ArrowUp, ArrowDown, Zap, AlertTriangle, Target };
const WEBHOOK_PRESETS = [
  { name: 'Discord', format: 'discord', placeholder: 'https://discord.com/api/webhooks/...' },
  { name: 'Slack', format: 'slack', placeholder: 'https://hooks.slack.com/services/...' },
  { name: 'Custom', format: 'json', placeholder: 'https://your-api.com/webhook' },
];

export default function AlertPanel({ alerts, history, webhooks, pushEnabled, onAdd, onAddFromTemplate, onUpdate, onDelete, onToggle, onClearHistory, onEnablePush, onAddWebhook, onDeleteWebhook, onToggleWebhook }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('alerts');
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateSymbol, setTemplateSymbol] = useState('');
  const [templateThreshold, setTemplateThreshold] = useState('');
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', format: 'json', secret: '' });
  const [form, setForm] = useState({ symbol: '', metric: 'price', operator: '>', threshold: '', note: '' });

  const resetForm = () => {
    setForm({ symbol: '', metric: 'price', operator: '>', threshold: '', note: '' });
    setIsCreating(false); setEditingId(null); setShowTemplates(false);
    setSelectedTemplate(null); setTemplateSymbol(''); setTemplateThreshold('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.symbol || form.threshold === '') return;
    const payload = { symbol: form.symbol.toUpperCase().trim(), metric: form.metric, operator: form.operator, threshold: parseFloat(form.threshold), note: form.note.trim() };
    if (editingId) onUpdate(editingId, payload); else onAdd(payload);
    resetForm();
  };

  const handleTemplateSubmit = () => {
    if (!templateSymbol || !selectedTemplate) return;
    onAddFromTemplate(selectedTemplate.id, templateSymbol, templateThreshold !== '' ? templateThreshold : null);
    resetForm();
  };

  const handleWebhookSubmit = (e) => {
    e.preventDefault();
    if (!webhookForm.name || !webhookForm.url) return;
    onAddWebhook({ name: webhookForm.name, url: webhookForm.url, format: webhookForm.format, secret: webhookForm.secret || undefined });
    setWebhookForm({ name: '', url: '', format: 'json', secret: '' });
  };

  const startEdit = (alert) => {
    setForm({ symbol: alert.symbol, metric: alert.metric, operator: alert.operator, threshold: alert.threshold.toString(), note: alert.note || '' });
    setEditingId(alert.id); setIsCreating(true);
  };

  const getMetricLabel = (key) => METRICS.find((m) => m.key === key)?.label || key;
  const getOperatorLabel = (key) => OPERATORS.find((o) => o.key === key)?.label || key;
  const getMetricUnit = (key) => METRICS.find((m) => m.key === key)?.unit || '';

  const groupedHistory = history.reduce((acc, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString('de-DE');
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  const getTemplateIcon = (iconName) => {
    const Icon = TEMPLATE_ICONS[iconName] || Bell;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 h-full flex flex-col max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Alert-System</h2>
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{alerts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEnablePush} className={`p-2 rounded-lg transition-colors ${pushEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400 hover:text-amber-400'}`} title={pushEnabled ? 'Push aktiv' : 'Push aktivieren'}>
            {pushEnabled ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
          <button onClick={() => { setIsCreating(!isCreating); setShowTemplates(false); }} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" />{isCreating ? 'Abbrechen' : 'Neuer Alert'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 mb-4">
        {[{ key: 'alerts', label: 'Alerts', icon: Bell }, { key: 'templates', label: 'Templates', icon: LayoutTemplate }, { key: 'history', label: 'History', icon: History }, { key: 'webhooks', label: 'Webhooks', icon: Webhook }].map((tab) => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setIsCreating(false); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <tab.icon className="w-4 h-4" /><span className="hidden sm:inline">{tab.label}</span>
            {tab.key === 'history' && history.length > 0 && <span className="text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded-full">{history.length}</span>}
            {tab.key === 'webhooks' && webhooks.length > 0 && <span className="text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded-full">{webhooks.length}</span>}
          </button>
        ))}
      </div>

      {isCreating && activeTab === 'alerts' && (
        <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-600 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setShowTemplates(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!showTemplates ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Custom Alert</button>
            <button onClick={() => setShowTemplates(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${showTemplates ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Aus Template</button>
          </div>

          {!showTemplates ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Symbol</label><input type="text" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} placeholder="AAPL" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" required /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Metric</label><select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none">{METRICS.map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Operator</label><select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none">{OPERATORS.map((o) => (<option key={o.key} value={o.key}>{o.label}</option>))}</select></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Threshold</label><input type="number" step="any" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="150.00" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" required /></div>
              </div>
              <div><label className="text-xs text-slate-400 mb-1 block">Notiz (optional)</label><input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Breakout über Resistance" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" /></div>
              <div className="flex gap-2 pt-1"><button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 py-2 rounded-lg text-sm font-semibold transition-colors">{editingId ? 'Aktualisieren' : 'Alert erstellen'}</button><button type="button" onClick={resetForm} className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors">Abbrechen</button></div>
            </form>
          ) : (
            <div className="space-y-3">
              {!selectedTemplate ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALERT_TEMPLATES.map((template) => (
                    <button key={template.id} onClick={() => setSelectedTemplate(template)} className="flex items-start gap-3 p-3 bg-slate-900 border border-slate-600 rounded-lg hover:border-amber-500/50 hover:bg-slate-800 transition-all text-left">
                      <div className="text-amber-400 mt-0.5">{getTemplateIcon(template.icon)}</div>
                      <div><div className="font-semibold text-white text-sm">{template.name}</div><div className="text-xs text-slate-400 mt-0.5">{template.description}</div><div className="text-xs text-slate-500 mt-1">{template.config.metric} {template.config.operator} {template.config.threshold}{getMetricUnit(template.config.metric)}</div></div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">{getTemplateIcon(selectedTemplate.icon)}<span className="font-semibold">{selectedTemplate.name}</span><button onClick={() => setSelectedTemplate(null)} className="text-xs text-slate-400 hover:text-white ml-auto">← Zurück</button></div>
                  <div><label className="text-xs text-slate-400 mb-1 block">Symbol</label><input type="text" value={templateSymbol} onChange={(e) => setTemplateSymbol(e.target.value.toUpperCase())} placeholder="AAPL" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" required /></div>
                  {selectedTemplate.editableThreshold && <div><label className="text-xs text-slate-400 mb-1 block">{selectedTemplate.thresholdLabel}</label><input type="number" step="any" value={templateThreshold} onChange={(e) => setTemplateThreshold(e.target.value)} placeholder={selectedTemplate.config.threshold.toString()} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" /></div>}
                  <div className="text-xs text-slate-500 bg-slate-900/50 p-2 rounded">{selectedTemplate.config.note}</div>
                  <div className="flex gap-2"><button onClick={handleTemplateSubmit} className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 py-2 rounded-lg text-sm font-semibold transition-colors">Alert aus Template erstellen</button><button onClick={resetForm} className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors">Abbrechen</button></div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {activeTab === 'alerts' && (alerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500"><Bell className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Keine Alerts aktiv</p><p className="text-xs mt-1">Erstelle einen Alert oder wähle ein Template</p></div>
        ) : (alerts.map((alert) => (
          <div key={alert.id} className={`group bg-slate-800 rounded-lg p-3 border transition-all ${alert.enabled ? 'border-slate-600' : 'border-slate-700 opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{alert.symbol}</span>
                  {alert.templateId && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">{ALERT_TEMPLATES.find((t) => t.id === alert.templateId)?.name || 'Template'}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${alert.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-400'}`}>{alert.enabled ? 'AKTIV' : 'PAUSIERT'}</span>
                  {alert.triggeredCount > 0 && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{alert.triggeredCount}x</span>}
                </div>
                <div className="text-xs text-slate-400 mt-1">{getMetricLabel(alert.metric)} {getOperatorLabel(alert.operator)} {alert.threshold}{getMetricUnit(alert.metric)}</div>
                {alert.note && <div className="text-xs text-slate-500 mt-1 italic">"{alert.note}"</div>}
                {alert.lastTriggered && <div className="text-[10px] text-slate-500 mt-1">Letzter Trigger: {new Date(alert.lastTriggered).toLocaleTimeString('de-DE')}</div>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onToggle(alert.id)} className={`p-1.5 rounded transition-colors ${alert.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-700'}`}><Power className="w-4 h-4" /></button>
                <button onClick={() => startEdit(alert)} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => onDelete(alert.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))))}

        {activeTab === 'templates' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 mb-2">Klicke auf ein Template, um es zu verwenden:</p>
            {ALERT_TEMPLATES.map((template) => (
              <button key={template.id} onClick={() => { setSelectedTemplate(template); setIsCreating(true); setActiveTab('alerts'); setShowTemplates(true); }} className="w-full flex items-start gap-3 p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-amber-500/50 hover:bg-slate-700 transition-all text-left">
                <div className="text-amber-400">{getTemplateIcon(template.icon)}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between"><span className="font-semibold text-white">{template.name}</span><Plus className="w-4 h-4 text-slate-500" /></div>
                  <p className="text-xs text-slate-400 mt-1">{template.description}</p>
                  <div className="flex items-center gap-2 mt-2"><span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded">{template.config.metric}</span><span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded">{template.config.operator} {template.config.threshold}{getMetricUnit(template.config.metric)}</span></div>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'history' && (history.length === 0 ? (
          <div className="text-center py-8 text-slate-500"><History className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Noch keine Alert-History</p></div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between"><p className="text-xs text-slate-500">{history.length} Einträge</p><button onClick={onClearHistory} className="text-xs text-red-400 hover:text-red-300 transition-colors">History löschen</button></div>
            {Object.entries(groupedHistory).map(([date, entries]) => (
              <div key={date} className="relative">
                <div className="absolute left-3 top-8 bottom-0 w-px bg-slate-700" />
                <div className="flex items-center gap-3 mb-3"><div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center"><History className="w-3 h-3 text-amber-400" /></div><span className="text-sm font-semibold text-slate-300">{date}</span><span className="text-xs text-slate-500">({entries.length}x)</span></div>
                <div className="space-y-2 ml-8">
                  {entries.map((entry) => (
                    <div key={entry.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:border-slate-600 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className="font-bold text-white text-sm">{entry.symbol}</span>{entry.templateId && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">{ALERT_TEMPLATES.find((t) => t.id === entry.templateId)?.name}</span>}<span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{getMetricLabel(entry.metric)}</span></div>
                        <span className="text-[10px] text-slate-500">{new Date(entry.timestamp).toLocaleTimeString('de-DE')}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Wert: <span className="text-white font-semibold">{entry.triggeredValue?.toFixed(2)}</span>{' '}{getMetricUnit(entry.metric)} {getOperatorLabel(entry.operator)} {entry.threshold}{getMetricUnit(entry.metric)}</div>
                      {entry.note && <div className="text-xs text-slate-500 mt-1 italic">"{entry.note}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            <form onSubmit={handleWebhookSubmit} className="bg-slate-800 rounded-lg p-4 border border-slate-600 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Webhook className="w-4 h-4 text-amber-400" />Webhook hinzufügen</h3>
              <div><label className="text-xs text-slate-400 mb-1 block">Name</label><input type="text" value={webhookForm.name} onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })} placeholder="Discord #alerts" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" required /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Format</label><select value={webhookForm.format} onChange={(e) => setWebhookForm({ ...webhookForm, format: e.target.value })} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none">{WEBHOOK_PRESETS.map((p) => (<option key={p.format} value={p.format}>{p.name}</option>))}</select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">URL</label><input type="url" value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} placeholder={WEBHOOK_PRESETS.find((p) => p.format === webhookForm.format)?.placeholder} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" required /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Secret / Token (optional)</label><input type="password" value={webhookForm.secret} onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })} placeholder="Bearer token oder leer lassen" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" /></div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 py-2 rounded-lg text-sm font-semibold transition-colors">Webhook speichern</button>
            </form>

            {webhooks.length === 0 ? (
              <div className="text-center py-6 text-slate-500"><Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Keine Webhooks konfiguriert</p><p className="text-xs mt-1">Füge Discord, Slack oder Custom URLs hinzu</p></div>
            ) : (
              <div className="space-y-2">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className={`group bg-slate-800 rounded-lg p-3 border transition-all ${webhook.enabled ? 'border-slate-600' : 'border-slate-700 opacity-60'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="font-semibold text-white text-sm">{webhook.name}</span><span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase">{webhook.format}</span><span className={`text-xs px-1.5 py-0.5 rounded ${webhook.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-400'}`}>{webhook.enabled ? 'AKTIV' : 'INAKTIV'}</span></div>
                        <div className="text-xs text-slate-500 mt-1 truncate">{webhook.url}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onToggleWebhook(webhook.id)} className={`p-1.5 rounded transition-colors ${webhook.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-700'}`}><Power className="w-4 h-4" /></button>
                        <button onClick={() => onDeleteWebhook(webhook.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
