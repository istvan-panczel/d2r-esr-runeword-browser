import { useSyncExternalStore } from 'react';
import { loadGameDataFile } from '@/features/game-data/engine/browser/loadGameData';
import { createSchedule, type TerrorZoneSchedule } from '../engine/schedule';

/** The shared schedule: null while loading (`error` null) or after a failed load (`error` set). */
export interface TerrorZoneScheduleState {
  readonly schedule: TerrorZoneSchedule | null;
  readonly error: unknown;
}

/*
 * One schedule for the widget and the page, so the rotation (replayed from the config's start, ~8k slots in late 2026)
 * is computed and cached once per page load. The first subscriber starts the (small, cached) terrorzones.json load; a
 * failed load is retried by the next subscriber after it, or by `retryTerrorZones`.
 */
let state: TerrorZoneScheduleState = { schedule: null, error: null };
let loading = false;
const listeners = new Set<() => void>();

function setState(next: TerrorZoneScheduleState): void {
  state = next;
  for (const notify of listeners) notify();
}

function load(): void {
  if (state.schedule !== null || loading) return;
  loading = true;
  if (state.error !== null) setState({ schedule: null, error: null });
  // createSchedule in its own step, so a bundle it rejects lands in the error path too
  loadGameDataFile('terrorzones')
    .then(createSchedule)
    .then(
      (schedule) => {
        loading = false;
        setState({ schedule, error: null });
      },
      (error: unknown) => {
        loading = false;
        console.warn('Terror zone schedule unavailable:', error);
        setState({ schedule: null, error: error ?? new Error('Unknown error') });
      }
    );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 || state.error !== null) load();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TerrorZoneScheduleState {
  return state;
}

export function useTerrorZoneSchedule(): TerrorZoneScheduleState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function retryTerrorZones(): void {
  load();
}
