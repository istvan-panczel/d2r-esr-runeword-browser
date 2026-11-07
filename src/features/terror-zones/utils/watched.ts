import type { TerrorZoneGroup } from '@/features/game-data/engine/schema';
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

/** FNV-1a (32 bit) of a string, as 8 hex digits */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * What the zone groups mean as one string: every id with its areas, in file order, hashed. The format v1.59.0 stored
 * (`terrorZones.watchedZoneSet`); now only read to keep such a list when the groups are still the ones it was starred
 * against.
 */
export function zoneSetFingerprint(zones: readonly TerrorZoneGroup[]): string {
  const text = zones.map((group) => `${group.id}:${group.areas.map((area) => String(area.id)).join(',')}`).join('|');
  return `${String(zones.length)}-${fnv1a(text)}`;
}

/** What each zone group means: id → a hash of its area ids (sorted). Not the labels, seed, start or durations. */
export type ZoneGroupHashes = Readonly<Record<string, string>>;

export function zoneGroupHashes(zones: readonly TerrorZoneGroup[]): ZoneGroupHashes {
  return Object.fromEntries(
    zones.map((group) => [
      group.id,
      fnv1a(
        group.areas
          .map((area) => area.id)
          .sort((a, b) => a - b)
          .join(',')
      ),
    ])
  );
}

/** Whether two stored hash maps hold the same groups with the same areas */
export function sameZoneGroupHashes(a: ZoneGroupHashes, b: ZoneGroupHashes): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((id) => Object.hasOwn(b, id) && a[id] === b[id]);
}

/** Zone group ids ESR 3.3 reused for other areas (endgame-map groups in 3.2, Act 1 groups since 3.3) */
const REGROUPED_IN_ESR_3_3: ReadonlySet<string> = new Set(['ESR-Zone19', 'ESR-Zone20']);

/**
 * The watch list to keep when a bundle loads, per group: a starred id stays while it names the same areas as when it
 * was starred (`stored`, the zoneGroupHashes saved with the list), and is dropped when its areas changed or the group
 * is gone, since the id may now name another group. Older stored formats: a v1.59.0 whole-set fingerprint keeps the
 * list only when it still matches every group; none at all means a list starred with ESR 3.2.24's groups, which loses
 * the two ids ESR 3.3 reused and those it removed. Returns `watched` itself when nothing is dropped.
 */
export function reconcileWatched(
  watched: readonly string[],
  stored: ZoneGroupHashes | string | null,
  zones: readonly TerrorZoneGroup[]
): readonly string[] {
  if (watched.length === 0) return watched;
  const current = zoneGroupHashes(zones);
  const exists = (id: string) => Object.hasOwn(current, id);
  let keep: (id: string) => boolean;
  if (stored === null) keep = (id) => exists(id) && !REGROUPED_IN_ESR_3_3.has(id);
  else if (typeof stored === 'string') {
    const unchanged = stored === zoneSetFingerprint(zones);
    keep = (id) => unchanged && exists(id);
  } else keep = (id) => exists(id) && Object.hasOwn(stored, id) && stored[id] === current[id];
  const kept = watched.filter(keep);
  return kept.length === watched.length ? watched : kept;
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
