import type { StashCatalog } from '../engine/catalog';
import { createItemTextContext, type ItemTextContext } from '../engine/items/itemText';

/**
 * The item text of the All items page: loads itemtext.json (lazy, this page only) and builds the text context.
 *
 * CONTRACT (docs/features/STASH-ITEMS.md "Contracts"): owned by the stat text workstream. STUB until itemtext.json
 * exists: always `ready` with the placeholder context (`hasText` false: base lines, base-name fallbacks, no stat
 * values). The real hook also returns `loading` and `error`; the page shows the items in every state, with stat text
 * only once `ready`.
 */
export type ItemTextState =
  | { readonly status: 'loading'; readonly text: null }
  | { readonly status: 'ready'; readonly text: ItemTextContext }
  | { readonly status: 'error'; readonly text: null; readonly error: unknown; readonly retry: () => void };

const placeholders = new WeakMap<StashCatalog, ItemTextContext>();

// eslint-disable-next-line react-x/no-unnecessary-use-prefix -- a hook by contract: the real one loads itemtext.json (useGameData)
export function useItemText(catalog: StashCatalog): ItemTextState {
  let text = placeholders.get(catalog);
  if (text === undefined) {
    text = createItemTextContext(null, catalog);
    placeholders.set(catalog, text);
  }
  return { status: 'ready', text };
}
