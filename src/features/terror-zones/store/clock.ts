import { useSyncExternalStore } from 'react';

/**
 * One ticking clock shared by the widget and the page (Unix seconds). It ticks every second while the tab is visible
 * (the countdown) and every 30 s while it is hidden (enough to notice a slot change for a notification, and browsers
 * throttle background timers anyway). It only runs while something is subscribed.
 */
const VISIBLE_TICK_MS = 1000;
const HIDDEN_TICK_MS = 30_000;

const nowSeconds = () => Math.floor(Date.now() / 1000);

let now = nowSeconds();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  const next = nowSeconds();
  if (next === now) return;
  now = next;
  for (const notify of listeners) notify();
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function startTimer(): void {
  if (timer !== null) clearInterval(timer);
  timer = setInterval(tick, isHidden() ? HIDDEN_TICK_MS : VISIBLE_TICK_MS);
}

function onVisibilityChange(): void {
  tick();
  startTimer();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    startTimer();
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer !== null) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

function getNow(): number {
  return now;
}

/** The current Unix second; re-renders on every tick. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getNow);
}

/**
 * A value derived from the clock that re-renders only when it changes (`select` must return a primitive), e.g. the
 * current slot index: the schedule is recomputed once per slot, not every second.
 */
export function useClockValue<T extends string | number | boolean | null>(select: (now: number) => T): T {
  return useSyncExternalStore(subscribe, () => select(getNow()));
}
