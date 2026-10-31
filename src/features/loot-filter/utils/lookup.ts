/** Name lookups and picker options built from the `lootfilter` and `types` game-data bundles. */
import type { ItemTypeInfo, LootFilterDataBundle, LootFilterItem, TypesBundle } from '@/features/game-data/engine/schema';
import { searchText, type PickerOption } from './pickerSearch';
import { buildStatParamData, statParamKind, statParamLabel, type StatParamData } from './statParams';

/** Game-data names for codes and ids; every lookup returns `undefined` when the data is missing or the key unknown. */
export interface LootFilterLookup {
  readonly item: (code: string) => LootFilterItem | undefined;
  readonly itemName: (code: string) => string | undefined;
  readonly itemType: (code: string) => ItemTypeInfo | undefined;
  readonly typeName: (code: string) => string | undefined;
  /** The stat's itemstatcost name for an id, or the name itself when it is a known stat name. */
  readonly statName: (stat: string | number) => string | undefined;
  /** The stat's id for a name, or the id itself when it is a known id. */
  readonly statId: (stat: string | number) => number | undefined;
  /** itemstatcost name → id (the evaluator's context takes it as is); empty without the data. */
  readonly statIds: ReadonlyMap<string, number>;
  /** The param's name for a layered stat (`item_addskill_tab` 50 → "Martial Arts (Assassin)"); see `statParamLabel`. */
  readonly statParamLabel: (stat: string | number, param: number) => string | undefined;
  readonly areaName: (id: number) => string | undefined;
  /** The unique's and/or the set item's name for the row id ("Unique / Set" when both tables have that row). */
  readonly uniqueOrSetName: (id: number) => string | undefined;
}

const none = (): undefined => undefined;

export const EMPTY_LOOKUP: LootFilterLookup = {
  item: none,
  itemName: none,
  itemType: none,
  typeName: none,
  statName: none,
  statId: none,
  statIds: new Map(),
  statParamLabel: none,
  areaName: none,
  uniqueOrSetName: none,
};

export function buildLookup(
  data: LootFilterDataBundle,
  types: TypesBundle,
  params: StatParamData = buildStatParamData(data, types)
): LootFilterLookup {
  const items = new Map(data.items.map((item) => [item.code, item]));
  const itemTypes = new Map(types.types.map((type) => [type.code, type]));
  const statById = new Map(data.stats.map((stat) => [stat.id, stat.name]));
  const statByName = new Map(data.stats.filter((stat) => stat.name !== '').map((stat) => [stat.name, stat.id]));
  const areas = new Map(data.areas.map((area) => [area.id, area.name]));
  const uniques = new Map(data.uniques.map((entry) => [entry.id, entry.name]));
  const sets = new Map(data.sets.map((entry) => [entry.id, entry.name]));
  return {
    item: (code) => items.get(code),
    itemName: (code) => items.get(code)?.name,
    itemType: (code) => itemTypes.get(code),
    typeName: (code) => itemTypes.get(code)?.name,
    statName: (stat) => {
      if (typeof stat === 'number') return statById.get(stat) || undefined;
      return statByName.has(stat) ? stat : undefined;
    },
    statId: (stat) => {
      if (typeof stat === 'number') return statById.has(stat) ? stat : undefined;
      return statByName.get(stat);
    },
    statIds: statByName,
    statParamLabel: (stat, param) => {
      const kind = statParamKind(stat, params);
      return kind === undefined ? undefined : statParamLabel(kind, param, params);
    },
    areaName: (id) => areas.get(id),
    uniqueOrSetName: (id) => {
      const names = [uniques.get(id), sets.get(id)].filter((name) => name !== undefined && name !== '');
      return names.length === 0 ? undefined : names.join(' / ');
    },
  };
}

/** Picker options for every list the rule editor offers. */
export interface LootFilterPickerOptions {
  readonly items: readonly PickerOption[];
  readonly types: readonly PickerOption[];
  readonly stats: readonly PickerOption[];
  readonly areas: readonly PickerOption[];
  readonly uniquesAndSets: readonly PickerOption[];
}

export const EMPTY_PICKER_OPTIONS: LootFilterPickerOptions = { items: [], types: [], stats: [], areas: [], uniquesAndSets: [] };

/**
 * Whether an item option is greyed out, with its short hint and its tooltip. Weapons and armor that are not spawnable
 * are shadow bases; misc items are muted only when they never drop (non-spawnable ones a treasure class names drop like
 * any other).
 */
export function itemMutedState(item: LootFilterItem): { muted: boolean; hint?: string; title?: string } {
  if (item.kind === 'misc') {
    return item.drops
      ? { muted: false }
      : { muted: true, hint: 'never drops', title: 'Never drops: no treasure class names it (cube results, quest items, unused rows)' };
  }
  return item.spawnable
    ? { muted: false }
    : { muted: true, hint: 'shadow base', title: 'Shadow base: not spawnable; exists only as a unique’s base or as a cube result' };
}

/**
 * Ancestor types left out of an item option's type search. ESR's itemtypes.txt names the mercenary-equipment umbrella
 * type `merc` "Helm" and makes it a parent of gloves, boots, belts and more, so searching "helm" would list them all.
 */
const TYPES_NOT_SEARCHED: ReadonlySet<string> = new Set(['merc']);

export function buildPickerOptions(data: LootFilterDataBundle, types: TypesBundle): LootFilterPickerOptions {
  const itemName = new Map(data.items.map((item) => [item.code, item.name]));
  const typeName = new Map(types.types.map((type) => [type.code, type.name]));
  const typeAncestors = new Map(types.types.map((type) => [type.code, type.ancestors]));
  /** Names and codes of every type the item counts as (`type` and `type2` with their ancestors). */
  const itemTypeSearch = (item: LootFilterItem): string => {
    const codes = new Set(
      [item.type, item.type2].flatMap((code) => (code === undefined || code === '' ? [] : (typeAncestors.get(code) ?? [code])))
    );
    return searchText(...[...codes].filter((code) => !TYPES_NOT_SEARCHED.has(code)).flatMap((code) => [typeName.get(code), code]));
  };
  const uniqueOrSet = (kind: 'Unique' | 'Set', entry: LootFilterDataBundle['uniques'][number]): PickerOption => {
    const base = itemName.get(entry.code) ?? entry.code;
    return {
      key: `${kind}:${String(entry.id)}`,
      value: String(entry.id),
      label: entry.name === '' ? `${kind} row ${String(entry.id)}` : entry.name,
      detail: `${base} · ${String(entry.id)}`,
      group: kind === 'Unique' ? 'Uniques' : 'Sets',
      search: searchText(entry.name, entry.id, base, entry.code),
    };
  };
  // Unmuted items sharing a display name (Ko Rune r19 / r68) get their code in the label; a muted twin (shadow base
  // p01 of Hand Axe, the unused Fu Rune r48) is told apart by its hint instead
  const nameCounts = new Map<string, number>();
  for (const item of data.items) {
    if (item.name !== '' && !itemMutedState(item).muted) nameCounts.set(item.name, (nameCounts.get(item.name) ?? 0) + 1);
  }
  const itemLabel = (item: LootFilterItem): string => {
    if (item.name === '') return item.code;
    return !itemMutedState(item).muted && (nameCounts.get(item.name) ?? 0) > 1 ? `${item.name} (${item.code})` : item.name;
  };
  return {
    items: data.items.map((item) => {
      const { muted, hint } = itemMutedState(item);
      return {
        key: item.code,
        value: item.code,
        label: itemLabel(item),
        detail: [item.code, typeName.get(item.type)].filter((part) => part !== undefined && part !== '').join(' · '),
        muted,
        hint,
        search: searchText(item.name, item.code),
        searchMore: itemTypeSearch(item),
      };
    }),
    types: types.types.map((type) => ({
      key: type.code,
      value: type.code,
      label: type.name === '' ? type.code : type.name,
      detail:
        type.parents.length === 0
          ? type.code
          : `${type.code} · in ${type.parents.map((parent) => typeName.get(parent) ?? parent).join(', ')}`,
      search: searchText(type.name, type.code),
    })),
    stats: data.stats
      .filter((stat) => stat.name !== '')
      .map((stat) => ({
        key: stat.name,
        value: stat.name,
        label: stat.name,
        detail: String(stat.id),
        search: searchText(stat.name, stat.id),
      })),
    areas: [...data.areas]
      .sort((a, b) => a.act - b.act || a.id - b.id)
      .map((area) => ({
        key: String(area.id),
        value: String(area.id),
        label: area.name === '' ? `Area ${String(area.id)}` : area.name,
        detail: String(area.id),
        group: `Act ${String(area.act + 1)}`,
        search: searchText(area.name, area.id),
      })),
    uniquesAndSets: [...data.uniques.map((entry) => uniqueOrSet('Unique', entry)), ...data.sets.map((entry) => uniqueOrSet('Set', entry))],
  };
}
