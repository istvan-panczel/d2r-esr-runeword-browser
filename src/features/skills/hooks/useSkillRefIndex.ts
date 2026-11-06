import { useSyncExternalStore } from 'react';
import { loadGameDataFile } from '@/features/game-data/engine/browser/loadGameData';
import { prefetchPeekChunks } from '../components/peekChunks';
import { buildSkillRefIndex, type SkillRefIndex } from '../utils/skillRefs';

/** How long the load may wait for an idle moment */
const IDLE_TIMEOUT = 3000;
/** Without requestIdleCallback (Safari): after the page's first paint has had its turn */
const FALLBACK_DELAY = 1000;

let index: SkillRefIndex | null = null;
let started = false;
const listeners = new Set<() => void>();

function load() {
  loadGameDataFile('skilldetails').then(
    (bundle) => {
      index = buildSkillRefIndex(bundle);
      for (const listener of listeners) listener();
      prefetchPeekChunks();
    },
    (error: unknown) => {
      // Item lines keep rendering as plain text; the next page load tries again
      console.error('Failed to load the skill names for item lines:', error);
    }
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: IDLE_TIMEOUT });
    else window.setTimeout(load, FALLBACK_DELAY);
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The skill names item lines link to (skilldetails.json, shared with the Skills page's cached bundle). The first line
 * that asks starts the load once the browser is idle, so item pages render first; null until it is loaded (lines
 * render as plain text until then) and after a failed load.
 */
export function useSkillRefIndex(): SkillRefIndex | null {
  return useSyncExternalStore(
    subscribe,
    () => index,
    () => null
  );
}
