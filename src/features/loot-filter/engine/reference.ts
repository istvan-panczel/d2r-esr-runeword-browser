import { CLASS_CODES, type LootFilterDataBundle, type TypesBundle } from '../../game-data/engine/schema.ts';
import { tabLayer } from '../../game-data/engine/statLayers.ts';
import type { LootFilterReference } from './types.ts';

/** Reference for validating without game data (every lookup fails, no sound rows). */
export const EMPTY_LOOT_FILTER_REFERENCE: LootFilterReference = {
  itemCodes: new Set(),
  itemTypes: new Set(),
  statNames: new Set(),
  statIds: new Set(),
  statNamesById: new Map(),
  skillTabNames: new Map(),
  areaIds: new Set(),
  soundNames: new Set(),
  soundRowCount: 0,
  uniqueOrSetIds: new Set(),
  itemCodeTypes: new Map(),
  typeAncestors: new Map(),
};

/** Item code → the union of the ancestors of its `type` and `type2`; a type types.json lacks counts as itself only. */
function buildItemCodeTypes(
  data: LootFilterDataBundle,
  typeAncestors: ReadonlyMap<string, ReadonlySet<string>>
): Map<string, ReadonlySet<string>> {
  const ancestorsOf = (type: string): readonly string[] => [...(typeAncestors.get(type) ?? [type])];
  return new Map(
    data.items.map((item) => [
      item.code,
      new Set([...ancestorsOf(item.type), ...(item.type2 === undefined ? [] : ancestorsOf(item.type2))]),
    ])
  );
}

/** Skill tab layer → "Assassin Martial Arts" for every class of types.json. */
function buildSkillTabNames(types: TypesBundle): Map<number, string> {
  const names = new Map<number, string>();
  for (const info of types.classes) {
    info.tabs.forEach((tab, index) => {
      const layer = tabLayer(CLASS_CODES.indexOf(info.code), index);
      if (layer !== undefined) names.set(layer, `${info.name} ${tab}`);
    });
  }
  return names;
}

/** Validator lookups from lootfilter.json and types.json. */
export function buildLootFilterReference(data: LootFilterDataBundle, types: TypesBundle): LootFilterReference {
  const typeAncestors = new Map(types.types.map((type) => [type.code, new Set([type.code, ...type.ancestors])]));
  return {
    itemCodes: new Set(data.items.map((item) => item.code)),
    itemTypes: new Set(types.types.map((type) => type.code)),
    statNames: new Set(data.stats.map((stat) => stat.name).filter((name) => name !== '')),
    statIds: new Set(data.stats.map((stat) => stat.id)),
    statNamesById: new Map(data.stats.filter((stat) => stat.name !== '').map((stat) => [stat.id, stat.name])),
    skillTabNames: buildSkillTabNames(types),
    areaIds: new Set(data.areas.map((area) => area.id)),
    soundNames: new Set(data.sounds.filter((name) => name !== '')),
    soundRowCount: data.sounds.length,
    uniqueOrSetIds: new Set([...data.uniques.map((entry) => entry.id), ...data.sets.map((entry) => entry.id)]),
    itemCodeTypes: buildItemCodeTypes(data, typeAncestors),
    typeAncestors,
  };
}
