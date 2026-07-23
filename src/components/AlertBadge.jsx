import { Bell } from 'lucide-react';

export default function AlertBadge({ count, onClick }) {
  if (count === 0) return null;
  return (
    <button onClick={onClick} className="relative p-2 text-slate-400 hover:text-amber-400 transition-colors" title={`${count} ausgelöste Alerts`}>
      <Bell className="w-5 h-5" />
      <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-slate-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">{count > 9 ? '9+' : count}</span>
    </button>
  );
}
