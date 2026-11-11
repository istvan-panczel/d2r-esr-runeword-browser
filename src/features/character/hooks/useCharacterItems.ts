import type { ItemTextBundle, StashNamesBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { stashCatalog, withNames, type StashCatalog } from '@/features/stash/engine/catalog';
import { itemDisplayName } from '@/features/stash/engine/items/itemNames';
import type { ItemTextContext } from '@/features/stash/engine/items/itemText';
import { itemTextContext } from '@/features/stash/hooks/useItemText';
import { useStashTypes } from '@/features/stash/hooks/useStashTypes';
import type { ItemTypeIndex } from '@/features/stash/engine/itemTypes';
import { buildCharacterItems, type CharacterItemsView } from '../engine/characterItems';
import type { CharacterFile } from '../parser/types';
import { useCharacter } from './useCharacter';

const FILES = ['stashnames', 'itemtext'] as const;

interface CatalogReady {
  readonly status: 'ready';
  readonly catalog: StashCatalog;
  readonly text: ItemTextContext;
  readonly types: ItemTypeIndex;
  readonly names: StashNamesBundle;
  readonly itemText: ItemTextBundle;
}

type CatalogState =
  { readonly status: 'loading' } | { readonly status: 'error'; readonly error: unknown; readonly retry: () => void } | CatalogReady;

export type CharacterItemsState = Exclude<CatalogState, CatalogReady> | (CatalogReady & { readonly view: CharacterItemsView });

/** The item catalog and text context of the page (names, item text, types) */
function useCharacterCatalog(): CatalogState {
  const { bundle } = useCharacter();
  const types = useStashTypes();
  const gameData = useGameData(FILES);
  if (types.status === 'error') return { status: 'error', error: types.error, retry: types.retry };
  if (gameData.status === 'error') return { status: 'error', error: gameData.error, retry: gameData.retry };
  if (types.status === 'loading' || gameData.status === 'loading') return { status: 'loading' };
  const catalog = stashCatalog(withNames(bundle, gameData.data.stashnames), types.types);
  return {
    status: 'ready',
    catalog,
    text: itemTextContext(gameData.data.itemtext, catalog),
    types: types.types,
    names: gameData.data.stashnames,
    itemText: gameData.data.itemtext,
  };
}

/** The item rows of the Gear, Storage and Progress tabs: loads the names, item text and type data, then builds the view. */
export function useCharacterItems(character: CharacterFile): CharacterItemsState {
  const catalog = useCharacterCatalog();
  if (catalog.status !== 'ready') return catalog;
  return { ...catalog, view: buildCharacterItems(character, catalog.catalog, catalog.text) };
}

/**
 * The display name of a player item by its index in `character.items.player` (the computed sheet's source items);
 * null while the names load or for an index the save does not have.
 */
export function useCharacterItemNames(character: CharacterFile): (index: number) => string | null {
  const catalog = useCharacterCatalog();
  if (catalog.status !== 'ready') return () => null;
  const { player } = character.items;
  return (index) => {
    const item = player.at(index);
    return item === undefined ? null : itemDisplayName(item, catalog.catalog, catalog.text);
  };
}
