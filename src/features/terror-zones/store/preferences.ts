import { useSyncExternalStore } from 'react';
import { readPersistentJson, writePersistentJson, type PersistentStorage } from '@/core/hooks/usePersistentState';
import type { TerrorZoneGroup } from '@/features/game-data/engine/schema';
import { reconcileWatched, sameZoneGroupHashes, toggleWatched, zoneGroupHashes, type ZoneGroupHashes } from '../utils/watched';

/** localStorage keys (this browser only; nothing is synced to an account) */
export const WATCHED_STORAGE_KEY = 'terrorZones.watched';
/**
 * `zoneGroupHashes` of the zone groups the watch list was starred against (a star is dropped when its group's areas
 * change); v1.59.0 stored one `zoneSetFingerprint` string here
 */
export const WATCHED_ZONE_SET_STORAGE_KEY = 'terrorZones.watchedZoneSet';
export const NOTIFY_STORAGE_KEY = 'terrorZones.notify';
/**
 * The start (Unix seconds) of the last slot a tab sent a notification for, so a second open tab does not notify again.
 */
export const LAST_NOTIFIED_STORAGE_KEY = 'terrorZones.lastNotifiedStart';
/** The widget's open / minimised choice (absent: open, minimised on phones) */
export const WIDGET_OPEN_STORAGE_KEY = 'terrorZones.widgetOpen';

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isStoredZoneSet = (value: unknown): value is ZoneGroupHashes | string =>
  typeof value === 'string' ||
  (typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((hash) => typeof hash === 'string'));
const isSeconds = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

export interface TerrorZonePrefs {
  /** Watched zone group ids (`ESR-Zone03` …) */
  readonly watched: readonly string[];
  /** Browser notifications when a watched group starts */
  readonly notify: boolean;
}

function storage(): PersistentStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): TerrorZonePrefs {
  return {
    watched: readPersistentJson<string[]>(storage(), WATCHED_STORAGE_KEY, [], isStringList),
    notify: readPersistentJson(storage(), NOTIFY_STORAGE_KEY, false, isBoolean),
  };
}

/*
 * One shared store (not usePersistentState per component): the widget and the page both show and change the watch
 * list, and another tab's change arrives through the `storage` event.
 */
let state: TerrorZonePrefs | null = null;
const listeners = new Set<() => void>();

function emit(next: TerrorZonePrefs): void {
  state = next;
  for (const notify of listeners) notify();
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === WATCHED_STORAGE_KEY || event.key === NOTIFY_STORAGE_KEY) emit(read());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): TerrorZonePrefs {
  state ??= read();
  return state;
}

export function useTerrorZonePrefs(): TerrorZonePrefs {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function toggleWatchedZone(id: string): void {
  const watched = toggleWatched(getSnapshot().watched, id);
  writePersistentJson(storage(), WATCHED_STORAGE_KEY, watched);
  emit({ ...getSnapshot(), watched });
}

/**
 * Called once per loaded bundle, before anything shows the watch list: a starred group whose areas changed since it
 * was starred, or which is gone, is dropped (`reconcileWatched`), since its id may now name another group; the others
 * stay. Then the groups' hashes are stored.
 */
export function syncWatchedZoneSet(zones: readonly TerrorZoneGroup[]): void {
  const store = storage();
  const stored = readPersistentJson<ZoneGroupHashes | string | null>(store, WATCHED_ZONE_SET_STORAGE_KEY, null, isStoredZoneSet);
  const hashes = zoneGroupHashes(zones);
  if (stored !== null && typeof stored !== 'string' && sameZoneGroupHashes(stored, hashes)) return;
  const prefs = read();
  const watched = reconcileWatched(prefs.watched, stored, zones);
  if (watched !== prefs.watched) {
    console.info('Terror zone groups changed with this ESR version: stars of changed groups cleared');
    writePersistentJson(store, WATCHED_STORAGE_KEY, watched);
    emit({ ...prefs, watched });
  }
  writePersistentJson(store, WATCHED_ZONE_SET_STORAGE_KEY, hashes);
}

export function setNotifyEnabled(notify: boolean): void {
  writePersistentJson(storage(), NOTIFY_STORAGE_KEY, notify);
  emit({ ...getSnapshot(), notify });
}

export function readLastNotifiedStart(): number | null {
  return readPersistentJson<number | null>(storage(), LAST_NOTIFIED_STORAGE_KEY, null, isSeconds);
}

export function writeLastNotifiedStart(start: number): void {
  writePersistentJson(storage(), LAST_NOTIFIED_STORAGE_KEY, start);
}
