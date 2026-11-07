/**
 * Drop chances of a treasure class (treasureclassex.txt), with the `/players` NoDrop rule. Used for the endgame map
 * boss rewards (areas.json `mapBosses`).
 *
 * The model: a TC with positive `Picks` makes that many independent picks; each pick chooses one entry by weight,
 * NoDrop included (a sub-TC with `Picks` 1 is followed down, so one pick yields at most one item). A TC with negative
 * `Picks` rolls each entry `Prob` times in order until `-Picks` rolls are used. The `/players` rule shrinks NoDrop
 * only (an explicit `Nothing` entry is a plain entry and does not shrink). Not modelled: the monster-level TC upgrades
 * (group / level), the item quality rolls, the per-kill item cap, and `ConditionCalc` (reported by `conditions`; the
 * pick is counted as if the condition holds).
 */
import { refOf } from './treasureClasses.ts';
import type { TsvTable } from './tsv.ts';

/** treasureclassex.txt has `Item1` … `Item10` */
const TC_ITEM_COLUMNS = 10;

export interface TcRow {
  readonly name: string;
  readonly picks: number;
  readonly noDrop: number;
  readonly entries: readonly { readonly ref: string; readonly prob: number }[];
  /** `ConditionCalc` (blank: none) */
  readonly condition: string;
}

export type TcRows = ReadonlyMap<string, TcRow>;

/** The rows by `Treasure Class` name; the first row wins when a name repeats (as in game). */
export function readTcRows(table: TsvTable): Map<string, TcRow> {
  const rows = new Map<string, TcRow>();
  for (const row of table.rows) {
    const name = row.str('Treasure Class');
    if (name === '' || rows.has(name)) continue;
    const entries: { ref: string; prob: number }[] = [];
    for (let i = 1; i <= TC_ITEM_COLUMNS; i++) {
      const column = `Item${String(i)}`;
      if (!row.has(column)) continue;
      const ref = refOf(row.str(column));
      const prob = row.num(`Prob${String(i)}`);
      if (ref !== '' && prob > 0) entries.push({ ref, prob });
    }
    rows.set(name, {
      name,
      picks: row.num('Picks'),
      noDrop: row.num('NoDrop'),
      entries,
      condition: row.has('ConditionCalc') ? row.str('ConditionCalc') : '',
    });
  }
  return rows;
}

/**
 * NoDrop after the `/players` rule: with n = floor((players + 1) / 2), the chance of "no drop" becomes its n-th power,
 * written back as a weight and truncated like the game does (players 7 and 8 give the same n).
 */
export function adjustedNoDrop(noDrop: number, totalProb: number, players: number): number {
  if (noDrop <= 0 || totalProb <= 0) return Math.max(noDrop, 0);
  const n = Math.floor((players + 1) / 2);
  if (n <= 1) return noDrop;
  const ratio = (noDrop / (noDrop + totalProb)) ** n;
  return Math.floor((totalProb * ratio) / (1 - ratio));
}

/**
 * One independent pick: the chance of each item ref it gives directly, plus the multi-pick sub-TCs it can land on
 * (with that chance), whose own picks then all happen. The direct chances and branch shares sum to at most 1.
 */
export interface TcPick {
  readonly items: ReadonlyMap<string, number>;
  readonly branches: readonly { readonly share: number; readonly picks: readonly TcPick[] }[];
}

type RefTest = ReadonlySet<string> | ((ref: string) => boolean);
const testOf = (refs: RefTest) => (typeof refs === 'function' ? refs : (ref: string) => refs.has(ref));

/** The chance that one pick gives at least one of `refs` */
function pickChance(pick: TcPick, test: (ref: string) => boolean): number {
  let chance = 0;
  for (const [ref, value] of pick.items) if (test(ref)) chance += value;
  for (const branch of pick.branches) chance += branch.share * picksChance(branch.picks, test);
  return chance;
}

function picksChance(picks: readonly TcPick[], test: (ref: string) => boolean): number {
  let none = 1;
  for (const pick of picks) none *= 1 - Math.min(pickChance(pick, test), 1);
  return 1 - none;
}

/** The chance that at least one of `refs` drops over independent picks */
export function chanceOfAny(picks: readonly TcPick[], refs: RefTest): number {
  return picksChance(picks, testOf(refs));
}

/** Expected count of each item ref over independent picks */
export function expectedCounts(picks: readonly TcPick[], scale = 1, counts = new Map<string, number>()): Map<string, number> {
  for (const pick of picks) {
    for (const [ref, value] of pick.items) counts.set(ref, (counts.get(ref) ?? 0) + value * scale);
    for (const branch of pick.branches) expectedCounts(branch.picks, scale * branch.share, counts);
  }
  return counts;
}

export interface TcOdds {
  /** The independent picks a TC makes at a players setting; [] for an unknown TC */
  picks(tc: string, players: number): TcPick[];
  /** Every item ref a TC can reach (sub-TCs followed), in entry order */
  reachableRefs(tc: string): Set<string>;
  /** The `ConditionCalc` texts met on the way down from a TC */
  conditions(tc: string): string[];
  rows: TcRows;
}

const certain = (ref: string): TcPick => ({ items: new Map([[ref, 1]]), branches: [] });

export function createTcOdds(rows: TcRows): TcOdds {
  // Memoised per players setting; `active` holds the TCs being expanded, so a TC that leads back to itself throws
  const singleMemo = new Map<string, TcPick>();
  const picksMemo = new Map<string, TcPick[]>();
  const active = new Set<string>();
  const guard = <T>(row: TcRow, players: number, memo: Map<string, T>, compute: () => T): T => {
    const key = `${memo === singleMemo ? 'one' : 'all'}|${String(players)}|${row.name}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    if (active.has(key)) throw new Error(`treasure class "${row.name}" leads back to itself`);
    active.add(key);
    try {
      const value = compute();
      memo.set(key, value);
      return value;
    } finally {
      active.delete(key);
    }
  };

  const singlePick = (row: TcRow, players: number): TcPick =>
    guard(row, players, singleMemo, () => {
      const total = row.entries.reduce((sum, entry) => sum + entry.prob, 0);
      const noDrop = adjustedNoDrop(row.noDrop, total, players);
      const items = new Map<string, number>();
      const branches: { share: number; picks: readonly TcPick[] }[] = [];
      if (total <= 0) return { items, branches };
      const add = (ref: string, value: number) => items.set(ref, (items.get(ref) ?? 0) + value);
      for (const entry of row.entries) {
        const share = entry.prob / (total + noDrop);
        const sub = rows.get(entry.ref);
        if (sub === undefined) add(entry.ref, share);
        else if (sub.picks === 1) {
          const inner = singlePick(sub, players);
          for (const [ref, value] of inner.items) add(ref, value * share);
          for (const branch of inner.branches) branches.push({ share: branch.share * share, picks: branch.picks });
        } else branches.push({ share, picks: picksOf(sub, players) });
      }
      return { items, branches };
    });

  const picksOf = (row: TcRow, players: number): TcPick[] =>
    guard(row, players, picksMemo, () => {
      if (row.picks > 0) {
        const one = singlePick(row, players);
        return Array.from({ length: row.picks }, () => one);
      }
      const picks: TcPick[] = [];
      let remaining = -row.picks;
      for (const entry of row.entries) {
        if (remaining <= 0) break;
        const times = Math.min(entry.prob, remaining);
        remaining -= times;
        const sub = rows.get(entry.ref);
        const entryPicks = sub === undefined ? [certain(entry.ref)] : picksOf(sub, players);
        for (let i = 0; i < times; i++) picks.push(...entryPicks);
      }
      return picks;
    });

  /** Depth-first in entry order; each TC visited once */
  const walk = (tc: string, visit: (row: TcRow) => void, ref: (ref: string) => void) => {
    const seen = new Set<string>();
    const go = (name: string): void => {
      const row = rows.get(name);
      if (row === undefined) {
        ref(name);
        return;
      }
      if (seen.has(name)) return;
      seen.add(name);
      visit(row);
      for (const entry of row.entries) go(entry.ref);
    };
    go(tc);
  };

  return {
    rows,
    picks(tc, players) {
      const row = rows.get(tc);
      return row === undefined ? [] : picksOf(row, players);
    },
    reachableRefs(tc) {
      const refs = new Set<string>();
      walk(
        tc,
        () => undefined,
        (ref) => refs.add(ref)
      );
      return refs;
    },
    conditions(tc) {
      const found: string[] = [];
      walk(
        tc,
        (row) => {
          if (row.condition !== '') found.push(row.condition);
        },
        () => undefined
      );
      return found;
    },
  };
}
