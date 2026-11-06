import { useSyncExternalStore } from 'react';
import { prefetchPeekChunks } from '@/features/skills/components/peekChunks';
import { buildModifierRefIndex, type ModifierRefIndex, type ModifierRefsData } from '../utils/modifierRefs';

/** How long the load may wait for an idle moment */
const IDLE_TIMEOUT = 3000;
/** Without requestIdleCallback (Safari): after the page's first paint has had its turn */
const FALLBACK_DELAY = 1000;

let index: ModifierRefIndex | null = null;
let started = false;
const listeners = new Set<() => void>();

function load() {
  // Its own small chunk (~9 KB gzip): the templates, titles, summaries and the facts the peek quotes
  import('../data/modifierRefs.json').then(
    (module) => {
      // The JSON's inferred type has plain arrays where the data has tuples
      index = buildModifierRefIndex(module.default as unknown as ModifierRefsData);
      for (const listener of listeners) listener();
      prefetchPeekChunks();
    },
    (error: unknown) => {
      // Item lines keep rendering as plain text; the next page load tries again
      console.error('Failed to load the modifier templates for item lines:', error);
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
 * The modifier templates item lines link to (data/modifierRefs.json). The first line that asks starts the load once
 * the browser is idle, so item pages render first; null until it is loaded (lines render as plain text until then)
 * and after a failed load. Like useSkillRefIndex.
 */
export function useModifierRefIndex(): ModifierRefIndex | null {
  return useSyncExternalStore(
    subscribe,
    () => index,
    () => null
  );
}
