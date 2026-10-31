/**
 * Names for the params ("layers") of the skill, skill tab, class, event and charged stats (`stat: 188, param: 50` =
 * +skills to Assassin Martial Arts), from lootfilter.json `skills` / `knownLayers` and types.json `classes`. The
 * encodings are in `game-data/engine/statLayers.ts`; the loot filter does not load skills.json.
 */
import type { ClassInfo, LootFilterDataBundle, LootFilterSkill, TypesBundle } from '@/features/game-data/engine/schema';
import { CLASS_CODES } from '@/features/game-data/engine/schema';
import {
  decodeSkillLevelLayer,
  decodeTabLayer,
  skillLevelLayer,
  statLayerKind,
  tabLayer,
  type StatLayerKind,
} from '@/features/game-data/engine/statLayers';
import type { StatCheck } from '../engine/types';
import { searchText, type PickerOption } from './pickerSearch';

export interface StatParamData {
  /** Layer kind of each layered stat, by itemstatcost id */
  readonly kinds: ReadonlyMap<number, StatLayerKind>;
  /** itemstatcost name of each layered stat, by id */
  readonly names: ReadonlyMap<number, string>;
  readonly skills: ReadonlyMap<number, LootFilterSkill>;
  /** Names more than one skill has (a class skill and its item copy): shown with the id */
  readonly duplicateNames: ReadonlySet<string>;
  /** By class id (`CLASS_CODES` order, the layer's class number) */
  readonly classes: readonly (ClassInfo | undefined)[];
  /** The params the game data puts on items, per stat id, ascending */
  readonly knownLayers: ReadonlyMap<number, readonly number[]>;
}

export const EMPTY_STAT_PARAMS: StatParamData = {
  kinds: new Map(),
  names: new Map(),
  skills: new Map(),
  duplicateNames: new Set(),
  classes: [],
  knownLayers: new Map(),
};

export function buildStatParamData(data: LootFilterDataBundle, types: TypesBundle): StatParamData {
  const kinds = new Map<number, StatLayerKind>();
  const names = new Map<number, string>();
  for (const stat of data.stats) {
    const kind = statLayerKind(stat.name);
    if (kind === undefined) continue;
    kinds.set(stat.id, kind);
    names.set(stat.id, stat.name);
  }
  const skills = data.skills ?? [];
  const seen = new Set<string>();
  const duplicateNames = new Set<string>();
  for (const skill of skills) {
    if (seen.has(skill.name)) duplicateNames.add(skill.name);
    seen.add(skill.name);
  }
  const byCode = new Map(types.classes.map((info) => [info.code, info]));
  return {
    kinds,
    names,
    skills: new Map(skills.map((skill) => [skill.id, skill])),
    duplicateNames,
    classes: CLASS_CODES.map((code) => byCode.get(code)),
    knownLayers: new Map((data.knownLayers ?? []).map((entry) => [entry.stat, entry.layers])),
  };
}

/** The layer kind of a check's stat (an itemstatcost name or id); a name is known without the game data. */
export function statParamKind(stat: string | number, d: StatParamData): StatLayerKind | undefined {
  return typeof stat === 'number' ? d.kinds.get(stat) : statLayerKind(stat);
}

/** The class's name for a class code (`sor` → Sorceress); undefined without the data. */
export function className(code: string | undefined, d: StatParamData): string | undefined {
  return code === undefined ? undefined : d.classes.find((info) => info?.code === code)?.name;
}

/** "Fire Ball", or "Chain Lightning #124" for a name several skills have; undefined for an unknown id. */
export function skillLabel(id: number, d: StatParamData): string | undefined {
  const skill = d.skills.get(id);
  if (skill === undefined) return undefined;
  return d.duplicateNames.has(skill.name) ? `${skill.name} #${String(id)}` : skill.name;
}

/**
 * The param's name: tab "Martial Arts (Assassin)", class "Sorceress", skill "Fire Ball", event and charged
 * "Orb of Winter lvl 25"; undefined when it does not decode or the data does not name it.
 */
export function statParamLabel(kind: StatLayerKind, param: number, d: StatParamData): string | undefined {
  switch (kind) {
    case 'tab': {
      const layer = decodeTabLayer(param);
      const info = layer === undefined ? undefined : d.classes[layer.cls];
      return layer === undefined || info === undefined ? undefined : `${info.tabs[layer.tab]} (${info.name})`;
    }
    case 'class':
      return d.classes[param]?.name;
    case 'skill':
      return skillLabel(param, d);
    case 'event':
    case 'charged': {
      const layer = decodeSkillLevelLayer(param);
      const skill = layer === undefined ? undefined : skillLabel(layer.skill, d);
      return layer === undefined || skill === undefined ? undefined : `${skill} lvl ${String(layer.level)}`;
    }
  }
}

/** Under a charged skill row: how its value is stored (`chargedValue` in statLayers.ts). */
export const CHARGED_VALUE_HINT =
  'Value = max charges × 256 + charges left (5/5 = 1285): ≥ 1 = has the charges, ≥ 1280 = at least 5 max charges.';

const ENTRY_NOUNS: Readonly<Record<StatLayerKind, string>> = {
  tab: 'skill tab',
  class: 'class',
  skill: 'skill',
  event: 'skill and level',
  charged: 'skill and level',
};

/**
 * Under a Test tab stat row of a layered stat without param: the evaluator takes an item entry without param as
 * param 0 (`entry.param ?? 0` in engine/evaluate.ts).
 */
export function noParamEntryHint(kind: StatLayerKind, d: StatParamData): string {
  const label = statParamLabel(kind, 0, d);
  return `No param: the test takes this entry as param 0${label === undefined ? '' : ` (${label})`}. Pick the ${ENTRY_NOUNS[kind]} the item has.`;
}

/** Whether two stats' params mean the same thing (a row keeps its param when its stat changes to such a stat). */
export function sameParamEncoding(a: StatLayerKind | undefined, b: StatLayerKind | undefined): boolean {
  const encoding = (kind: StatLayerKind | undefined) => (kind === 'charged' ? 'event' : kind);
  return encoding(a) === encoding(b);
}

// --- Picker options ---

/** Every class's three tabs, grouped by class: value = the layer (`class << 3 | tab`). */
export function tabOptions(d: StatParamData): PickerOption[] {
  return d.classes.flatMap((info, cls) =>
    info === undefined
      ? []
      : info.tabs.flatMap((tab, index) => {
          const layer = tabLayer(cls, index);
          if (layer === undefined) return [];
          const value = String(layer);
          return [{ key: value, value, label: tab, detail: value, group: info.name, search: searchText(tab, info.name, info.code, layer) }];
        })
  );
}

/** The classes: value = the class id. */
export function classOptions(d: StatParamData): PickerOption[] {
  return d.classes.flatMap((info, cls) => {
    if (info === undefined) return [];
    const value = String(cls);
    return [{ key: value, value, label: info.name, detail: value, search: searchText(info.name, info.code, cls) }];
  });
}

/** The skill ids the game data puts on items for a stat (`knownLayers`; event and charged layers decoded), ascending. */
function knownSkills(statId: number | undefined, kind: StatLayerKind, d: StatParamData): number[] {
  const layers = statId === undefined ? undefined : d.knownLayers.get(statId);
  if (layers === undefined) return [];
  if (kind === 'skill') return [...layers];
  return [...new Set(layers.flatMap((layer) => decodeSkillLevelLayer(layer)?.skill ?? []))];
}

/** The levels the game data puts on items for the stat and skill (event and charged stats), ascending. */
export function knownLevels(statId: number | undefined, skillId: number, d: StatParamData): number[] {
  const layers = statId === undefined ? undefined : d.knownLayers.get(statId);
  return (layers ?? []).flatMap((layer) => {
    const decoded = decodeSkillLevelLayer(layer);
    return decoded?.skill === skillId ? [decoded.level] : [];
  });
}

/**
 * "Any known level": one check per level the game data puts on items for the skill, each with that exact param and
 * the check's op and value; empty when the skill has no known level.
 */
export function anyKnownLevelChecks(check: StatCheck, statId: number | undefined, skillId: number, d: StatParamData): StatCheck[] {
  return knownLevels(statId, skillId, d).flatMap((level) => {
    const param = skillLevelLayer(skillId, level);
    return param === undefined ? [] : [{ ...check, param }];
  });
}

const ON_ITEMS = 'On items';
const OTHER_SKILLS = 'Other skills';

// Skill lists per data object and stat (752 options each; rebuilt only when the bundles change).
const skillOptionCache = new WeakMap<StatParamData, Map<string, PickerOption[]>>();

/**
 * The skills for a skill, event or charged stat: value = the skill id.
 * - Event and charged stats: "On items" first (the skills the game data puts on items for that stat, with their known
 *   levels), then the class skills by class, then "Other skills".
 * - Skill stats: the game data puts nearly every class skill on items for them (all 280 for `item_singleskill`), so the
 *   class skills stay grouped by class with "on items" in the detail; only the other skills are split into "On items"
 *   and "Other skills". `item_singleskill` (+N to one class skill) lists only class skills besides the known ones.
 */
export function skillOptions(statId: number | undefined, kind: StatLayerKind, d: StatParamData): PickerOption[] {
  const cacheKey = `${String(statId)}|${kind}`;
  const cache = skillOptionCache.get(d) ?? new Map<string, PickerOption[]>();
  skillOptionCache.set(d, cache);
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const known = new Set(knownSkills(statId, kind, d));
  const classOnly = statId !== undefined && d.names.get(statId) === 'item_singleskill';
  const classIndex = (skill: LootFilterSkill) => (skill.cls === undefined ? CLASS_CODES.length : CLASS_CODES.indexOf(skill.cls));
  const option = (skill: LootFilterSkill, group: string): PickerOption => {
    const value = String(skill.id);
    const cls = className(skill.cls, d);
    const levels = kind === 'event' || kind === 'charged' ? knownLevels(statId, skill.id, d) : [];
    const onItems = kind === 'skill' && known.has(skill.id) && skill.cls !== undefined ? 'on items' : undefined;
    const detail = [`#${value}`, cls, levels.length > 0 ? `lvl ${levels.join(', ')}` : undefined, onItems].filter(
      (part) => part !== undefined
    );
    return { key: value, value, label: skill.name, detail: detail.join(' · '), group, search: searchText(skill.name, skill.id, cls) };
  };
  const byName = (a: LootFilterSkill, b: LootFilterSkill) => a.name.localeCompare(b.name) || a.id - b.id;
  const skills = [...d.skills.values()];
  const byClass = (a: LootFilterSkill, b: LootFilterSkill) => classIndex(a) - classIndex(b) || byName(a, b);
  const groupOf = (skill: LootFilterSkill) => className(skill.cls, d) ?? OTHER_SKILLS;
  const listed = skills.filter((skill) => known.has(skill.id) || !classOnly || skill.cls !== undefined);
  const options =
    kind === 'skill'
      ? [
          ...listed.filter((skill) => skill.cls !== undefined).sort(byClass),
          ...listed.filter((skill) => skill.cls === undefined && known.has(skill.id)).sort(byName),
          ...listed.filter((skill) => skill.cls === undefined && !known.has(skill.id)).sort(byName),
        ].map((skill) => option(skill, skill.cls === undefined && known.has(skill.id) ? ON_ITEMS : groupOf(skill)))
      : [
          ...listed
            .filter((skill) => known.has(skill.id))
            .sort(byName)
            .map((skill) => option(skill, ON_ITEMS)),
          ...listed
            .filter((skill) => !known.has(skill.id))
            .sort(byClass)
            .map((skill) => option(skill, groupOf(skill))),
        ];
  cache.set(cacheKey, options);
  return options;
}
