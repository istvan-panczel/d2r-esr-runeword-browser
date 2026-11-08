import type { BaseItem, ItemTypeInfo } from '../engine/schema';

export function formatRange(range: readonly [number, number]): string {
  return range[0] === range[1] ? String(range[0]) : `${String(range[0])}–${String(range[1])}`;
}

/** An armor's armor.txt `speed` as Faster Run/Walk: a positive value slows you (5 → "−5%"), a negative one speeds you up. */
export function formatArmorRunWalk(speed: number): string {
  return `${speed > 0 ? '−' : '+'}${String(Math.abs(speed))}%`;
}

/** "N (ilvl ≤ t1) / N (≤ t2) / N", or a single number when every band has the same cap. */
export function formatSocketCaps(caps: BaseItem['socketCaps'], thresholds: ItemTypeInfo['thresholds']): string {
  if (caps[0] === caps[1] && caps[1] === caps[2]) return String(caps[0]);
  return `${String(caps[0])} (ilvl ≤ ${String(thresholds[0])}) / ${String(caps[1])} (≤ ${String(thresholds[1])}) / ${String(caps[2])}`;
}
