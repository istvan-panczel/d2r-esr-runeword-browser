/**
 * The terror zone schedule of a terrorzones.json bundle: which zone group is terrorized when. Times are Unix seconds
 * (the game reads the PC clock in UTC; the UI formats them in the local time zone). One `Rotation` per bundle caches
 * the replay from the config's start, so every helper here is cheap after the first call.
 */
import type { TerrorZoneGroup, TerrorZonesBundle } from '@/features/game-data/engine/schema';
import { Rotation } from './rotation';

export interface TerrorZoneSchedule {
  readonly bundle: TerrorZonesBundle;
  readonly rotation: Rotation;
  /** Seconds from one slot's start to the next (zone + break) */
  readonly period: number;
  /** Seconds a zone stays terrorized */
  readonly zoneSeconds: number;
}

/** One window in which a zone group is terrorized. */
export interface TerrorZoneSlot {
  readonly slot: number;
  /** Unix seconds */
  readonly start: number;
  /** Unix seconds, exclusive */
  readonly end: number;
  /** Index into `bundle.zones` */
  readonly zoneIndex: number;
  readonly zone: TerrorZoneGroup;
}

/** How far ahead "next time this group is terrorized" looks (60-minute slots: about 6 weeks). */
export const NEXT_OCCURRENCE_LOOKAHEAD = 1000;

export function createSchedule(bundle: TerrorZonesBundle): TerrorZoneSchedule {
  const { config, zones } = bundle;
  const period = (config.zoneMinutes + config.breakMinutes) * 60;
  return {
    bundle,
    rotation: new Rotation({ start: config.start, period, seed: BigInt(config.seed), zoneCount: zones.length }),
    period,
    zoneSeconds: config.zoneMinutes * 60,
  };
}

/** The slot whose period contains `now` (negative before the config starts; may be past its end). */
export function slotIndexAt(schedule: TerrorZoneSchedule, now: number): number {
  return Math.floor((now - schedule.bundle.config.start) / schedule.period);
}

/** A slot's window; null before the config starts or from its end on. */
export function slotWindow(schedule: TerrorZoneSchedule, slot: number): TerrorZoneSlot | null {
  const { config, zones } = schedule.bundle;
  if (slot < 0) return null;
  const start = config.start + slot * schedule.period;
  if (config.end !== null && start >= config.end) return null;
  const zoneIndex = schedule.rotation.pick(slot);
  const zone = zones.at(zoneIndex);
  if (zone === undefined) return null;
  const end = start + schedule.zoneSeconds;
  return { slot, start, end: config.end === null ? end : Math.min(end, config.end), zoneIndex, zone };
}

/** The window terrorized at `now`; null before the start, after the end or inside a break. */
export function currentWindow(schedule: TerrorZoneSchedule, now: number): TerrorZoneSlot | null {
  const window = slotWindow(schedule, slotIndexAt(schedule, now));
  return window !== null && now >= window.start && now < window.end ? window : null;
}

/** The first slot that starts after `now` (0 before the config starts). */
export function nextSlotIndex(schedule: TerrorZoneSchedule, now: number): number {
  return Math.max(0, slotIndexAt(schedule, now) + 1);
}

/** Up to `count` windows starting after `now`, soonest first (fewer when the config ends). */
export function upcomingWindows(schedule: TerrorZoneSchedule, now: number, count: number): TerrorZoneSlot[] {
  return windowsFrom(schedule, nextSlotIndex(schedule, now), count);
}

/** Up to `count` windows from slot `first` on. */
export function windowsFrom(schedule: TerrorZoneSchedule, first: number, count: number): TerrorZoneSlot[] {
  const windows: TerrorZoneSlot[] = [];
  for (let slot = Math.max(0, first); slot < first + count; slot++) {
    const window = slotWindow(schedule, slot);
    if (window === null) break;
    windows.push(window);
  }
  return windows;
}

/**
 * The next window of every zone group (index = `bundle.zones` index) that has not ended at `now`: the current one
 * included. null for a group not picked within `lookahead` slots.
 */
export function nextWindowPerZone(
  schedule: TerrorZoneSchedule,
  now: number,
  lookahead = NEXT_OCCURRENCE_LOOKAHEAD
): (TerrorZoneSlot | null)[] {
  const found: (TerrorZoneSlot | null)[] = schedule.bundle.zones.map(() => null);
  let missing = found.length;
  const first = Math.max(0, slotIndexAt(schedule, now));
  for (let slot = first; slot < first + lookahead && missing > 0; slot++) {
    const window = slotWindow(schedule, slot);
    if (window === null) break;
    if (window.end <= now || found[window.zoneIndex] !== null) continue;
    found[window.zoneIndex] = window;
    missing--;
  }
  return found;
}
