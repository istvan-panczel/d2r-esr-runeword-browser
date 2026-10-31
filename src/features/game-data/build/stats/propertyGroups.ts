/**
 * propertygroups.txt random pools. PickMode semantics (verified against ESR 3.2.10 data and the gemwords.htm docs page;
 * the `*` comment columns are empty):
 *
 * - 0: every entry applies (762 groups). An entry that is itself a pick-one group is rolled ModMin–ModMax times:
 *   `diamond-armor-1` = `diamond-armor-base-1` ×1-2 + `gemwords-base-affixes-armor-1` ×1-2, shown on the docs page as
 *   two "1-2 of the following:" pools.
 * - 1: one entry, weighted by `Chance` (650 groups; weights 1 and 5).
 * - 2: one entry (22 groups, every Chance is 1; alternatives such as `opalvein-ed` / `opalvein-spell`), same as 1.
 *
 * An entry with a numeric ParMin < ParMax picks the param in that range (e.g. `skilltab` 21-23 = one Warlock tab);
 * it is listed as one option per param sharing the entry's chance.
 */
import type { ModInput } from './expandProperty.ts';
import type { PropertyGroupDef } from './tables.ts';

export interface PoolOption {
  mods: ModInput[];
  /** Nested pools of an option that is a group itself (rare) */
  pools: Pool[];
  /** Probability 0-1 */
  chance: number;
}

export interface Pool {
  count: { min: number; max: number };
  options: PoolOption[];
}

export interface ResolvedMods {
  /** Mods that always apply (plain properties and the entries of PickMode 0 groups) */
  mods: ModInput[];
  pools: Pool[];
  warnings: string[];
}

const MAX_DEPTH = 5;

/** The params of a group entry: one per number of a numeric ParMin < ParMax range (`skilltab` 21-23), else ParMin */

export function entryParams(parMin: string, parMax: string): string[] {
  if (/^\d+$/.test(parMin) && /^\d+$/.test(parMax) && Number(parMax) > Number(parMin)) {
    const params: string[] = [];
    for (let p = Number(parMin); p <= Number(parMax); p++) params.push(String(p));
    return params;
  }
  return [parMin];
}

export function resolveGroups(mods: readonly ModInput[], groups: ReadonlyMap<string, PropertyGroupDef>): ResolvedMods {
  const result: ResolvedMods = { mods: [], pools: [], warnings: [] };

  const pickPool = (group: PropertyGroupDef, count: { min: number; max: number }, depth: number): Pool => {
    const weights = group.entries.map((entry) => Math.max(entry.chance, 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const options: PoolOption[] = [];
    group.entries.forEach((entry, i) => {
      const chance = total > 0 ? (weights[i] ?? 0) / total : 1 / group.entries.length;
      const params = entryParams(entry.parMin, entry.parMax);
      for (const param of params) {
        const option = resolve([{ code: entry.prop, param: param === '' ? null : param, min: entry.modMin, max: entry.modMax }], depth + 1);
        options.push({ mods: option.mods, pools: option.pools, chance: chance / params.length });
      }
    });
    return { count, options };
  };

  const resolve = (input: readonly ModInput[], depth: number): { mods: ModInput[]; pools: Pool[] } => {
    const out = { mods: [] as ModInput[], pools: [] as Pool[] };
    for (const mod of input) {
      const group = groups.get(mod.code);
      if (group === undefined) {
        out.mods.push(mod);
        continue;
      }
      if (depth >= MAX_DEPTH) {
        result.warnings.push(`propertygroup "${mod.code}" nested too deeply`);
        continue;
      }
      if (group.pickMode === 0) {
        for (const entry of group.entries) {
          const sub = groups.get(entry.prop);
          if (sub !== undefined && sub.pickMode !== 0) {
            out.pools.push(pickPool(sub, { min: Math.max(entry.modMin, 1), max: Math.max(entry.modMax, entry.modMin, 1) }, depth + 1));
          } else {
            const nested = resolve(
              [{ code: entry.prop, param: entry.parMin === '' ? null : entry.parMin, min: entry.modMin, max: entry.modMax }],
              depth + 1
            );
            out.mods.push(...nested.mods);
            out.pools.push(...nested.pools);
          }
        }
      } else {
        if (group.pickMode !== 1 && group.pickMode !== 2)
          result.warnings.push(`propertygroup "${mod.code}" has unknown PickMode ${String(group.pickMode)}`);
        out.pools.push(pickPool(group, { min: 1, max: 1 }, depth));
      }
    }
    return out;
  };

  const resolved = resolve(mods, 0);
  result.mods = resolved.mods;
  result.pools = resolved.pools;
  return result;
}

export function poolHeader(pool: Pool): string {
  const { min, max } = pool.count;
  if (min === 1 && max === 1) return 'One of:';
  return `${min === max ? String(min) : `${String(min)}-${String(max)}`} of the following:`;
}

export function formatChance(chance: number): string {
  return `${String(Math.round(chance * 1000) / 10)}%`;
}
