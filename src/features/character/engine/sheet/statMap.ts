/** Stat maps in stat-list units (ValShift applied: life / mana / stamina × 256): stat id → param → value. Internal. */
import type { StashStat } from '@/features/stash/parser/types';
import type { SheetSourceKind } from './types';

export type StatMap = Map<number, Map<number, number>>;

export function addStat(map: StatMap, id: number, param: number, value: number): void {
  if (value === 0) return;
  let inner = map.get(id);
  if (inner === undefined) {
    inner = new Map();
    map.set(id, inner);
  }
  inner.set(param, (inner.get(param) ?? 0) + value);
}

export function getStat(map: StatMap, id: number, param = 0): number {
  return map.get(id)?.get(param) ?? 0;
}

/** Every param of a stat added up */
export function sumStat(map: StatMap, id: number): number {
  let sum = 0;
  for (const value of map.get(id)?.values() ?? []) sum += value;
  return sum;
}

export function mergeInto(into: StatMap, from: StatMap): void {
  for (const [id, inner] of from) for (const [param, value] of inner) addStat(into, id, param, value);
}

export function sameStats(a: StatMap, b: StatMap): boolean {
  if (a.size !== b.size) return false;
  for (const [id, inner] of a) {
    const other = b.get(id);
    if (other?.size !== inner.size) return false;
    for (const [param, value] of inner) if (other.get(param) !== value) return false;
  }
  return true;
}

/**
 * Saved stats (item units) → a stat map (list units). Skill-layer params (`layered`: oskills, single skills, auras) keep
 * their low 16 bits only: ESR saves 32-bit params and random class skills leave bits above the skill id.
 */
export function fromSaved(stats: readonly StashStat[], valShift: (id: number) => number, layered: ReadonlySet<number>): StatMap {
  const map: StatMap = new Map();
  for (const stat of stats)
    addStat(map, stat.id, layered.has(stat.id) ? stat.param & 0xffff : stat.param, stat.value * 2 ** valShift(stat.id));
  return map;
}

/** A record entry that may be absent (records are typed as total) */
export function entryOf<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** One source of stats: an item, a set bonus, a skill … (the unit of the breakdown) */
export interface Contribution {
  kind: SheetSourceKind;
  label: string;
  item?: number;
  skill?: number;
  stats: StatMap;
}
