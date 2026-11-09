/**
 * The cap a D-stoning stops at, from its cubemain rows. Each row of a D-stoning (one Dragon Stone form on one item type,
 * sometimes with a switch item) checks a cap stat (`op 16`: the cap stat is at most `value`; the light radius
 * reduction uses `op 15`, at least a negative value) and adds its bonus plus the same amount to the cap stat (the
 * `*-cap` / `*-cap-group` mods). Only D-stoning raises those cap stats, so the cap counts only what D-stoning added.
 *
 * The cap is found by applying the rows from zero, like the game: each use takes the first row (file order) whose
 * condition holds, until none does. The result is what D-stoning can add in total, which can pass the condition value
 * by up to one step (Spider's Silk on a weapon: +12% while the total is at most 500, so it stops at +504%).
 * A D-stoning can also stop on `void` blockers (the elemental Void Shard rows, ESR 3.3.02: the rows' own condition reads
 * a stat nothing raises, and three blockers stop at 300 on the fire, lightning and cold caps). Since ESR 3.3.03 a chain can
 * end on such blockers with a last row that has no condition at all (Blackmoor + Key on armor), which applies until they stop it.
 * Shared by crafting.json (`bundleCrafting.ts`) and the D-stoning family of cube.json (`bundleCube.ts`).
 */
import type { CubeMod, CubeRow } from './cubeRows.ts';

/** A D-stoning that does not stop after this many uses has no usable cap */
export const MAX_DSTONE_USES = 1000;

/** The cap mods that raise the cap stat (`swing2-cap`, `str-dex-enr-cap-group`, `extra-ele-cap-group-2`) */
export function isCapMod(mod: string): boolean {
  return /-cap(?:-group(?:-\d+)?)?$/.test(mod);
}

/**
 * A cap condition: op 15 "at least" or op 16 "at most" (as `statConditionText` in bundleCube.ts reads the ops); null for
 * another op (the half-point rows of the elemental D-stoning check `op 18`, a counter, not a cap)
 */
function capHolds(op: number, current: number, value: number): boolean | null {
  if (op === 15) return current >= value;
  if (op === 16) return current <= value;
  return null;
}

export interface DstoneCap {
  /** Uses until no row applies */
  uses: number;
  /** The bonus mods summed over every use (min and max), in first-seen order */
  mods: CubeMod[];
}

export type DstoneCapResult =
  | { kind: 'capped'; cap: DstoneCap }
  /** A row without a condition and no blocker to stop it: it always applies (Forging Hammer on a weapon) */
  | { kind: 'uncapped' }
  /** A condition that is not a cap (op other than 15 / 16), or no stop within MAX_DSTONE_USES */
  | { kind: 'unknown'; reason: string };

/** The `void` rows that stop a D-stoning once a stat is high enough (`op 15`), out of all cubemain rows */
export function dstoneBlockers(rows: readonly CubeRow[]): CubeRow[] {
  return rows.filter((row) => row.condition?.op === 15 && row.outputs.some((output) => output.spec === 'void'));
}

/**
 * Applies a D-stoning's rows from zero until none applies.
 * @param rows the rows of one D-stoning in file order (same item type, ingredients and bonus stats)
 * @param bonusMods the bonus mods of a row (cap mods, markers and `levelreq` removed)
 * @param statIdsOf itemstatcost ids a property sets; a cap mod with none (a property group) raises the row's condition stat
 * @param blockers `dstoneBlockers` of the table; those earlier in the file with the same other ingredients apply
 */
export function dstoneCap(
  rows: readonly CubeRow[],
  bonusMods: (row: CubeRow) => readonly CubeMod[],
  statIdsOf: (property: string) => readonly number[],
  blockers: readonly CubeRow[] = []
): DstoneCapResult {
  if (rows.length === 0) return { kind: 'uncapped' };
  const first = rows[0];
  const ingredients = (row: CubeRow) => row.inputs.slice(1).join('|');
  // ESR 3.3.03: blockers per item type (`weap` / `2hsw,eli`), so only those on the same first input
  const ownBlockers = blockers.filter(
    (row) => row.line < first.line && row.inputs[0] === first.inputs[0] && ingredients(row) === ingredients(first)
  );
  if (ownBlockers.length === 0 && rows.some((row) => row.condition === null)) return { kind: 'uncapped' };
  const stats = new Map<number, number>();
  const totals = new Map<string, CubeMod>();
  for (let uses = 0; uses < MAX_DSTONE_USES; uses++) {
    // Only a stat this D-stoning raised can stop it
    const blocked = ownBlockers.some(({ condition }) => {
      const current = condition === null ? undefined : stats.get(condition.param);
      return condition !== null && current !== undefined && current >= condition.value;
    });
    if (blocked) return { kind: 'capped', cap: { uses, mods: [...totals.values()] } };
    let next: CubeRow | undefined;
    for (const row of rows) {
      const condition = row.condition;
      if (condition === null) {
        next = row;
        break;
      }
      const holds = capHolds(condition.op, stats.get(condition.param) ?? 0, condition.value);
      if (holds === null)
        return { kind: 'unknown', reason: `op ${String(condition.op)} on cubemain line ${String(row.line)} is not a cap condition` };
      if (holds) {
        next = row;
        break;
      }
    }
    if (next === undefined) return { kind: 'capped', cap: { uses, mods: [...totals.values()] } };
    const mods = next.outputs.at(0)?.mods ?? [];
    for (const mod of mods) {
      if (!isCapMod(mod.mod)) continue;
      const ids = statIdsOf(mod.mod);
      // A cap group's own amount: "extra-ele-cap-group-2" raises each cap by 2 per roll of 1
      const step = Number(/-cap-group-(\d+)$/.exec(mod.mod)?.[1] ?? 1);
      for (const id of ids.length > 0 ? ids : [next.condition?.param ?? -1]) stats.set(id, (stats.get(id) ?? 0) + mod.min * step);
    }
    for (const mod of bonusMods(next)) {
      const key = `${mod.mod}|${mod.param}`;
      const total = totals.get(key);
      if (total === undefined) totals.set(key, { ...mod });
      else totals.set(key, { ...total, min: total.min + mod.min, max: total.max + mod.max });
    }
  }
  return { kind: 'unknown', reason: `does not stop within ${String(MAX_DSTONE_USES)} uses` };
}
