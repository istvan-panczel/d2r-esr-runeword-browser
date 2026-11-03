/**
 * Lookups into stash.json + stashnames.json (and types.json) by the ids a save stores: the base of an item code, the
 * uniqueitems.txt / setitems.txt row of a unique / set item, the sets, and the runes.txt key of a runeword field. One
 * catalog per loaded bundle pair (and types index): `stashCatalog` caches it, so pages and engines can call it freely.
 */
import type {
  StashBaseInfo,
  StashBundle,
  StashCoupon,
  StashNamesBundle,
  StashRunewordInfo,
  StashSetInfo,
  StashSetItemInfo,
  StashUniqueInfo,
} from '@/features/game-data/engine/schema';
import { typeAncestors, type ItemTypeIndex } from './itemTypes';

/** stash.json with the names of stashnames.json (`withNames`) */
export type CatalogBundle = StashBundle & StashNamesBundle;

const merged = new WeakMap<StashBundle, WeakMap<StashNamesBundle, CatalogBundle>>();

/** stash.json and stashnames.json as one object, the same object for the same pair (so the catalog cache holds) */
export function withNames(bundle: StashBundle, names: StashNamesBundle): CatalogBundle {
  let byNames = merged.get(bundle);
  if (byNames === undefined) merged.set(bundle, (byNames = new WeakMap()));
  let both = byNames.get(names);
  if (both === undefined) byNames.set(names, (both = { ...bundle, ...names }));
  return both;
}

export interface StashCatalog {
  readonly bundle: CatalogBundle;
  /** types.json names and ancestors; null when the page did not load types.json */
  readonly types: ItemTypeIndex | null;
  base(code: string): StashBaseInfo | undefined;
  /** By uniqueitems.txt row (`StashItem.uniqueId`) */
  unique(id: number): StashUniqueInfo | undefined;
  /** By setitems.txt row (`StashItem.setId`) */
  setItem(id: number): StashSetItemInfo | undefined;
  /** By sets.txt `index` (`StashSetItemInfo.set`) */
  set(id: string): StashSetInfo | undefined;
  /** By the runeword field (`StashItem.runewordId`, a string-table id) */
  runeword(stringId: number): StashRunewordInfo | undefined;
  /** An Ancient Coupon (or the Wild Card) by item code */
  coupon(code: string): StashCoupon | undefined;
  /** The display name of an item type code; null when unknown or without types.json */
  typeName(type: string): string | null;
  /**
   * The code's item types (`type`, then `type2`) with their ancestors, deduplicated: what the item type search and the
   * category filter match. [] for an unknown code or without types.json.
   */
  typeChain(code: string): readonly string[];
  /** The parser's kind flags of a code (STASH_ITEM_FLAGS bits; 0 when unknown) */
  flags(code: string): number;
}

function createCatalog(bundle: CatalogBundle, types: ItemTypeIndex | null): StashCatalog {
  const bases = new Map(bundle.bases.map((base) => [base.code, base]));
  const uniques = new Map(bundle.uniques.map((unique) => [unique.id, unique]));
  const setItems = new Map(bundle.setItems.map((item) => [item.id, item]));
  const sets = new Map(bundle.sets.map((set) => [set.id, set]));
  const runewords = new Map(bundle.runewords.map((entry) => [entry.id, entry]));
  const coupons = new Map(bundle.coupons.map((coupon) => [coupon.code, coupon]));
  const flags = new Map(bundle.items.map(([code, bits]) => [code, bits]));
  const chains = new Map<string, readonly string[]>();
  const typeChain = (code: string): readonly string[] => {
    const cached = chains.get(code);
    if (cached !== undefined) return cached;
    const base = bases.get(code);
    const chain =
      base === undefined || types === null
        ? []
        : [...new Set([base.type, base.type2].flatMap((type) => (type === undefined ? [] : typeAncestors(type, types))))];
    chains.set(code, chain);
    return chain;
  };
  return {
    bundle,
    types,
    base: (code) => bases.get(code),
    unique: (id) => uniques.get(id),
    setItem: (id) => setItems.get(id),
    set: (id) => sets.get(id),
    runeword: (stringId) => runewords.get(stringId),
    coupon: (code) => coupons.get(code),
    typeName: (type) => types?.byCode.get(type)?.name ?? null,
    typeChain,
    flags: (code) => flags.get(code) ?? 0,
  };
}

// The last catalogs built, per bundle (a page has one stash.json and one types index loaded at a time)
const cache = new WeakMap<CatalogBundle, { types: ItemTypeIndex | null; catalog: StashCatalog }[]>();

/** The catalog of a bundle and types index, built once per pair. */
export function stashCatalog(bundle: CatalogBundle, types: ItemTypeIndex | null = null): StashCatalog {
  const entries = cache.get(bundle) ?? [];
  const hit = entries.find((entry) => entry.types === types);
  if (hit !== undefined) return hit.catalog;
  const catalog = createCatalog(bundle, types);
  cache.set(bundle, [...entries.slice(-1), { types, catalog }]);
  return catalog;
}
