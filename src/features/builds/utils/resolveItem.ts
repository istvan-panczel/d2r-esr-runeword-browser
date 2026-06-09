import { db } from '@/core/db';
import type { Gemword, HtmUniqueItem, MythicalUnique, Runeword } from '@/core/db';
import type { ItemRef } from '../buildData';
import { findMythicalRecord, findUniqueRecord } from './itemLookup';

/** The full local-DB object behind an item reference, tagged by type. */
export type ResolvedFullItem =
  | { readonly kind: 'unique'; readonly item: HtmUniqueItem }
  | { readonly kind: 'mythical'; readonly item: MythicalUnique }
  | { readonly kind: 'runeword'; readonly runeword: Runeword }
  | { readonly kind: 'gemword'; readonly gemword: Gemword };

/** Stable identity key for an item ref — used as a useLiveQuery dependency. */
export function itemRefKey(ref: ItemRef): string {
  switch (ref.type) {
    case 'unique':
    case 'mythical':
      return `${ref.type}:${String(ref.id)}`;
    case 'runeword':
    case 'gemword':
      return `${ref.type}:${ref.name}:${String(ref.variant)}`;
    case 'freetext':
      return `freetext:${ref.name}`;
  }
}

/**
 * Resolves the full local-DB record behind an item reference, so the rich browse-page
 * cards (which need the complete item, not just the saved snapshot) can be reused.
 * Returns null when the item no longer exists locally or the ref is freetext.
 */
export async function resolveFullItem(ref: ItemRef): Promise<ResolvedFullItem | null> {
  switch (ref.type) {
    case 'unique': {
      const item = await findUniqueRecord(ref);
      return item ? { kind: 'unique', item } : null;
    }
    case 'mythical': {
      const item = await findMythicalRecord(ref);
      return item ? { kind: 'mythical', item } : null;
    }
    case 'runeword': {
      const runeword = await db.runewords.get([ref.name, ref.variant]);
      return runeword ? { kind: 'runeword', runeword } : null;
    }
    case 'gemword': {
      const gemword = await db.gemwords.get([ref.name, ref.variant]);
      return gemword ? { kind: 'gemword', gemword } : null;
    }
    case 'freetext':
      return null;
  }
}
