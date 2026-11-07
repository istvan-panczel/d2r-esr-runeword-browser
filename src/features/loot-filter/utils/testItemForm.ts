/**
 * The Test tab's form model: what the user describes (an item and where it drops) and its conversion into the
 * evaluator's `TestItem` and `TestContext`. Pure functions, so the conversions and presets are testable.
 */
import type { LootFilterDataBundle } from '@/features/game-data/engine/schema';
import type { ItemStatEntry, TestContext, TestItem } from '../engine/evaluate';
import { BASE_TIERS, type ItemLocation, type LootFilter } from '../engine/types';
import type { LootFilterLookup } from './lookup';

/** levels.txt ids of the five towns (Rogue Encampment, Lut Gholein, Kurast Docks, Pandemonium Fortress, Harrogath). */
export const TOWN_AREAS: readonly number[] = [1, 40, 75, 103, 109];

/** itemstatcost.txt `level`: the player level is sent as this player stat. */
export const PLAYER_LEVEL_STAT = 12;

export function isTown(area: number): boolean {
  return TOWN_AREAS.includes(area);
}

/** One stat row of the form; incomplete rows (no stat or no value) are left out of the item. */
export interface StatRow {
  /** Stable React key. */
  readonly key: number;
  /** An itemstatcost.txt name or id; undefined until picked. */
  readonly stat: string | number | undefined;
  readonly param: number | undefined;
  readonly value: number | undefined;
}

export type UniqueOrSetKind = 'unique' | 'set';

export interface UniqueOrSetPick {
  /** uniqueitems.txt / setitems.txt row id. */
  readonly id: number;
  /** Which table, when known (a typed id is ambiguous: the two tables share the id space). */
  readonly kind: UniqueOrSetKind | null;
}

export interface TestItemForm {
  readonly code: string;
  /** The game's name of the item (`{name}`). */
  readonly name: string;
  /** itemtypes.txt code of the item; filled from the game data, typed when it is not loaded. */
  readonly type: string;
  /** 1 (inferior) to 9 (tempered). */
  readonly quality: number;
  /** The user picked a quality, so picking a unique or set item no longer changes it. */
  readonly qualityTouched: boolean;
  /**
   * 0 (normal) to 2 (elite); null for an item without a tier family (rings, charms, jewels, mythical bases…). Filled
   * from the game data when an item is picked; the user may change it afterwards.
   */
  readonly baseTier: number | null;
  readonly itemLevel: number | undefined;
  readonly sockets: number | undefined;
  readonly maxSockets: number | undefined;
  readonly isEthereal: boolean;
  readonly isIdentified: boolean;
  readonly isRuneword: boolean;
  readonly isFullySocketed: boolean;
  readonly uniqueOrSet: UniqueOrSetPick | null;
  readonly stats: readonly StatRow[];
  readonly location: ItemLocation;
  /** 0 (normal) to 2 (hell). */
  readonly difficulty: number;
  /** levels.txt id. */
  readonly area: number;
  /** null = the filter's default level. */
  readonly filterLevel: number | null;
  readonly playerLevel: number | undefined;
  /** More player stats beside the level. */
  readonly playerStats: readonly StatRow[];
}

type ItemFields = Omit<TestItemForm, 'difficulty' | 'area' | 'filterLevel' | 'playerLevel' | 'playerStats'>;

let lastRowKey = 0;

/** A new, empty stat row (or one with the given stat and value). */
export function newStatRow(stat?: string | number, value?: number, param?: number): StatRow {
  lastRowKey += 1;
  return { key: lastRowKey, stat, param, value };
}

function defaultItemFields(): ItemFields {
  return {
    code: '',
    name: '',
    type: '',
    quality: 2,
    qualityTouched: false,
    baseTier: null,
    itemLevel: 1,
    sockets: 0,
    maxSockets: 0,
    isEthereal: false,
    isIdentified: true,
    isRuneword: false,
    isFullySocketed: false,
    uniqueOrSet: null,
    stats: [],
    location: 'onGround',
  };
}

/** An empty item in Rogue Encampment, normal difficulty, player level 1, at the filter's default level. */
export function defaultTestItem(): TestItemForm {
  return { ...defaultItemFields(), difficulty: 0, area: 1, filterLevel: null, playerLevel: 1, playerStats: [] };
}

/** The game data's base tier of a code (0 normal to 2 elite); null for an unknown code or one without a tier family. */
export function baseTierOf(code: string, lookup: LootFilterLookup): number | null {
  const tier = lookup.item(code)?.tier;
  return tier === undefined ? null : BASE_TIERS.indexOf(tier);
}

/** The picked item code with its name, type and base tier from the game data (the code itself when it is unknown). */
export function withItem(form: TestItemForm, code: string, lookup: LootFilterLookup): TestItemForm {
  const item = lookup.item(code);
  return {
    ...form,
    code,
    name: item === undefined || item.name === '' ? code : item.name,
    type: item?.type ?? (form.code === code ? form.type : ''),
    baseTier: baseTierOf(code, lookup),
  };
}

export function withQuality(form: TestItemForm, quality: number): TestItemForm {
  return { ...form, quality, qualityTouched: true };
}

const PICK_VALUE = /^(Unique|Set):(\d+)$/;

/** The picker value of a pick: the option key (`Unique:12`, `Set:12`), or the bare id when the table is unknown. */
export function uniqueOrSetValue(pick: UniqueOrSetPick | null): string | undefined {
  if (pick === null) return undefined;
  if (pick.kind === null) return String(pick.id);
  return `${pick.kind === 'unique' ? 'Unique' : 'Set'}:${String(pick.id)}`;
}

/** Reads a picker value back (`Unique:12`, `Set:12` or a typed `12`); null when it is neither. */
export function parseUniqueOrSetValue(value: string): UniqueOrSetPick | null {
  const match = PICK_VALUE.exec(value);
  if (match) return { id: Number(match[2]), kind: match[1] === 'Unique' ? 'unique' : 'set' };
  return /^\d+$/.test(value) ? { id: Number(value), kind: null } : null;
}

/**
 * Picks a unique or set item. With the game data the item becomes that unique's base (code, name and type) and
 * takes its name; unless the user chose a quality, the quality becomes unique or set.
 */
export function withUniqueOrSet(
  form: TestItemForm,
  pick: UniqueOrSetPick | null,
  bundle: LootFilterDataBundle | null,
  lookup: LootFilterLookup
): TestItemForm {
  if (pick === null) return { ...form, uniqueOrSet: null };
  const inUniques = bundle?.uniques.find((entry) => entry.id === pick.id);
  const inSets = bundle?.sets.find((entry) => entry.id === pick.id);
  const kind: UniqueOrSetKind | null = pick.kind ?? (inUniques ? 'unique' : inSets ? 'set' : null);
  const entry = kind === 'set' ? inSets : inUniques;
  let next: TestItemForm = { ...form, uniqueOrSet: { id: pick.id, kind } };
  if (entry !== undefined) {
    next = withItem(next, entry.code, lookup);
    if (entry.name !== '') next = { ...next, name: entry.name };
  }
  if (!form.qualityTouched) next = { ...next, quality: kind === 'set' ? 5 : 7 };
  return next;
}

/** A stat name or id as an id: numbers and digit strings as they are, names through the game data. */
function resolveStat(stat: string | number, statId: (name: string) => number | undefined): number | undefined {
  if (typeof stat === 'number') return stat;
  if (/^\d+$/.test(stat)) return Number(stat);
  return statId(stat);
}

/** The complete rows as stat entries; a row without stat, without value or with an unknown stat name is left out. */
export function statEntries(rows: readonly StatRow[], statId: (name: string) => number | undefined): readonly ItemStatEntry[] {
  return rows.flatMap((row) => {
    if (row.stat === undefined || row.stat === '' || row.value === undefined) return [];
    const stat = resolveStat(row.stat, statId);
    if (stat === undefined) return [];
    return [row.param === undefined ? { stat, value: row.value } : { stat, param: row.param, value: row.value }];
  });
}

/** The item's type code: the typed one, else the game data's type of the code. */
export function itemTypeOf(form: TestItemForm, lookup: LootFilterLookup): string {
  const typed = form.type.trim();
  return typed === '' ? (lookup.item(form.code.trim())?.type ?? '') : typed;
}

/**
 * The type codes item-type conditions see: the ancestors of the item's type and, while that type is the game data's
 * own, of its `type2` (the game treats such a base as both types); without the data only the typed type.
 */
export function typeAncestorsOf(form: TestItemForm, lookup: LootFilterLookup): readonly string[] {
  const type = itemTypeOf(form, lookup);
  if (type === '') return [];
  const item = lookup.item(form.code.trim());
  const second = item !== undefined && item.type === type ? item.type2 : undefined;
  const codes = second === undefined || second === '' ? [type] : [type, second];
  return [...new Set(codes.flatMap((code) => lookup.itemType(code)?.ancestors ?? [code]))];
}

/** The evaluator's item. Type ancestors come from the game data; without it only the item's own type is known. */
export function toTestItem(form: TestItemForm, lookup: LootFilterLookup): TestItem {
  const ancestors = typeAncestorsOf(form, lookup);
  return {
    code: form.code.trim(),
    typeAncestors: ancestors,
    quality: form.quality,
    baseTier: form.baseTier,
    itemLevel: form.itemLevel ?? 0,
    sockets: form.sockets ?? 0,
    maxSockets: form.maxSockets ?? 0,
    isFullySocketed: form.isFullySocketed,
    isEthereal: form.isEthereal,
    isIdentified: form.isIdentified,
    isRuneword: form.isRuneword,
    uniqueOrSetId: form.uniqueOrSet?.id ?? null,
    stats: statEntries(form.stats, (name) => lookup.statId(name)),
    name: form.name,
    location: form.location,
  };
}

/** The level the plugin starts at: `defaultLevel`, else the first level, else 1. */
export function defaultFilterLevel(filter: LootFilter): number {
  return filter.defaultLevel ?? filter.filterLevels?.[0]?.id ?? 1;
}

/** The evaluator's context: the player level as stat 12 first, then the extra player stats. */
export function toTestContext(form: TestItemForm, filter: LootFilter, lookup: LootFilterLookup): TestContext {
  return {
    playerStats: [
      { stat: PLAYER_LEVEL_STAT, value: form.playerLevel ?? 1 },
      ...statEntries(form.playerStats, (name) => lookup.statId(name)),
    ],
    difficulty: form.difficulty,
    area: form.area,
    filterLevel: form.filterLevel ?? defaultFilterLevel(filter),
    statIds: lookup.statIds,
    skillIds: lookup.skillIds,
  };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface TestPreset {
  readonly id: string;
  readonly label: string;
  /** The item fields it sets; name and type are fallbacks for when the game data is not loaded. */
  readonly item: Partial<ItemFields> & { readonly code: string; readonly name: string; readonly type: string };
  /** Stat rows (stat id, value) it adds. */
  readonly stats?: readonly (readonly [number, number])[];
  /** Keep the preset's own name even when the game data knows the code (gold shows its amount). */
  readonly keepName?: boolean;
}

export const TEST_PRESETS: readonly TestPreset[] = [
  { id: 'zod', label: 'Zod rune on the ground', item: { code: 'r83', name: 'Zod Rune', type: 'rune', quality: 2 } },
  {
    id: 'unique-bow',
    label: 'Unique bow, 2 sockets',
    item: { code: 'm01', name: 'Mythical Marksman Bow', type: 'bow', quality: 7, sockets: 2, maxSockets: 2, itemLevel: 85 },
  },
  {
    id: 'gold',
    label: 'Gold pile 1500',
    item: { code: 'gld', name: '1500 Gold', type: 'gold', quality: 2 },
    stats: [[14, 1500]],
    keepName: true,
  },
  { id: 'rare-ring', label: 'Rare ring', item: { code: 'rin', name: 'Ring', type: 'ring', quality: 6, itemLevel: 85 } },
];

/**
 * Replaces the item fields with the preset's (the context fields stay); a known code takes the game data's name, type and
 * base tier.
 */
export function applyPreset(form: TestItemForm, preset: TestPreset, lookup: LootFilterLookup): TestItemForm {
  const known = lookup.item(preset.item.code);
  return {
    ...form,
    ...defaultItemFields(),
    ...preset.item,
    name: preset.keepName === true || known === undefined || known.name === '' ? preset.item.name : known.name,
    type: known?.type ?? preset.item.type,
    baseTier: known === undefined ? (preset.item.baseTier ?? null) : baseTierOf(preset.item.code, lookup),
    qualityTouched: false,
    stats: (preset.stats ?? []).map(([stat, value]) => newStatRow(stat, value)),
  };
}
