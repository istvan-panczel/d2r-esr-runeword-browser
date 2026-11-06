import type { TerrorZoneSlot } from '../engine/schedule';

/** How a watched zone group shows on the minimised widget: terrorized now, next up, or nothing. */
export type WatchAlert = 'active' | 'next' | null;

export function isWatchedSlot(slot: TerrorZoneSlot | null | undefined, watched: ReadonlySet<string>): boolean {
  return slot !== null && slot !== undefined && watched.has(slot.zone.id);
}

/** 'active' when the current group is watched, else 'next' when the next one is, else null. */
export function watchAlert(current: TerrorZoneSlot | null, next: TerrorZoneSlot | null, watched: ReadonlySet<string>): WatchAlert {
  if (isWatchedSlot(current, watched)) return 'active';
  if (isWatchedSlot(next, watched)) return 'next';
  return null;
}

/** The slots of watched groups only (or all of them when `watchedOnly` is off). */
export function filterSlots(slots: readonly TerrorZoneSlot[], watched: ReadonlySet<string>, watchedOnly: boolean): TerrorZoneSlot[] {
  return watchedOnly ? slots.filter((slot) => watched.has(slot.zone.id)) : [...slots];
}

/** The stored watch list without ids the current bundle no longer has (a renamed or removed zone group). */
export function knownWatched(watched: readonly string[], zoneIds: readonly string[]): Set<string> {
  const known = new Set(zoneIds);
  return new Set(watched.filter((id) => known.has(id)));
}

/** Toggles `id` in a stored watch list (kept in insertion order, no duplicates). */
export function toggleWatched(watched: readonly string[], id: string): string[] {
  return watched.includes(id) ? watched.filter((entry) => entry !== id) : [...watched, id];
}

/** A notification later than this after the zone started is dropped (a tab that slept or was frozen) */
export const NOTIFY_MAX_DELAY_SECONDS = 5 * 60;

/**
 * Whether a tab should notify for `current`: the slot changed while the tab was open (not on page load), the group is
 * watched, notifications are on, it started at most NOTIFY_MAX_DELAY_SECONDS ago, and no other tab has notified for
 * it yet (`lastNotifiedStart` in localStorage: the slot's start in Unix seconds, so it survives a config whose slot
 * numbers restart).
 */
export function shouldNotify(input: {
  readonly previousSlot: number | null;
  readonly current: TerrorZoneSlot | null;
  readonly watched: ReadonlySet<string>;
  readonly enabled: boolean;
  readonly lastNotifiedStart: number | null;
  readonly now: number;
}): boolean {
  const { previousSlot, current, watched, enabled, lastNotifiedStart, now } = input;
  if (!enabled || current === null || previousSlot === null) return false;
  if (current.slot === previousSlot) return false;
  if (now - current.start > NOTIFY_MAX_DELAY_SECONDS) return false;
  if (lastNotifiedStart !== null && lastNotifiedStart >= current.start) return false;
  return watched.has(current.zone.id);
}
