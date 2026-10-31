/**
 * lootfilter.json `skills` and `knownLayers`: what the loot filter's skill, skill tab and class pickers list, without
 * loading skills.json. The param encodings are in engine/statLayers.ts.
 *
 * - `createPropertyLayerResolver`: which layered stat params a property writes (also `affixes.json` `layers`):
 *   func 10 skill tab (param, else the slot `val`) → `skillTabLayer`; func 21 class skills → the slot `val`;
 *   func 36 random class skills → every class id of min–max; func 22/24 → the skill id of the param; func 12 random
 *   skill → every id of min–max when it spans at most 64 ids (ESR's "any class skill" range 418-697 of The Stone of
 *   Jordan and three more uniques is left out without a warning: it would list every class skill as "on items");
 *   func 11 event / func 19 charged → `skill << 6 | max` (max = level). The `_display` / `_hidden` companions
 *   (`isTechnicalStat`) are skipped: ESR's hidden procs use skill ids above 1023, and no picker offers them.
 * - Sources: magic affixes, uniques, set items (own and partial bonuses), sets.txt set bonuses (PCode2a-5b,
 *   FCode1-8; retired `_old` sets left out), runes.txt recipes, cube outputs and every propertygroups.txt entry (a
 *   ParMin–ParMax range is one entry per param).
 * - `knownLayers`: per skill, event and charged stat the distinct params of all sources. `skills`: the class tree
 *   skills (a class `charclass` and skilldesc `SkillPage` 1-3) plus every skill a known layer names; name via the stat
 *   renderer's skill lookup.
 * - Warnings: unknown skills, event / charged levels outside 1-63, skill ids above 1023 (the layer would exceed 65535),
 *   and itemstatcost rows that look layered (`Encode` 2/3, a skill descfunc) but are not in STAT_LAYER_KINDS.
 */
import type { LootFilterDataBundle, LootFilterSkill, StatParam } from '../engine/schema.ts';
import { CLASS_CODES, isClassCode } from '../engine/schema.ts';
import { skillLevelLayer, skillTabLayer, statLayerKind, MAX_LAYER_LEVEL, MAX_LAYER_SKILL } from '../engine/statLayers.ts';
import { isTechnicalStat, type StatIndex } from './affixStats.ts';
import type { ModInput } from './stats/expandProperty.ts';
import { entryParams } from './stats/propertyGroups.ts';
import { classCodeOf, type SkillLookup } from './stats/skills.ts';
import type { PropertyDef, PropertyGroupDef } from './stats/tables.ts';
import type { TsvTable } from './tsv.ts';

/** Largest func 12 skill id range that is listed (ESR's one-class random skills span 35 ids) */
const MAX_RANDOM_SKILLS = 64;
/** itemstatcost descfuncs that print a skill, tab or class from the param */
const LAYERED_DESCFUNCS = new Set([13, 14, 15, 16, 24, 27, 28]);
/** itemstatcost `Encode` 2 = skill on event, 3 = charged skill */
const LAYERED_ENCODES = new Set([2, 3]);
const SKILL_PAGES = new Set([1, 2, 3]);

export interface PropertyLayers {
  layers: StatParam[];
  warnings: string[];
}

/** The layered stat params one property writes; plain stats and unknown properties (propertygroups codes) give none. */
export type PropertyLayerResolver = (mod: ModInput) => PropertyLayers;

export function createPropertyLayerResolver(
  properties: ReadonlyMap<string, PropertyDef>,
  stats: StatIndex,
  skillId: (param: string) => number | null
): PropertyLayerResolver {
  return (mod) => {
    const layers: StatParam[] = [];
    const warnings: string[] = [];
    const def = properties.get(mod.code);
    if (def === undefined) return { layers, warnings };
    const param = mod.param ?? '';
    const where = param === '' ? `"${mod.code}"` : `"${mod.code}" ${param}`;
    const skillOf = (value: string): number | null => {
      const id = value === '' ? null : skillId(value);
      if (id === null) warnings.push(`${where}: unknown skill "${value}"`);
      return id;
    };
    for (const slot of def.slots) {
      if (statLayerKind(slot.stat) === undefined || isTechnicalStat(slot.stat)) continue;
      const stat = stats.get(slot.stat)?.id;
      if (stat === undefined) {
        warnings.push(`${where}: unknown stat "${slot.stat}"`);
        continue;
      }
      const push = (value: number) => layers.push({ stat, param: value });
      switch (slot.func) {
        case 10: {
          const tab = param === '' ? slot.val : Number(param);
          const layer = skillTabLayer(tab);
          if (layer === undefined) warnings.push(`${where}: skill tab ${String(tab)} is not a class tab`);
          else push(layer);
          break;
        }
        case 21:
          push(slot.val);
          break;
        case 36:
          for (let cls = mod.min; cls <= mod.max; cls++) {
            if (cls >= 0 && cls < CLASS_CODES.length) push(cls);
            else warnings.push(`${where}: class id ${String(cls)} is not a class`);
          }
          break;
        case 22:
        case 24: {
          const id = skillOf(param);
          if (id !== null) push(id);
          break;
        }
        case 12: {
          if (mod.max - mod.min + 1 > MAX_RANDOM_SKILLS) break;
          for (let id = mod.min; id <= mod.max; id++) if (skillOf(String(id)) !== null) push(id);
          break;
        }
        case 11:
        case 19: {
          const id = skillOf(param);
          if (id === null) break;
          const layer = skillLevelLayer(id, mod.max);
          if (layer !== undefined) push(layer);
          else if (id > MAX_LAYER_SKILL)
            warnings.push(
              `${where}: skill id ${String(id)} above ${String(MAX_LAYER_SKILL)} does not fit a stat param (skill << 6 | level)`
            );
          else warnings.push(`${where}: level ${String(mod.max)} outside 1-${String(MAX_LAYER_LEVEL)}`);
          break;
        }
        default:
          warnings.push(`${where}: func ${String(slot.func)} on layered stat "${slot.stat}" is not read`);
      }
    }
    return { layers, warnings };
  };
}

/** One property list the game puts on items, with a label for the warnings */
export interface LayerSource {
  label: string;
  mods: readonly ModInput[];
}

/** Retired sets kept in sets.txt under a suffixed index (as in bundleSets.ts) */
const OLD_SET_SUFFIX = '_old';

/** The set-wide bonuses of every sets.txt row: partial (PCode2a-5b) and full set (FCode1-8) */
export function setBonusSources(sets: TsvTable): LayerSource[] {
  const columns = [
    ...[2, 3, 4, 5].flatMap((n) => ['a', 'b'].map((part) => ['PCode', 'PParam', 'PMin', 'PMax'].map((col) => `${col}${String(n)}${part}`))),
    ...Array.from({ length: 8 }, (_, i) => ['FCode', 'FParam', 'FMin', 'FMax'].map((col) => `${col}${String(i + 1)}`)),
  ];
  return sets.rows.flatMap((row) => {
    const index = row.str('index');
    if (index === '' || index.endsWith(OLD_SET_SUFFIX)) return [];
    const mods = columns.flatMap(([code, param, min, max]) => {
      const prop = row.has(code) ? row.str(code) : '';
      if (prop === '') return [];
      const value = row.str(param);
      return [{ code: prop, param: value === '' ? null : value, min: row.num(min), max: row.num(max) }];
    });
    return [{ label: `set bonus ${index}`, mods }];
  });
}

/** Every propertygroups.txt entry as a mod, one per param of a ParMin–ParMax range */
export function propertyGroupSources(groups: ReadonlyMap<string, PropertyGroupDef>): LayerSource[] {
  return [...groups.values()].map((group) => ({
    label: `propertygroup ${group.code}`,
    mods: group.entries.flatMap((entry) =>
      entryParams(entry.parMin, entry.parMax).map((param) => ({
        code: entry.prop,
        param: param === '' ? null : param,
        min: entry.modMin,
        max: entry.modMax,
      }))
    ),
  }));
}

export interface LootFilterSkillsInput {
  /** skills.txt (row index = skill id) */
  skills: TsvTable;
  skilldesc: TsvTable;
  /** itemstatcost.txt with its Expansion rows kept (row index = stat id) */
  itemstatcost: TsvTable;
  lookup: SkillLookup;
  layers: PropertyLayerResolver;
  sources: readonly LayerSource[];
}

export interface LootFilterSkillsResult {
  bundle: Required<Pick<LootFilterDataBundle, 'skills' | 'knownLayers'>>;
  warnings: string[];
}

export function buildLootFilterSkills(input: LootFilterSkillsInput): LootFilterSkillsResult {
  const warnings = new Set<string>();
  const statNames = input.itemstatcost.rows.map((row) => row.str('Stat'));

  for (const [id, row] of input.itemstatcost.rows.entries()) {
    const name = row.str('Stat');
    if (name === '' || statLayerKind(name) !== undefined) continue;
    const encode = row.has('Encode') ? row.num('Encode') : 0;
    const descfunc = row.has('descfunc') ? row.num('descfunc') : 0;
    if (LAYERED_ENCODES.has(encode) || LAYERED_DESCFUNCS.has(descfunc))
      warnings.add(
        `lootfilter skills: stat ${String(id)} "${name}" (Encode ${String(encode)}, descfunc ${String(descfunc)}) is not in STAT_LAYER_KINDS`
      );
  }

  const known = new Map<number, Set<number>>();
  const skillIds = new Set<number>();
  for (const source of input.sources) {
    for (const mod of source.mods) {
      const result = input.layers(mod);
      for (const warning of result.warnings) warnings.add(`lootfilter skills: ${source.label}: ${warning}`);
      for (const { stat, param } of result.layers) {
        const name = statNames.at(stat) ?? '';
        const kind = statLayerKind(name);
        if (kind === undefined || kind === 'tab' || kind === 'class') continue;
        let params = known.get(stat);
        if (params === undefined) known.set(stat, (params = new Set()));
        params.add(param);
        skillIds.add(kind === 'skill' ? param : param >> 6);
      }
    }
  }

  const pages = new Map(input.skilldesc.rows.map((row) => [row.str('skilldesc'), row.num('SkillPage')] as const));
  input.skills.rows.forEach((row, id) => {
    if (isClassCode(row.str('charclass')) && SKILL_PAGES.has(pages.get(row.str('skilldesc')) ?? 0)) skillIds.add(id);
  });

  const skills: LootFilterSkill[] = [];
  for (const id of [...skillIds].sort((a, b) => a - b)) {
    const info = input.lookup.skill(String(id));
    if (info === null) {
      warnings.add(`lootfilter skills: skill id ${String(id)} has no skills.txt row`);
      continue;
    }
    const clsName = info.cls === null ? undefined : input.lookup.classText(info.cls)?.name;
    const cls = clsName === undefined ? '' : classCodeOf(clsName);
    skills.push({ id, name: info.name, ...(isClassCode(cls) ? { cls } : {}) });
  }

  const knownLayers = [...known.entries()]
    .sort(([a], [b]) => a - b)
    .map(([stat, params]) => ({ stat, layers: [...params].sort((a, b) => a - b) }));
  return { bundle: { skills, knownLayers }, warnings: [...warnings] };
}
