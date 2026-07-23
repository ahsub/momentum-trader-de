import { useEffect, useState } from 'react';
import { X, AlertTriangle, Volume2, VolumeX } from 'lucide-react';

export default function AlertToast({ triggered, onClear }) {
  const [visible, setVisible] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const newAlerts = triggered.filter((t) => !dismissed.has(t.id));
    if (newAlerts.length > 0) setVisible(newAlerts.slice(0, 3));
  }, [triggered, dismissed]);

  const dismiss = (id) => { setDismissed((prev) => new Set(prev).add(id)); setVisible((prev) => prev.filter((v) => v.id !== id)); };
  const dismissAll = () => { triggered.forEach((t) => dismissed.add(t.id)); setVisible([]); };

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      {visible.map((alert) => (
        <div key={alert.id} className="bg-slate-800 border border-amber-500/50 rounded-xl p-4 shadow-2xl shadow-amber-500/10 animate-in slide-in-from-right fade-in duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-amber-500/20 p-1.5 rounded-lg"><AlertTriangle className="w-4 h-4 text-amber-400" /></div>
              <div><h4 className="font-bold text-white text-sm">{alert.symbol}</h4><p className="text-xs text-amber-400">Alert ausgelöst!</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-slate-500 hover:text-slate-300 transition-colors p-1" title={soundEnabled ? 'Sound aus' : 'Sound an'}>{soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}</button>
              <button onClick={() => dismiss(alert.id)} className="text-slate-400 hover:text-white transition-colors p-1"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-300"><span className="font-semibold">{alert.metric}</span> ist <span className="text-amber-400 font-bold">{alert.triggeredValue?.toFixed(2)}</span>{' '}{alert.operator} {alert.threshold}</div>
          {alert.note && <div className="mt-1 text-xs text-slate-500 italic">"{alert.note}"</div>}
          <div className="mt-2 text-[10px] text-slate-500">{new Date(alert.triggeredAt).toLocaleTimeString('de-DE')}</div>
        </div>
      ))}
      {triggered.length > visible.length && <button onClick={dismissAll} className="w-full text-center text-xs text-slate-400 hover:text-white py-1 transition-colors bg-slate-800/50 rounded-lg">Alle {triggered.length} Benachrichtigungen schließen</button>}
    </div>
  );
}
