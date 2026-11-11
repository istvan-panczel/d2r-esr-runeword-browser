import type { ItemTextBundle, StashNamesBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { stashCatalog, withNames, type StashCatalog } from '@/features/stash/engine/catalog';
import type { ItemTextContext } from '@/features/stash/engine/items/itemText';
import { itemTextContext } from '@/features/stash/hooks/useItemText';
import { useStashTypes } from '@/features/stash/hooks/useStashTypes';
import type { ItemTypeIndex } from '@/features/stash/engine/itemTypes';
import { buildCharacterItems, type CharacterItemsView } from '../engine/characterItems';
import type { CharacterFile } from '../parser/types';
import { useCharacter } from './useCharacter';

const FILES = ['stashnames', 'itemtext'] as const;

export type CharacterItemsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: unknown; readonly retry: () => void }
  | {
      readonly status: 'ready';
      readonly view: CharacterItemsView;
      readonly catalog: StashCatalog;
      readonly text: ItemTextContext;
      readonly types: ItemTypeIndex;
      readonly names: StashNamesBundle;
      readonly itemText: ItemTextBundle;
    };

/** The item rows of the Gear, Storage and Progress tabs: loads the names, item text and type data, then builds the view. */
export function useCharacterItems(character: CharacterFile): CharacterItemsState {
  const { bundle } = useCharacter();
  const types = useStashTypes();
  const gameData = useGameData(FILES);
  if (types.status === 'error') return { status: 'error', error: types.error, retry: types.retry };
  if (gameData.status === 'error') return { status: 'error', error: gameData.error, retry: gameData.retry };
  if (types.status === 'loading' || gameData.status === 'loading') return { status: 'loading' };
  const catalog = stashCatalog(withNames(bundle, gameData.data.stashnames), types.types);
  const text = itemTextContext(gameData.data.itemtext, catalog);
  return {
    status: 'ready',
    view: buildCharacterItems(character, catalog, text),
    catalog,
    text,
    types: types.types,
    names: gameData.data.stashnames,
    itemText: gameData.data.itemtext,
  };
}
