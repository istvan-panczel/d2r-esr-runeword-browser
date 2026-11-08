/**
 * The bridge from a saved item to a build's item ref (docs/features/CHARACTER-SAVE.md "Start a build from a save").
 *
 * Quality first, then name + the txt row's base code: save ids are never compared across tables (all 270 set ids are
 * also unique ids) and never stored on a ref. The txt row gives the identity only: the slot and the base come from the
 * item itself, because an ESR cube recipe can leave a unique on another base (SpinToWin's Death's Grip on a belt).
 */
import type { Gemword, HtmUniqueItem, MythicalUnique, Runeword } from '@/core/db';
import { asRunewordBaseChoice, asSocketed, type EquipmentSlot, type ItemRef, type WeaponSwapSlot } from '@/features/builds/buildData';
import { freetextRef, gemwordToRef, mythicalToRef, runewordToRef, setItemToRef, uniqueToRef } from '@/features/builds/utils/buildSnapshot';
import { pickBestMatch } from '@/features/builds/utils/itemLookup';
import { findSetItem } from '@/features/builds/utils/setItems';
import { itemFitsSlot } from '@/features/builds/utils/slotFit';
import { htmRunewordId, matchRunewords, normalizeName, siteTypeLabel } from '@/features/game-data/engine/matchRunewords';
import type { SetsBundle, StashSetItemInfo, StashUniqueInfo, TxtRunewordsBundle } from '@/features/game-data/engine/schema';
import type { StashCatalog } from '@/features/stash/engine/catalog';
import { describeStashItem, type StashItemDescription, type StashItemKind } from '@/features/stash/engine/describeItem';
import { itemDisplayName } from '@/features/stash/engine/items/itemNames';
import { renderItemText, type ItemTextContext } from '@/features/stash/engine/items/itemText';
import type { CharacterItem } from '../parser/types';

/** What the draft needs besides the save: the stash lookups and the local item tables. Nothing here is written anywhere. */
export interface BuildDraftData {
  readonly catalog: StashCatalog;
  readonly text: ItemTextContext;
  readonly sets: SetsBundle;
  readonly txtRunewords: TxtRunewordsBundle;
  /** Item type code → display name (types.json) */
  readonly typeNames: ReadonlyMap<string, string>;
  /** The local (Dexie) tables, with their ids */
  readonly uniques: readonly HtmUniqueItem[];
  readonly mythicals: readonly MythicalUnique[];
  readonly runewords: readonly Runeword[];
  readonly gemwords: readonly Gemword[];
  readonly ascendancies: readonly string[];
  /** skills.txt `skill` by row (lootfilter.json `skillNames`): the skills.json id of a saved skill */
  readonly skillIds: readonly string[];
  /** skills.txt row → display name (itemtext.json `skills`) */
  readonly skillNames: ReadonlyMap<number, string>;
}

export type DraftItemKind = StashItemKind | 'mythical' | 'gemword' | 'quest';

/** `matched` and `check` are named refs (`check`: worth a look); `custom` is a free-text item on the fix list. */
export type DraftItemOutcome = 'matched' | 'check' | 'custom';

export interface DraftItemMatch {
  readonly ref: ItemRef;
  readonly kind: DraftItemKind;
  readonly outcome: DraftItemOutcome;
  /** Stored as the slot's note: a fact the build model can hold */
  readonly note: string | null;
  /** Why the row needs a look; null for a plain custom item */
  readonly message: string | null;
}

type Recipe = { readonly type: 'runeword'; readonly record: Runeword } | { readonly type: 'gemword'; readonly record: Gemword };

export interface DraftItemIndex {
  readonly uniques: ReadonlyMap<string, readonly HtmUniqueItem[]>;
  readonly mythicals: ReadonlyMap<string, readonly MythicalUnique[]>;
  /** runes.txt key → the HTM recipes behind it */
  readonly recipes: ReadonlyMap<string, readonly Recipe[]>;
  readonly gemwords: ReadonlyMap<string, readonly Gemword[]>;
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [item]);
    else list.push(item);
  }
  return groups;
}

/** The HTM mythical list spells the three Tathamet's Awakening rows "... (Fire Variant)"; the txt rows have no suffix. */
const withoutVariantSuffix = (name: string): string => name.replace(/\s*\([a-z]+ variant\)$/, '');

export function createDraftItemIndex(data: BuildDraftData): DraftItemIndex {
  const options = { typeNames: data.typeNames };
  const runewordMatches = matchRunewords(data.runewords, data.txtRunewords, options);
  const gemwordMatches = matchRunewords(data.gemwords, data.txtRunewords, options);
  const recipes = new Map<string, Recipe[]>();
  const add = (keys: readonly string[] | undefined, recipe: Recipe) => {
    for (const key of keys ?? []) recipes.set(key, [...(recipes.get(key) ?? []), recipe]);
  };
  for (const record of data.runewords) add(runewordMatches.byHtm.get(htmRunewordId(record))?.keys, { type: 'runeword', record });
  for (const record of data.gemwords) add(gemwordMatches.byHtm.get(htmRunewordId(record))?.keys, { type: 'gemword', record });
  return {
    uniques: groupBy(data.uniques, (item) => normalizeName(item.name)),
    mythicals: groupBy(data.mythicals, (item) => withoutVariantSuffix(normalizeName(item.name))),
    recipes,
    gemwords: groupBy(data.gemwords, (item) => normalizeName(item.name)),
  };
}

const LABELLED_KINDS: ReadonlySet<DraftItemKind> = new Set(['rare', 'crafted', 'tempered']);

/** A rare's name does not say what it is: "Havoc Finger (Ring)". A magic name already holds its base. */
function customName(item: CharacterItem, described: StashItemDescription, kind: DraftItemKind, data: BuildDraftData): string {
  const name = itemDisplayName(item, data.catalog, data.text, described);
  return LABELLED_KINDS.has(kind) && name !== described.baseName ? `${name} (${described.baseName})` : name;
}

function customMatch(item: CharacterItem, described: StashItemDescription, kind: DraftItemKind, data: BuildDraftData): DraftItemMatch {
  return { ref: freetextRef(customName(item, described, kind, data)), kind, outcome: 'custom', note: null, message: null };
}

/** The names of what sits in the sockets, cleaned for the ref's `socketed` (undefined when none). */
function fillerNames(children: readonly CharacterItem[], data: BuildDraftData): readonly string[] | undefined {
  return asSocketed(children.map((child) => itemDisplayName(child, data.catalog, data.text)));
}

const withSocketed = <T extends object>(ref: T, socketed: readonly string[] | undefined): T =>
  socketed === undefined ? ref : { ...ref, socketed };

/** The item's name and stats lines, for telling same-name variants apart. */
function itemLines(item: CharacterItem, data: BuildDraftData): string[] {
  const text = renderItemText(item, data.text);
  return [...text.stats, ...text.runeword];
}

interface Conversion {
  readonly note: string | null;
  readonly message: string | null;
}

/** The note and review message of an item whose own base is not the one its row lists. */
function conversionOf(item: CharacterItem, described: StashItemDescription, rowCode: string, rowBase: string): Conversion {
  if (item.code === rowCode) return { note: null, message: null };
  return { note: `On ${described.baseName}`, message: `Listed as ${rowBase}; in game on a ${described.baseName}` };
}

const stripMythicalPrefix = (name: string): string => name.replace(/^mythical /, '');
const CHECK_MESSAGE = 'Check this is the right one: several items in the data fit it';

function matchUnique(
  item: CharacterItem,
  info: StashUniqueInfo,
  described: StashItemDescription,
  index: DraftItemIndex,
  data: BuildDraftData
): DraftItemMatch | null {
  const name = normalizeName(info.name);
  const rowBase = data.catalog.base(info.code)?.name ?? info.code;
  const uniques = index.uniques.get(name) ?? [];
  const mythicals = index.mythicals.get(name) ?? [];
  const onBase = [
    ...uniques.filter((candidate) => candidate.baseItemCode === info.code),
    ...mythicals.filter(
      (candidate) => stripMythicalPrefix(normalizeName(candidate.baseItem)) === stripMythicalPrefix(normalizeName(rowBase))
    ),
  ];
  const pool = onBase.length > 0 ? onBase : [...uniques, ...mythicals];
  // A ties-only lookup: the item's own lines against the variants' (the category and level are unknown here on purpose)
  const chosen = pickBestMatch(pool, {
    name: info.name,
    baseItem: rowBase,
    category: '',
    reqLevel: 0,
    properties: itemLines(item, data),
    specialProperties: [],
  });
  if (chosen === null) return null;

  const socketed = fillerNames(item.socketed, data);
  const isMythical = !('baseItemCode' in chosen);
  const ref = isMythical ? mythicalToRef(chosen) : uniqueToRef(chosen);
  if (ref === null) return null;
  const conversion = conversionOf(item, described, info.code, rowBase);
  const messages = [conversion.message, pool.length > 1 ? CHECK_MESSAGE : null].filter((message) => message !== null);
  return {
    ref: withSocketed(ref, socketed),
    kind: isMythical ? 'mythical' : 'unique',
    outcome: messages.length > 0 ? 'check' : 'matched',
    note: conversion.note,
    message: messages.length > 0 ? messages.join('. ') : null,
  };
}

function matchSetItem(
  item: CharacterItem,
  info: StashSetItemInfo,
  described: StashItemDescription,
  data: BuildDraftData
): DraftItemMatch | null {
  const found = findSetItem(data.sets, info.name);
  if (found === null) return null;
  const conversion = conversionOf(item, described, info.code, data.catalog.base(info.code)?.name ?? info.code);
  return {
    ref: withSocketed(setItemToRef(found.item, found.set), fillerNames(item.socketed, data)),
    kind: 'set',
    outcome: conversion.message === null ? 'matched' : 'check',
    note: conversion.note,
    message: conversion.message,
  };
}

/** Narrow by the item's socket count, then to the recipes whose minimum sockets equal it. */
function bySockets(recipes: readonly Runeword[], sockets: number): readonly Runeword[] {
  const fitting = recipes.filter((recipe) => sockets >= recipe.sockets && sockets <= (recipe.socketsMax ?? recipe.sockets));
  const pool = fitting.length > 0 ? fitting : recipes;
  const exact = pool.filter((recipe) => recipe.sockets === sockets);
  return exact.length > 0 ? exact : pool;
}

function matchRuneword(
  item: CharacterItem,
  recipes: readonly Runeword[],
  described: StashItemDescription,
  data: BuildDraftData
): DraftItemMatch | null {
  const pool = bySockets(recipes, item.sockets ?? 0);
  const chosen = pool.at(0);
  if (chosen === undefined) return null;
  const jewels = item.socketed.filter((child) => describeStashItem(child, data.catalog).category === 'jewel');
  const base = asRunewordBaseChoice({ code: item.code, name: described.baseName });
  const socketed = fillerNames(jewels, data);
  return {
    ref: { ...runewordToRef(chosen), ...(base === undefined ? {} : { base }), ...(socketed === undefined ? {} : { socketed }) },
    kind: 'runeword',
    outcome: pool.length > 1 ? 'check' : 'matched',
    note: null,
    message: pool.length > 1 ? CHECK_MESSAGE : null,
  };
}

function sortedNames(names: readonly string[]): string {
  return names.map(normalizeName).sort().join(',');
}

/**
 * A gemword is its name, the gems in the item and where it can go: the gems leave 2-3 of its 90 rows, the slot usually
 * one, and the off hand (where a weapon can sit) needs the item's own type as well.
 */
function matchGemword(
  item: CharacterItem,
  name: string,
  slot: EquipmentSlot | WeaponSwapSlot,
  described: StashItemDescription,
  index: DraftItemIndex,
  data: BuildDraftData
): DraftItemMatch | null {
  const gems = sortedNames(item.socketed.map((child) => describeStashItem(child, data.catalog).baseName));
  const sameGems = (index.gemwords.get(normalizeName(name)) ?? []).filter((candidate) => sortedNames(candidate.gems) === gems);
  const inSlot = sameGems.filter((candidate) => itemFitsSlot(slot, { type: 'gemword', allowedItems: candidate.allowedItems }));
  const itemTypes = new Set(described.typeChain.map((type) => siteTypeLabel(type, data.typeNames)));
  const ofType = inSlot.filter((candidate) => candidate.allowedItems.some((allowed) => itemTypes.has(normalizeName(allowed))));
  const pool = ofType.length > 0 ? ofType : inSlot;
  const chosen = pool.at(0);
  if (chosen === undefined) return null;
  return {
    ref: gemwordToRef(chosen),
    kind: 'gemword',
    outcome: pool.length > 1 ? 'check' : 'matched',
    note: null,
    message: pool.length > 1 ? CHECK_MESSAGE : null,
  };
}

/** The ref of an equipped item in `slot`: a named item when the data has it, else a custom item. */
export function matchDraftItem(
  item: CharacterItem,
  slot: EquipmentSlot | WeaponSwapSlot,
  index: DraftItemIndex,
  data: BuildDraftData
): DraftItemMatch {
  const described = describeStashItem(item, data.catalog);
  // The parser nulls the "no row" sentinel, so a unique without an id is a quest item (Horadric Staff …)
  if (item.quality === 'unique' && item.uniqueId === null) return customMatch(item, described, 'quest', data);
  if (item.quality === 'unique') {
    const match = described.unique === null ? null : matchUnique(item, described.unique, described, index, data);
    return match ?? customMatch(item, described, 'unique', data);
  }
  if (item.quality === 'set') {
    const match = described.setItem === null ? null : matchSetItem(item, described.setItem, described, data);
    return match ?? customMatch(item, described, 'set', data);
  }
  if (described.kind === 'runeword' && described.runeword !== null) {
    const info = described.runeword;
    const recipes = index.recipes.get(info.key) ?? [];
    const isGemword = info.gemword === true || recipes.at(0)?.type === 'gemword';
    const match = isGemword
      ? matchGemword(item, info.name, slot, described, index, data)
      : matchRuneword(
          item,
          recipes.flatMap((recipe) => (recipe.type === 'runeword' ? [recipe.record] : [])),
          described,
          data
        );
    return match ?? customMatch(item, described, isGemword ? 'gemword' : 'runeword', data);
  }
  return customMatch(item, described, described.kind, data);
}
