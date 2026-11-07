import type { BasesBundle, CraftingBundle, EnhanceBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { craftLookups, type CraftLookups } from '../utils/crafts';

/** Crafting annotation data for a screen: `idle` when not needed, `error` when the bundles failed to load. */
export type CraftDataState =
  | { readonly status: 'idle' | 'loading' | 'error'; readonly lookups: undefined }
  | { readonly status: 'ready'; readonly lookups: CraftLookups };

// bases: an item's base type picks its anointment pool (ESR 3.3: one pool per item type)
const CRAFT_FILES = ['crafting', 'enhance', 'bases'] as const;
const NO_FILES: readonly ('crafting' | 'enhance' | 'bases')[] = [];

/**
 * The crafting + enhance bundles as O(1) lookups, loaded once per screen and passed down to the
 * slot cells (not one hook per slot). `enabled: false` skips the fetch (a build without crafts).
 */
export function useCraftData(enabled: boolean): CraftDataState {
  const game = useGameData<'crafting' | 'enhance' | 'bases'>(enabled ? CRAFT_FILES : NO_FILES);
  if (!enabled) return { status: 'idle', lookups: undefined };
  if (game.status !== 'ready') return { status: game.status, lookups: undefined };
  // The state can briefly hold the result of the previous (empty) file list after `enabled` flips on.
  const crafting = game.data.crafting as CraftingBundle | undefined;
  const enhance = game.data.enhance as EnhanceBundle | undefined;
  const bases = game.data.bases as BasesBundle | undefined;
  if (crafting === undefined || enhance === undefined || bases === undefined) return { status: 'loading', lookups: undefined };
  return { status: 'ready', lookups: craftLookups(crafting, enhance, bases.bases) };
}
