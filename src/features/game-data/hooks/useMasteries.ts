import { useSyncExternalStore } from 'react';
import { loadGameDataFile } from '../engine/browser/loadGameData';
import { buildMasteryIndex, type MasteryIndex } from '../utils/masteries';

/*
 * One shared store for masteries.json (a small bundle): the skill cards load it the first time one is shown, and keep
 * the index for the page's lifetime. A failed load leaves the cards without the section until the next subscriber
 * after it retries (like the item icons).
 */
let index: MasteryIndex | null = null;
let loading = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (index === null && !loading) {
    loading = true;
    loadGameDataFile('masteries').then(
      (bundle) => {
        loading = false;
        index = buildMasteryIndex(bundle);
        notify();
      },
      (error: unknown) => {
        loading = false;
        console.warn('Weapon masteries unavailable:', error);
      }
    );
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MasteryIndex | null {
  return index;
}

/** The weapon mastery index; null while it loads (or after a failed load) */
export function useMasteries(): MasteryIndex | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}
