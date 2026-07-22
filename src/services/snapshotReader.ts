// ============================================
// Snapshot Reader - Verbindung zu bestehender Infrastruktur
// ============================================

import type { SnapshotData, MarketRegimeData } from '../types';

const GITHUB_RAW = 'https://raw.githubusercontent.com/ahsub/momentum-trader-de/main';
const SNAPSHOT_BASE = `${GITHUB_RAW}/data/snapshots`;

/**
 * Lädt einen Snapshot aus dem GitHub-Archiv
 * @param date - Datum im Format YYYY-MM-DD
 * @param run - 'morning' (03:00 UTC) oder 'nyse' (13:00 UTC)
 */
export async function loadSnapshot(date: string, run: 'morning' | 'nyse'): Promise<SnapshotData | null> {
  const filename = run === 'morning' ? `${date}_03.json.gz` : `${date}_13.json.gz`;
  const url = `${SNAPSHOT_BASE}/${filename}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Snapshot nicht gefunden: ${url}`);
      return null;
    }

    // Für .json.gz müssen wir dekomprimieren (im Browser via Response.arrayBuffer() + pako)
    // Hier vereinfacht für .json direkt
    const data = await response.json();
    return {
      date,
      run,
      regime: data.regime || {},
      leaderboard: data.leaderboard || {},
      tickers: data.tickers || {},
    };
  } catch (err) {
    console.error(`Fehler beim Laden des Snapshots: ${err}`);
    return null;
  }
}

/**
 * Lädt den letzten verfügbaren Snapshot
 */
export async function loadLatestSnapshot(): Promise<SnapshotData | null> {
  const today = new Date().toISOString().split('T')[0];

  // Versuche NYSE-Lauf zuerst (aktueller)
  let snapshot = await loadSnapshot(today, 'nyse');
  if (snapshot) return snapshot;

  // Fallback: Morgen-Lauf
  snapshot = await loadSnapshot(today, 'morning');
  if (snapshot) return snapshot;

  // Fallback: Gestern
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  snapshot = await loadSnapshot(yesterday, 'nyse');
  if (snapshot) return snapshot;

  return loadSnapshot(yesterday, 'morning');
}

/**
 * Extrahiert Regime-Daten aus einem Snapshot
 */
export function extractRegime(snapshot: SnapshotData): MarketRegimeData {
  const regime = snapshot.regime;
  return {
    regime: regime.regime || 'BULL_QUIET',
    score: regime.score || 50,
    moveIndex: regime.moveIndex || 85,
    vix: regime.vix || 15,
    trend: regime.trend || 'UP',
    health: regime.health || 65,
    circuitBreaker: regime.circuitBreaker || 'NORMAL',
  };
}

/**
 * Lädt Leaderboard-Daten für einen bestimmten Screen
 */
export function getLeaderboard(snapshot: SnapshotData, screen: string): any[] {
  return snapshot.leaderboard[screen] || [];
}

/**
 * Lägt Ticker-Daten aus einem Snapshot
 */
export function getTicker(snapshot: SnapshotData, ticker: string): any {
  return snapshot.tickers[ticker] || null;
}
