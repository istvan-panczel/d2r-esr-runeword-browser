import { useSyncExternalStore } from 'react';
import { normaliseItemName } from '@/core/utils/itemName';
import type { IconsBundle, ItemIconInfo, QuestIconInfo } from '../engine/schema';
import { loadGameDataFile } from '../engine/browser/loadGameData';

type IconMap = ReadonlyMap<string, ItemIconInfo>;

/**
 * icons.json indexed for lookups: bases, quest items and the other misc items by code; uniques, set items and misc
 * items by normalised display name; item types by type code.
 */
export interface ItemIconIndex {
  readonly bases: IconMap;
  readonly uniques: IconMap;
  readonly sets: IconMap;
  readonly misc: IconMap;
  /** With the item's display name */
  readonly quest: ReadonlyMap<string, QuestIconInfo>;
  /** Misc items by code (the codes `bases` and `quest` key are not repeated) */
  readonly items: IconMap;
  readonly types: IconMap;
}

/** Separator of a code-qualified misc key in icons.json (`Ko Rune#r19`; build/itemIcons.ts `MISC_CODE_SEPARATOR`) */
const MISC_CODE_SEPARATOR = '#';

/**
 * What an icon is looked up by. Mythical uniques are `unique`; `code` is the base fallback for an unknown name. A misc
 * item (gem, rune, crystal) is looked up by name; `code` picks the row when the name's rows have different art, and is
 * the base fallback (rings, charms, jewels … are bases by code).
 */
export type ItemIconRef =
  | { readonly kind: 'base'; readonly code: string }
  /** Any item by code: a base, a quest item or another misc item (organs, cube materials, potions, coupons …) */
  | { readonly kind: 'item'; readonly code: string }
  /** An item type: the art its items share, else a representative item's; broad types (Weapon, Any Armor) have none */
  | { readonly kind: 'type'; readonly code: string }
  /** Quest items, portal keys, organs and endgame map items (icons.json `quest`) */
  | { readonly kind: 'quest'; readonly code: string }
  | { readonly kind: 'unique' | 'set'; readonly name: string; readonly code?: string }
  | { readonly kind: 'misc'; readonly name: string; readonly code?: string };

/**
 * Names go through `normaliseItemName` on both sides (the HTM pages and the builds refs spell some names with other
 * apostrophes, casing or spacing than the string table).
 */
export function buildItemIconIndex(
  bundle: Pick<IconsBundle, 'bases' | 'uniques' | 'sets'> & Partial<Pick<IconsBundle, 'misc' | 'quest' | 'items' | 'types'>>
): ItemIconIndex {
  const byName = (section: Record<string, ItemIconInfo>): IconMap => {
    const map = new Map<string, ItemIconInfo>();
    for (const [name, info] of Object.entries(section)) {
      const key = normaliseItemName(name);
      if (!map.has(key)) map.set(key, info);
    }
    return map;
  };
  return {
    bases: new Map(Object.entries(bundle.bases)),
    uniques: byName(bundle.uniques),
    sets: byName(bundle.sets),
    misc: byName(bundle.misc ?? {}),
    quest: new Map(Object.entries(bundle.quest ?? {})),
    items: new Map(Object.entries(bundle.items ?? {})),
    types: new Map(Object.entries(bundle.types ?? {})),
  };
}

/** The name without a trailing parenthetical: the HTM pages list "Tathamet's Awakening (Fire Variant)" and its siblings. */
export function withoutVariantSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '');
}

/** The icon of a ref, or undefined (unknown name / code, or vanilla art). */
export function findItemIcon(index: ItemIconIndex, ref: ItemIconRef): ItemIconInfo | undefined {
  if (ref.kind === 'base') return index.bases.get(ref.code);
  if (ref.kind === 'quest') return index.quest.get(ref.code);
  if (ref.kind === 'item') return index.bases.get(ref.code) ?? index.quest.get(ref.code) ?? index.items.get(ref.code);
  if (ref.kind === 'type') return index.types.get(ref.code);
  if (ref.kind === 'misc') {
    const name = normaliseItemName(withoutVariantSuffix(ref.name));
    const qualified = ref.code === undefined ? undefined : index.misc.get(`${name}${MISC_CODE_SEPARATOR}${ref.code.toLowerCase()}`);
    // Rings, amulets, charms, jewels and quivers are bases (by code), not misc names
    return qualified ?? index.misc.get(name) ?? (ref.code === undefined ? undefined : index.bases.get(ref.code));
  }
  const names = ref.kind === 'unique' ? index.uniques : index.sets;
  const own = names.get(normaliseItemName(ref.name)) ?? names.get(normaliseItemName(withoutVariantSuffix(ref.name)));
  return own ?? (ref.code === undefined ? undefined : index.bases.get(ref.code));
}

/** The shared icon store: the index once loaded; `failed` after a failed load (until a later subscriber retries). */
export interface ItemIconsState {
  readonly index: ItemIconIndex | null;
  readonly failed: boolean;
}

/*
 * One shared store instead of `useGameData(['icons'])` per icon: the families table renders ~600 icons, and each
 * useGameData call would run its own effect and state update. The first subscriber starts the (cached) load; a failed
 * load leaves the page without icons until the next subscriber after it retries.
 */
let state: ItemIconsState = { index: null, failed: false };
let loading = false;
const listeners = new Set<() => void>();

function setState(next: ItemIconsState): void {
  state = next;
  for (const notify of listeners) notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (state.index === null && !loading) {
    loading = true;
    if (state.failed) setState({ index: null, failed: false });
    loadGameDataFile('icons').then(
      (bundle) => {
        loading = false;
        setState({ index: buildItemIconIndex(bundle), failed: false });
      },
      (error: unknown) => {
        loading = false;
        console.warn('Item icons unavailable:', error);
        setState({ index: null, failed: true });
      }
    );
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ItemIconsState {
  return state;
}

/** The item icon store: `index` null while loading (`failed` false) or after a failed load (`failed` true). */
export function useItemIcons(): ItemIconsState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
