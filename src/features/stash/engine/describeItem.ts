/**
 * What a stash item is, from the save fields and stash.json alone (no stat text): its kind (quality, with runewords and
 * compact items apart), base, item types, category, tier, the unique / set item / runeword it is, and the icon the
 * shared `ItemIcon` draws. Names with affixes need the item text tables: items/itemNames.ts.
 */
import type { BaseTier } from '@/features/game-data/constants/bases';
import {
  STASH_ITEM_FLAGS,
  type StashBaseInfo,
  type StashRunewordInfo,
  type StashSetInfo,
  type StashSetItemInfo,
  type StashUniqueInfo,
} from '@/features/game-data/engine/schema';
import type { ItemIconRef } from '@/features/game-data/hooks/useItemIcons';
import type { ItemQuality, StashItem } from '../parser/types';
import type { StashCatalog } from './catalog';

/**
 * unique / set / rare / crafted / tempered / magic / superior / inferior / normal: the item's quality; `runeword` beats
 * the quality (a runeword is a normal or superior item; charm gemwords too); `simple`: a compact item (runes, gems,
 * potions, keys …: no quality, level or stats)
 */
export const STASH_ITEM_KINDS = [
  'unique',
  'set',
  'runeword',
  'rare',
  'crafted',
  'tempered',
  'magic',
  'superior',
  'inferior',
  'normal',
  'simple',
] as const;
export type StashItemKind = (typeof STASH_ITEM_KINDS)[number];

/** The category filter: by the type chain (weap, armo, ring / amul, char, jewl); everything else is `other` */
export const ITEM_CATEGORIES = ['weapon', 'armor', 'jewelry', 'charm', 'jewel', 'other'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

const CATEGORY_TYPES: readonly [ItemCategory, readonly string[]][] = [
  ['weapon', ['weap']],
  ['armor', ['armo']],
  ['jewelry', ['ring', 'amul']],
  ['charm', ['char']],
  ['jewel', ['jewl']],
];

export interface StashItemDescription {
  readonly kind: StashItemKind;
  readonly quality: ItemQuality | null;
  readonly code: string;
  /** null for a code stash.json does not know (the parser rejects those, so only hand-built items) */
  readonly base: StashBaseInfo | null;
  /** The base name, the code when unknown */
  readonly baseName: string;
  /** Item type code (`type`) and its display name (types.json); null when unknown */
  readonly type: string | null;
  readonly typeName: string | null;
  /** `type` and `type2` with their ancestors ([] without types.json) */
  readonly typeChain: readonly string[];
  readonly category: ItemCategory;
  /** The base's tier (weapons / armor), null for misc and tierless items */
  readonly tier: BaseTier | null;
  /** Unique quality: the uniqueitems.txt row; null when the id is unknown or the item is no unique */
  readonly unique: StashUniqueInfo | null;
  /** Set quality: the setitems.txt row and its set (null when sets.txt lacks it) */
  readonly setItem: StashSetItemInfo | null;
  readonly set: StashSetInfo | null;
  /** The runeword (or charm gemword) of the runeword field; null without one or for an unknown id */
  readonly runeword: StashRunewordInfo | null;
  /** For `ItemIcon`: the unique's / set item's own art (base art fallback), else the base's art */
  readonly icon: ItemIconRef;
}

/**
 * The category of a type chain. Without types.json (an empty chain) the parser's flags and the base's own type decide,
 * so weapons, armor and charms are still told apart.
 */
export function itemCategory(
  typeChain: readonly string[],
  fallback?: { readonly flags: number; readonly type: string | null }
): ItemCategory {
  const chain =
    typeChain.length > 0 || fallback === undefined
      ? typeChain
      : [
          ...(fallback.type === null ? [] : [fallback.type]),
          ...((fallback.flags & STASH_ITEM_FLAGS.weapon) !== 0 ? ['weap'] : []),
          ...((fallback.flags & STASH_ITEM_FLAGS.armor) !== 0 ? ['armo'] : []),
          ...((fallback.flags & STASH_ITEM_FLAGS.charm) !== 0 ? ['char'] : []),
        ];
  return CATEGORY_TYPES.find(([, types]) => types.some((type) => chain.includes(type)))?.[0] ?? 'other';
}

/** The item's kind from its own fields (no game data needed) */
export function stashItemKind(item: StashItem): StashItemKind {
  if (item.compact || item.quality === null) return 'simple';
  if (item.runewordId !== null && item.quality !== 'unique' && item.quality !== 'set') return 'runeword';
  return item.quality;
}

function iconOf(item: StashItem, description: Omit<StashItemDescription, 'icon'>): ItemIconRef {
  if (description.unique !== null) return { kind: 'unique', name: description.unique.name, code: item.code };
  if (description.setItem !== null) return { kind: 'set', name: description.setItem.name, code: item.code };
  if (description.category === 'weapon' || description.category === 'armor') return { kind: 'base', code: item.code };
  return { kind: 'misc', name: description.baseName, code: item.code };
}

export function describeStashItem(item: StashItem, catalog: StashCatalog): StashItemDescription {
  const base = catalog.base(item.code) ?? null;
  const typeChain = catalog.typeChain(item.code);
  const setItem = item.quality === 'set' && item.setId !== null ? (catalog.setItem(item.setId) ?? null) : null;
  const description: Omit<StashItemDescription, 'icon'> = {
    kind: stashItemKind(item),
    quality: item.quality,
    code: item.code,
    base,
    baseName: base?.name ?? item.code,
    type: base?.type ?? null,
    typeName: base === null ? null : catalog.typeName(base.type),
    typeChain,
    category: itemCategory(typeChain, { flags: catalog.flags(item.code), type: base?.type ?? null }),
    tier: base?.tier ?? null,
    unique: item.quality === 'unique' && item.uniqueId !== null ? (catalog.unique(item.uniqueId) ?? null) : null,
    setItem,
    set: setItem === null ? null : (catalog.set(setItem.set) ?? null),
    runeword: item.runewordId === null ? null : (catalog.runeword(item.runewordId) ?? null),
  };
  return { ...description, icon: iconOf(item, description) };
}
