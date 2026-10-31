import { BASE_TIER_LABELS } from '@/features/game-data/constants/bases';
import type {
  BaseItem,
  BasesBundle,
  ItemTypeInfo,
  LootFilterDataBundle,
  LootFilterItem,
  LootFilterUniqueOrSet,
  TiersBundle,
  TypesBundle,
} from '@/features/game-data/engine/schema';
import { buildTypeGroups } from '@/features/game-data/utils/typeGroups';
import { isNamedList, namedToNumber } from '../engine/match';
import { QUALITIES, type NamedMatch, type QualityName } from '../engine/types';
import {
  displayCodes,
  type BaseTier,
  type BrowserColumn,
  type BrowserGroup,
  type BrowserItem,
  type BrowserModel,
  type BrowserType,
} from './browserModel';

/**
 * The unique and set browser: the Uniques tab by the base's type group and item type, with the uniques on tiered bases
 * side by side as Normal | Exceptional | Elite columns and the mythical ones below; the Sets tab with one block per set.
 * Rows with the same name and base are one cell (Ember of Creation: 230 rows on one base); the selection holds row ids
 * as strings. Unique and set item ids share one id space (a rule's `uniqueOrSetIds` matches either table), so both tabs
 * edit one selection and `ambiguousIds` lists the ticked ids both tables have. Coupon uniques (cubed from Ancient
 * Coupons, never dropped) are not listed; like any id the browser does not list, a filter's coupon id survives Apply.
 */

export const DISABLED_HINT = 'disabled in the game files';

const tierColumn = (tier: BaseTier): BrowserColumn => ({ key: tier, label: BASE_TIER_LABELS[tier], tier });

const TIER_COLUMN: Readonly<Record<BaseTier, BrowserColumn>> = {
  normal: tierColumn('normal'),
  exceptional: tierColumn('exceptional'),
  elite: tierColumn('elite'),
  mythical: tierColumn('mythical'),
};

const GRID_TIERS = ['normal', 'exceptional', 'elite'] as const;
const GRID_COLUMNS: readonly BrowserColumn[] = GRID_TIERS.map((tier) => TIER_COLUMN[tier]);

/** The group of uniques on misc bases that no base type group lists (Ore, stones). */
export const MISC_GROUP = 'Misc';

/** An id both tables have: a unique and a set item a rule cannot tell apart without a quality. */
export interface SharedId {
  readonly id: string;
  readonly unique: string;
  readonly set: string;
}

export interface UniqueBrowserModel {
  readonly uniques: BrowserModel;
  readonly sets: BrowserModel;
  /** Every id the browser lists (uniques, then sets, each id once). */
  readonly codes: readonly string[];
  /** The ids in both tables, with the unique's and the set item's names. */
  readonly shared: ReadonlyMap<string, SharedId>;
  /** How many coupon uniques the Uniques tab leaves out. */
  readonly couponCount: number;
}

// --- Cells ---

/** Rows of one table with the same name, base and disabled flag, in first-row order. */
interface Merged {
  readonly name: string;
  readonly code: string;
  readonly disabled: boolean;
  readonly ids: number[];
  readonly reqLvls: number[];
  readonly set: string | undefined;
}

function mergeRows(entries: readonly LootFilterUniqueOrSet[]): Merged[] {
  const byKey = new Map<string, Merged>();
  for (const entry of entries) {
    const disabled = entry.disabled === true;
    const key = [entry.name, entry.code, String(disabled), entry.set ?? ''].join('\u0000');
    const merged = byKey.get(key) ?? { name: entry.name, code: entry.code, disabled, ids: [], reqLvls: [], set: entry.set };
    merged.ids.push(entry.id);
    merged.reqLvls.push(entry.reqLvl);
    byKey.set(key, merged);
  }
  return [...byKey.values()];
}

/** "674–689", "1, 3–5": ascending ids as runs. */
export function formatIdRuns(ids: readonly number[]): string {
  const runs: [number, number][] = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last !== undefined && id === last[1] + 1) last[1] = id;
    else runs.push([id, id]);
  }
  return runs.map(([start, end]) => (start === end ? String(start) : `${String(start)}–${String(end)}`)).join(', ');
}

const minLvl = (merged: Merged) => Math.min(...merged.reqLvls);

function levelText(reqLvls: readonly number[]): string {
  const low = Math.min(...reqLvls);
  const high = Math.max(...reqLvls);
  return low === high ? `Lvl ${String(low)}` : `Lvl ${String(low)}–${String(high)}`;
}

const byLevel = (a: Merged, b: Merged) => minLvl(a) - minLvl(b) || a.name.localeCompare(b.name) || (a.ids[0] ?? 0) - (b.ids[0] ?? 0);

interface CellContext {
  readonly kind: 'Unique' | 'Set';
  readonly item: LootFilterItem | undefined;
  readonly column: BrowserColumn | null;
  /** Type, group and set labels the search matches. */
  readonly labels: readonly string[];
}

function toCell(merged: Merged, { kind, item, column, labels }: CellContext): BrowserItem {
  const baseName = item?.name ?? merged.code;
  const ids = merged.ids.map(String);
  const idText = merged.ids.length === 1 ? `#${ids[0] ?? ''}` : `${String(merged.ids.length)} rows #${formatIdRuns(merged.ids)}`;
  return {
    code: `${kind}:${ids[0] ?? ''}`,
    codes: ids,
    tag: merged.code,
    name: merged.name === '' ? `${kind} row ${ids[0] ?? ''}` : merged.name,
    column,
    stats: [baseName, levelText(merged.reqLvls), merged.ids.length > 10 ? `${String(merged.ids.length)} rows` : idText].join(' · '),
    title: merged.ids.length > 10 ? `Row ids ${formatIdRuns(merged.ids)}` : undefined,
    ...(merged.disabled ? { disabled: DISABLED_HINT } : {}),
    search: [merged.name, baseName, merged.code, merged.set ?? '', ...labels, ...ids].join(' ').toLowerCase(),
  };
}

function emptyType(code: string, name: string): BrowserType {
  return { code, name, layout: 'list', columns: [], rows: [], extras: [], extrasColumn: null, items: [] };
}

// --- Uniques ---

/** The base tier the browser files a unique under: weapons/armor by tiers.json, accessories by bases.json. */
type TierOf = (code: string) => BaseTier | undefined;

interface TypeSlot {
  readonly group: string;
  readonly order: number;
}

/**
 * Where each base type goes: the group `buildTypeGroups` (the Bases tab's groups) lists it in, else the group of its
 * nearest listed ancestor (Odd Charm → Grand Charm), else by kind and class (Misc for misc types such as Ore).
 */
function typeSlots(bases: readonly BaseItem[], types: readonly ItemTypeInfo[]) {
  const typeByCode = new Map(types.map((type) => [type.code, type]));
  const groups = buildTypeGroups(bases, types);
  const labels = [...groups.map((group) => group.label)];
  const slots = new Map<string, TypeSlot>();
  groups.forEach((group, groupIndex) => {
    group.types.forEach((type, typeIndex) => {
      if (!slots.has(type.code)) slots.set(type.code, { group: group.label, order: groupIndex * 1000 + typeIndex });
    });
  });
  const fallback = (kind: LootFilterItem['kind'], typeCode: string): string => {
    const cls = typeByCode.get(typeCode)?.cls ?? null;
    if (kind === 'weapon') return cls === null ? 'Weapons' : 'Class weapons';
    if (kind === 'armor') return cls === null ? 'Armor' : 'Class armor';
    return MISC_GROUP;
  };
  return (kind: LootFilterItem['kind'], typeCode: string): TypeSlot => {
    const own = slots.get(typeCode);
    if (own !== undefined) return own;
    const ancestor = (typeByCode.get(typeCode)?.ancestors ?? []).map((code) => slots.get(code)).find((slot) => slot !== undefined);
    const group = ancestor?.group ?? fallback(kind, typeCode);
    if (!labels.includes(group)) labels.push(group);
    // Unlisted types follow the group's listed ones (sorted by name later).
    return { group, order: labels.indexOf(group) * 1000 + 999 };
  };
}

interface TypeDraft {
  readonly code: string;
  readonly kind: LootFilterItem['kind'];
  readonly slot: TypeSlot;
  readonly cells: { merged: Merged; item: LootFilterItem | undefined; tier: BaseTier | undefined }[];
}

function buildUniqueTabs(
  uniques: readonly LootFilterUniqueOrSet[],
  items: ReadonlyMap<string, LootFilterItem>,
  types: readonly ItemTypeInfo[],
  bases: readonly BaseItem[],
  tierOf: TierOf
): BrowserModel {
  const typeByCode = new Map(types.map((type) => [type.code, type]));
  const typeName = (code: string) => typeByCode.get(code)?.name ?? code;
  const slotOf = typeSlots(bases, types);

  const drafts = new Map<string, TypeDraft>();
  for (const merged of mergeRows(uniques)) {
    const item = items.get(merged.code);
    const typeCode = item?.type ?? '';
    const kind = item?.kind ?? 'misc';
    const draft = drafts.get(typeCode) ?? { code: typeCode, kind, slot: slotOf(kind, typeCode), cells: [] };
    drafts.set(typeCode, draft);
    draft.cells.push({ merged, item, tier: tierOf(merged.code) });
  }

  const ordered = [...drafts.values()].sort((a, b) => a.slot.order - b.slot.order || typeName(a.code).localeCompare(typeName(b.code)));
  const groups: BrowserGroup[] = [];
  const codes: string[] = [];
  for (const draft of ordered) {
    const browserType = buildUniqueType(draft, typeName(draft.code), draft.slot.group);
    codes.push(...displayCodes(browserType));
    const group = groups.find((candidate) => candidate.label === draft.slot.group);
    if (group === undefined) groups.push({ label: draft.slot.group, types: [browserType] });
    else groups[groups.indexOf(group)] = { ...group, types: [...group.types, browserType] };
  }
  return { groups, codes };
}

/**
 * A type block: weapons and armor on normal / exceptional / elite bases in tier columns (by required level), mythical
 * bases below them; a type without tiered bases (rings, charms, arrows) is a list, mythical rings with their badge.
 */
function buildUniqueType(draft: TypeDraft, name: string, groupLabel: string): BrowserType {
  const labels = [name, draft.code, groupLabel];
  const sorted = [...draft.cells].sort((a, b) => byLevel(a.merged, b.merged));
  const gridTier = (tier: BaseTier | undefined) => (draft.kind !== 'misc' && tier !== undefined && tier !== 'mythical' ? tier : undefined);
  const cell = (entry: (typeof sorted)[number], column: BrowserColumn | null) =>
    toCell(entry.merged, { kind: 'Unique', item: entry.item, column, labels: [...labels, column?.label ?? ''] });
  const base = emptyType(draft.code, name);

  if (!sorted.some((entry) => gridTier(entry.tier) !== undefined)) {
    // A list: a mythical accessory keeps its badge (its column), plain ones show none.
    return { ...base, items: sorted.map((entry) => cell(entry, entry.tier === undefined ? null : TIER_COLUMN[entry.tier])) };
  }
  const items = sorted.flatMap((entry) => {
    const tier = gridTier(entry.tier);
    return tier === undefined ? [] : [cell(entry, TIER_COLUMN[tier])];
  });
  const rest = sorted.filter((entry) => gridTier(entry.tier) === undefined);
  const mythical = rest.filter((entry) => entry.tier === 'mythical');
  const tierless = rest.filter((entry) => entry.tier !== 'mythical');
  return {
    ...base,
    layout: 'columns',
    columns: GRID_COLUMNS,
    items,
    extras: [...mythical.map((entry) => cell(entry, TIER_COLUMN.mythical)), ...tierless.map((entry) => cell(entry, null))],
    extrasColumn: mythical.length > 0 && tierless.length === 0 ? TIER_COLUMN.mythical : null,
  };
}

// --- Sets ---

/** One block per set (by the lowest required level of its items, then name), its items in table order. */
function buildSetTab(sets: readonly LootFilterUniqueOrSet[], items: ReadonlyMap<string, LootFilterItem>, tierOf: TierOf): BrowserModel {
  const bySet = new Map<string, Merged[]>();
  for (const merged of mergeRows(sets)) {
    const key = merged.set ?? '';
    bySet.set(key, [...(bySet.get(key) ?? []), merged]);
  }
  const ordered = [...bySet].sort(
    ([nameA, a], [nameB, b]) => Math.min(...a.map(minLvl)) - Math.min(...b.map(minLvl)) || nameA.localeCompare(nameB)
  );
  const types = ordered.map(([setName, members]): BrowserType => {
    const label = setName === '' ? 'No set' : setName;
    return {
      ...emptyType(`set:${setName}`, label),
      tag: '',
      items: members.map((merged) => {
        const tier = tierOf(merged.code);
        return toCell(merged, {
          kind: 'Set',
          item: items.get(merged.code),
          column: tier === undefined ? null : TIER_COLUMN[tier],
          labels: [label],
        });
      }),
    };
  });
  const groups: BrowserGroup[] = types.length === 0 ? [] : [{ label: 'Sets', types }];
  return { groups, codes: types.flatMap((type) => displayCodes(type)) };
}

// --- Model ---

export function buildUniqueBrowserModel(
  lootfilter: Pick<LootFilterDataBundle, 'items' | 'uniques' | 'sets'>,
  types: readonly ItemTypeInfo[],
  bases: readonly BaseItem[],
  tiers: Readonly<Record<string, BaseTier>>
): UniqueBrowserModel {
  const items = new Map(lootfilter.items.map((item) => [item.code, item]));
  // tiers.json covers every weapon and armor row (shadow bases too; arrows have none); bases.json adds the mythical
  // accessories, its other misc bases are all "normal" (no tier family).
  const mythicalBases = new Set(bases.filter((base) => base.tier === 'mythical').map((base) => base.code));
  const tierOf: TierOf = (code) => tiers[code] ?? (mythicalBases.has(code) ? 'mythical' : undefined);
  const listedUniques = lootfilter.uniques.filter((entry) => entry.coupon !== true);
  const uniques = buildUniqueTabs(listedUniques, items, types, bases, tierOf);
  const sets = buildSetTab(lootfilter.sets, items, tierOf);

  // Every unique, coupon ones too: a set item's id still matches the coupon unique with that id.
  const uniqueNames = new Map(lootfilter.uniques.map((entry) => [String(entry.id), entry.name]));
  const shared = new Map<string, SharedId>();
  for (const entry of lootfilter.sets) {
    const id = String(entry.id);
    const unique = uniqueNames.get(id);
    if (unique !== undefined) shared.set(id, { id, unique, set: entry.name });
  }
  return {
    uniques,
    sets,
    codes: [...new Set([...uniques.codes, ...sets.codes])],
    shared,
    couponCount: lootfilter.uniques.length - listedUniques.length,
  };
}

// --- The shared id space ---

function qualityMatches(match: NamedMatch<QualityName>, quality: number): boolean {
  const toNumber = (value: QualityName | number) => namedToNumber(value, QUALITIES, 1);
  if (typeof match === 'string' || typeof match === 'number') return toNumber(match) === quality;
  if (isNamedList(match)) return match.some((value) => toNumber(value) === quality);
  const min = match.min === undefined ? undefined : toNumber(match.min);
  const max = match.max === undefined ? undefined : toNumber(match.max);
  if ((match.min !== undefined && min === undefined) || (match.max !== undefined && max === undefined)) return false;
  return (min === undefined || quality >= min) && (max === undefined || quality <= max);
}

const SET_QUALITY = QUALITIES.indexOf('set') + 1;
const UNIQUE_QUALITY = QUALITIES.indexOf('unique') + 1;

/** Whether the rule's quality condition lets through set items or uniques, not both (then an id names one row). */
export function qualityTellsApart(quality: NamedMatch<QualityName> | undefined): boolean {
  return quality !== undefined && qualityMatches(quality, SET_QUALITY) !== qualityMatches(quality, UNIQUE_QUALITY);
}

/** The selected ids that are both a unique and a set item, by id, unless the rule's quality tells them apart. */
export function ambiguousIds(
  selected: ReadonlySet<string>,
  shared: ReadonlyMap<string, SharedId>,
  quality: NamedMatch<QualityName> | undefined
): SharedId[] {
  if (qualityTellsApart(quality)) return [];
  return [...selected]
    .flatMap((id) => {
      const entry = shared.get(id);
      return entry === undefined ? [] : [entry];
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

// One model per loaded bundle set (the bundles are cached for the page's lifetime).
let cached: {
  lootfilter: LootFilterDataBundle;
  types: TypesBundle;
  bases: BasesBundle;
  tiers: TiersBundle;
  model: UniqueBrowserModel;
} | null = null;

export function getUniqueBrowserModel(
  lootfilter: LootFilterDataBundle,
  types: TypesBundle,
  bases: BasesBundle,
  tiers: TiersBundle
): UniqueBrowserModel {
  if (cached?.lootfilter !== lootfilter || cached.types !== types || cached.bases !== bases || cached.tiers !== tiers) {
    cached = { lootfilter, types, bases, tiers, model: buildUniqueBrowserModel(lootfilter, types.types, bases.bases, tiers.codes) };
  }
  return cached.model;
}
