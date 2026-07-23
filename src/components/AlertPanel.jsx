import { useState, useEffect } from 'react';
import { 
  initNotifications, 
  getActiveAlerts, 
  getAlertHistory, 
  acknowledgeAlert, 
  deleteAlert,
  createDefaultAlertsForPosition,
  createRollTriggerAlert
} from '../services/alertService';

/**
 * Alert Panel - Phase 8.3
 * Zeigt aktive Alerts, History und erlaubt Alert-Management
 */
export default function AlertPanel({ positions = [], className = '' }) {
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadAlerts();
    checkNotificationPermission();

    // Event-Listener für neue Alerts
    const handleAlert = (e) => {
      loadAlerts();
    };
    window.addEventListener('options-alert', handleAlert);

    return () => window.removeEventListener('options-alert', handleAlert);
  }, []);

  const loadAlerts = () => {
    setAlerts(getActiveAlerts());
    setHistory(getAlertHistory(20));
  };

  const checkNotificationPermission = async () => {
    const enabled = await initNotifications();
    setNotificationsEnabled(enabled);
  };

  const handleAcknowledge = (alertId) => {
    acknowledgeAlert(alertId);
    loadAlerts();
  };

  const handleDelete = (alertId) => {
    deleteAlert(alertId);
    loadAlerts();
  };

  const handleCreateDefaultAlerts = () => {
    positions.forEach(pos => {
      if (pos.assetClass === 'OPTION') {
        createDefaultAlertsForPosition(pos);
      }
    });
    loadAlerts();
  };

  const severityColors = {
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  const typeIcons = {
    roll_trigger: '♻️',
    profit_target: '💰',
    loss_limit: '🚨',
    dte_warning: '⏰',
    itm_warning: '⚠️'
  };

  return (
    <div className={`bg-slate-950 rounded-xl border border-slate-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <h2 className="text-lg font-bold text-white">Alert Center</h2>
              <p className="text-slate-500 text-xs">
                {alerts.length} aktiv • {history.length} in History
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateDefaultAlerts}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              ➕ Auto-Alerts
            </button>
            <button
              onClick={checkNotificationPermission}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                notificationsEnabled 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {notificationsEnabled ? '🔔 Push ON' : '🔕 Push OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {[
          { id: 'active', label: 'Aktiv', count: alerts.length },
          { id: 'history', label: 'History', count: history.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2
              ${activeTab === tab.id 
                ? 'text-white border-blue-500 bg-slate-800/50' 
                : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab.id === 'active' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'active' && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-3 block">✅</span>
                <p className="text-slate-400">Keine aktiven Alerts</p>
                <p className="text-slate-500 text-sm mt-1">
                  Erstelle Alerts für deine Positionen oder nutze "Auto-Alerts"
                </p>
              </div>
            ) : (
              alerts.map(alert => (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-lg border ${severityColors[alert.severity]} transition-all hover:scale-[1.01]`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{typeIcons[alert.type] || '🔔'}</span>
                        <span className="font-bold text-white">{alert.symbol}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-500/30 text-red-300' :
                          alert.severity === 'warning' ? 'bg-amber-500/30 text-amber-300' :
                          'bg-blue-500/30 text-blue-300'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 mb-2">{alert.message}</p>

                      {alert.conditions && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {alert.conditions.dteThreshold && (
                            <span className="bg-slate-800/50 px-2 py-1 rounded text-slate-400">
                              DTE ≤ {alert.conditions.dteThreshold}
                            </span>
                          )}
                          {alert.conditions.profitTarget && (
                            <span className="bg-slate-800/50 px-2 py-1 rounded text-slate-400">
              Target: ${alert.conditions.profitTarget}
                            </span>
                          )}
                          {alert.conditions.lossLimit && (
                            <span className="bg-slate-800/50 px-2 py-1 rounded text-slate-400">
              Limit: ${alert.conditions.lossLimit}
                            </span>
                          )}
                        </div>
                      )}

                      {alert.triggeredAt && (
                        <p className="text-xs text-slate-500 mt-2">
                          🕐 {new Date(alert.triggeredAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 
                          px-3 py-1.5 rounded transition-colors"
                      >
                        ✓ OK
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-400 
                          px-3 py-1.5 rounded transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  {alert.actions && alert.actions.length > 0 && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
                      {alert.actions.map(action => (
                        <button
                          key={action.id}
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 
                            px-3 py-1.5 rounded transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Keine Alert-History vorhanden
              </div>
            ) : (
              history.map((alert, i) => (
                <div 
                  key={i}
                  className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 flex items-center gap-3"
                >
                  <span className="text-lg">{typeIcons[alert.type] || '🔔'}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{alert.symbol}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        alert.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{alert.message}</p>
                  </div>
                  <span className="text-xs text-slate-600">
                    {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleDateString() : '--'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
