/**
 * Names for the params ("layers") of the skill, skill tab, class, event and charged stats (`stat: 188, param: 50` =
 * +skills to Assassin Martial Arts), from lootfilter.json `skills` / `knownLayers` and types.json `classes`. The
 * encodings are in `game-data/engine/statLayers.ts`; the loot filter does not load skills.json.
 */
import type { ClassInfo, LootFilterDataBundle, LootFilterSkill, TypesBundle } from '@/features/game-data/engine/schema';
import { CLASS_CODES } from '@/features/game-data/engine/schema';
import { decodeSkillLevelLayer, decodeTabLayer, statLayerKind, type StatLayerKind } from '@/features/game-data/engine/statLayers';

export interface StatParamData {
  /** Layer kind of each layered stat, by itemstatcost id */
  readonly kinds: ReadonlyMap<number, StatLayerKind>;
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
  skills: new Map(),
  duplicateNames: new Set(),
  classes: [],
  knownLayers: new Map(),
};

export function buildStatParamData(data: LootFilterDataBundle, types: TypesBundle): StatParamData {
  const kinds = new Map<number, StatLayerKind>();
  for (const stat of data.stats) {
    const kind = statLayerKind(stat.name);
    if (kind !== undefined) kinds.set(stat.id, kind);
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
