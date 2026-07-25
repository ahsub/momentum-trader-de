import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradeJournalStore, SETUP_TYPES, TAGS, EXIT_REASONS } from '../stores/tradeJournalStore';

/**
 * TradeJournalPanel — Haupt-UI für Trade-Journal
 * v2.1.0 — momentum-trader-de
 * 
 * Zeigt alle Journal-Einträge mit Filter, Sortierung und Detailansicht
 */

export default function TradeJournalPanel() {
  const {
    entries,
    filters,
    setFilter,
    clearFilters,
    getFilteredEntries,
    getPerformanceMetrics,
    getSetupStats,
    removeEntry,
  } = useTradeJournalStore();
  
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState('entryDate');
  const [sortDesc, setSortDesc] = useState(true);
  
  const filteredEntries = getFilteredEntries();
  const metrics = getPerformanceMetrics();
  const setupStats = getSetupStats();
  
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (sortBy === 'entryDate' || sortBy === 'exitDate') {
      valA = new Date(valA || 0);
      valB = new Date(valB || 0);
    }
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });
  
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };
  
  return (
    <div className="space-y-6">
      <PerformanceOverview metrics={metrics} />
      
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.setupType || ''}
          onChange={(e) => setFilter('setupType', e.target.value || null)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
        >
          <option value="">Alle Setups</option>
          {SETUP_TYPES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        
        <select
          value={filters.status || ''}
          onChange={(e) => setFilter('status', e.target.value || null)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
        >
          <option value="">Alle Status</option>
          <option value="open">Offen</option>
          <option value="closed">Geschlossen</option>
        </select>
        
        <button
          onClick={clearFilters}
          className="text-xs text-slate-400 hover:text-slate-200 underline"
        >
          Filter zurücksetzen
        </button>
        
        <div className="flex-1" />
        
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          {showForm ? 'Abbrechen' : '+ Neuer Trade'}
        </button>
      </div>
      
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <NewTradeForm onClose={() => setShowForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700/40">
          <button onClick={() => toggleSort('symbol')} className="col-span-2 text-left hover:text-slate-300">Symbol ↕</button>
          <button onClick={() => toggleSort('setupType')} className="col-span-2 text-left hover:text-slate-300">Setup ↕</button>
          <button onClick={() => toggleSort('entryDate')} className="col-span-2 text-left hover:text-slate-300">Datum ↕</button>
          <button onClick={() => toggleSort('status')} className="col-span-1 text-left hover:text-slate-300">Status ↕</button>
          <button onClick={() => toggleSort('pnl')} className="col-span-2 text-right hover:text-slate-300">P&L ↕</button>
          <button onClick={() => toggleSort('holdingDays')} className="col-span-1 text-right hover:text-slate-300">Tage ↕</button>
          <div className="col-span-2" />
        </div>
        
        {sortedEntries.map((entry) => (
          <JournalEntryRow
            key={entry.id}
            entry={entry}
            onSelect={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
            isSelected={selectedEntry === entry.id}
            onDelete={() => removeEntry(entry.id)}
          />
        ))}
        
        {sortedEntries.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            Keine Journal-Einträge vorhanden. Füge deinen ersten Trade hinzu!
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceOverview({ metrics }) {
  const cards = [
    { label: 'Trades', value: metrics.totalTrades, color: 'text-slate-200' },
    { label: 'Win Rate', value: `${metrics.winRate.toFixed(1)}%`, color: metrics.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Profit Factor', value: metrics.profitFactor.toFixed(2), color: metrics.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Expectancy', value: `$${metrics.expectancy.toFixed(2)}`, color: metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Max DD', value: `-$${metrics.maxDrawdown.toFixed(0)}`, color: 'text-rose-400' },
    { label: 'Total P&L', value: `$${metrics.totalPnl.toFixed(2)}`, color: metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
  ];
  
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          whileHover={{ scale: 1.02 }}
          className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center"
        >
          <div className={`text-lg font-bold font-mono ${card.color}`}>{card.value}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{card.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

function JournalEntryRow({ entry, onSelect, isSelected, onDelete }) {
  const isProfit = (entry.pnl || 0) >= 0;
  const setupType = SETUP_TYPES.find(s => s.id === entry.setupType);
  
  return (
    <motion.div
      layout
      className={`border rounded-xl overflow-hidden transition-colors ${
        isSelected ? 'border-slate-500 bg-slate-800/60' : 'border-slate-700/30 bg-slate-800/30 hover:border-slate-600/50'
      }`}
    >
      <div
        onClick={onSelect}
        className="grid grid-cols-12 gap-2 px-3 py-3 items-center cursor-pointer"
      >
        <div className="col-span-2">
          <span className="text-sm font-bold text-slate-200">{entry.symbol}</span>
          <span className="text-[10px] text-slate-500 ml-1">{entry.optionType?.toUpperCase()}</span>
        </div>
        <div className="col-span-2">
          <span className="text-xs text-slate-400">{setupType?.label || entry.setupType}</span>
        </div>
        <div className="col-span-2 text-xs text-slate-400">
          {new Date(entry.entryDate).toLocaleDateString('de-DE')}
        </div>
        <div className="col-span-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
            entry.status === 'closed'
              ? 'bg-slate-700/50 text-slate-400'
              : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {entry.status === 'closed' ? 'Closed' : 'Open'}
          </span>
        </div>
        <div className={`col-span-2 text-right text-sm font-mono font-bold ${
          isProfit ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {entry.pnl !== undefined ? `${isProfit ? '+' : ''}$${entry.pnl.toFixed(2)}` : '—'}
        </div>
        <div className="col-span-1 text-right text-xs text-slate-500">
          {entry.holdingDays || '—'}
        </div>
        <div className="col-span-2 flex justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-slate-500 hover:text-rose-400 p-1"
            title="Löschen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700/30 px-3 py-3"
          >
            <EntryDetails entry={entry} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EntryDetails({ entry }) {
  const { closeTrade } = useTradeJournalStore();
  const [exitPrice, setExitPrice] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [exitNotes, setExitNotes] = useState('');
  
  const handleClose = () => {
    if (!exitPrice) return;
    closeTrade(entry.id, {
      exitPrice: parseFloat(exitPrice),
      exitDate: new Date().toISOString(),
      exitReason,
      notes: exitNotes,
    });
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-500 block">Strike</span>
          <span className="text-slate-200 font-mono">${entry.strike}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Expiration</span>
          <span className="text-slate-200 font-mono">{entry.expiration}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Quantity</span>
          <span className="text-slate-200 font-mono">{entry.quantity > 0 ? '+' : ''}{entry.quantity}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Entry Price</span>
          <span className="text-slate-200 font-mono">${entry.entryPrice}</span>
        </div>
      </div>
      
      {entry.notes && (
        <div className="text-xs text-slate-400 bg-slate-900/50 rounded-lg p-2">
          <span className="text-slate-500">Notizen:</span> {entry.notes}
        </div>
      )}
      
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.map(tag => (
            <span key={tag} className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {entry.status !== 'closed' && (
        <div className="border-t border-slate-700/30 pt-3 space-y-2">
          <h5 className="text-xs font-semibold text-slate-300">Trade schließen</h5>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Exit Price"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 w-24"
            />
            <select
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
            >
              <option value="">Grund wählen...</option>
              {EXIT_REASONS.map(r => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Notizen (optional)"
              value={exitNotes}
              onChange={(e) => setExitNotes(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 flex-1"
            />
            <button
              onClick={handleClose}
              disabled={!exitPrice}
              className="bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 disabled:opacity-30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
      
      {entry.status === 'closed' && (
        <div className="border-t border-slate-700/30 pt-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Exit Price:</span>
            <span className="text-slate-200 font-mono">${entry.exitPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Exit Reason:</span>
            <span className="text-slate-200">{entry.exitReason?.replace('_', ' ') || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Holding Days:</span>
            <span className="text-slate-200">{entry.holdingDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">P&L %:</span>
            <span className={`font-mono ${entry.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {entry.pnlPercent?.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function NewTradeForm({ onClose }) {
  const { addEntry } = useTradeJournalStore();
  const [formData, setFormData] = useState({
    symbol: '',
    optionType: 'call',
    strike: '',
    expiration: '',
    quantity: '',
    entryPrice: '',
    underlyingPrice: '',
    setupType: 'csp',
    entryDate: new Date().toISOString().split('T')[0],
    notes: '',
    tags: [],
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    addEntry({
      ...formData,
      strike: parseFloat(formData.strike),
      quantity: parseInt(formData.quantity),
      entryPrice: parseFloat(formData.entryPrice),
      underlyingPrice: parseFloat(formData.underlyingPrice) || null,
      status: 'open',
    });
    onClose();
  };
  
  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };
  
  return (
    <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-slate-200">Neuer Trade</h4>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <input
          required
          placeholder="Symbol"
          value={formData.symbol}
          onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        />
        <select
          value={formData.optionType}
          onChange={(e) => setFormData({ ...formData, optionType: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        >
          <option value="call">Call</option>
          <option value="put">Put</option>
        </select>
        <input
          required
          type="number"
          step="0.01"
          placeholder="Strike"
          value={formData.strike}
          onChange={(e) => setFormData({ ...formData, strike: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        />
        <input
          required
          type="date"
          placeholder="Expiration"
          value={formData.expiration}
          onChange={(e) => setFormData({ ...formData, expiration: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <input
          required
          type="number"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        />
        <input
          required
          type="number"
          step="0.01"
          placeholder="Entry Price"
          value={formData.entryPrice}
          onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Underlying Price"
          value={formData.underlyingPrice}
          onChange={(e) => setFormData({ ...formData, underlyingPrice: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        />
        <input
          required
          type="date"
          placeholder="Entry Date"
          value={formData.entryDate}
          onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
        />
      </div>
      
      <select
        value={formData.setupType}
        onChange={(e) => setFormData({ ...formData, setupType: e.target.value })}
        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 w-full md:w-auto"
      >
        {SETUP_TYPES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      
      <div className="flex flex-wrap gap-1">
        {TAGS.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              formData.tags.includes(tag)
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            {tag.replace('_', ' ')}
          </button>
        ))}
      </div>
      
      <textarea
        placeholder="Notizen zum Setup, Management, Exit-Plan..."
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 w-full h-20 resize-none"
      />
      
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-slate-700/50 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-xs transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
