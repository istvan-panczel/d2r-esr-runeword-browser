import type { ItemTextBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import type { StashCatalog } from '../engine/catalog';
import { createItemTextContext, type ItemTextContext } from '../engine/items/itemText';

/**
 * The item text of the All items page: loads itemtext.json (lazy: only the pages that call this hook fetch it) and
 * builds the text context, once per bundle and catalog.
 *
 * CONTRACT (docs/features/STASH-ITEMS.md "Contracts"): owned by the stat text workstream. The page shows the items in
 * every state, with stat text, stat filters and affix names once `ready`; `error` offers `retry` (refetches).
 */
export type ItemTextState =
  | { readonly status: 'loading'; readonly text: null }
  | { readonly status: 'ready'; readonly text: ItemTextContext }
  | { readonly status: 'error'; readonly text: null; readonly error: unknown; readonly retry: () => void };

const FILES = ['itemtext'] as const;
const contexts = new WeakMap<ItemTextBundle, WeakMap<StashCatalog, ItemTextContext>>();

/** The text context of a bundle and catalog, built once per pair (stable across renders) */
export function itemTextContext(bundle: ItemTextBundle, catalog: StashCatalog): ItemTextContext {
  let byCatalog = contexts.get(bundle);
  if (byCatalog === undefined) contexts.set(bundle, (byCatalog = new WeakMap()));
  let context = byCatalog.get(catalog);
  if (context === undefined) byCatalog.set(catalog, (context = createItemTextContext(bundle, catalog)));
  return context;
}

export function useItemText(catalog: StashCatalog): ItemTextState {
  const state = useGameData(FILES);
  switch (state.status) {
    case 'loading':
      return { status: 'loading', text: null };
    case 'error':
      return { status: 'error', text: null, error: state.error, retry: state.retry };
    case 'ready':
      return { status: 'ready', text: itemTextContext(state.data.itemtext, catalog) };
  }
}
