import type { ItemTypeInfo } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { buildItemTypeIndex, type ItemTypeIndex } from '../engine/itemTypes';

/** types.json: the item type names and ancestors of the item type search and the category filter (5 KB gzipped) */
const TYPES_FILES = ['types'] as const;

export type StashTypesState =
  | { readonly status: 'loading'; readonly types: null }
  | { readonly status: 'ready'; readonly types: ItemTypeIndex }
  | { readonly status: 'error'; readonly types: null; readonly error: unknown; readonly retry: () => void };

// One index per loaded types.json (the loader caches the bundle for the page lifetime)
let typeIndexCache: { types: readonly ItemTypeInfo[]; index: ItemTypeIndex } | null = null;
function itemTypeIndex(types: readonly ItemTypeInfo[]): ItemTypeIndex {
  if (typeIndexCache?.types !== types) typeIndexCache = { types, index: buildItemTypeIndex(types) };
  return typeIndexCache.index;
}

/** Loads types.json and gives the item type index (the same object for the page lifetime, so it can key caches). */
export function useStashTypes(): StashTypesState {
  const gameData = useGameData(TYPES_FILES);
  if (gameData.status === 'loading') return { status: 'loading', types: null };
  if (gameData.status === 'error') return { status: 'error', types: null, error: gameData.error, retry: gameData.retry };
  return { status: 'ready', types: itemTypeIndex(gameData.data.types.types) };
}
