import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import { selectError, selectIsInitialized } from '@/core/store';
import type { BuildDraftData } from '@/features/character/engine/buildDraft';
import type { CharSheetBundle, ItemTextBundle, StashBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { stashCatalog, withNames } from '@/features/stash/engine/catalog';
import { buildItemTypeIndex } from '@/features/stash/engine/itemTypes';
import { createItemTextContext } from '@/features/stash/engine/items/itemText';
import { useEquipmentItems } from './useEquipmentItems';

export type SaveDraftDataState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly stash: StashBundle;
      readonly data: BuildDraftData;
      /** The character stats bundles; null when charsheet.json failed to load (the draft then comes without stats) */
      readonly sheetBundles: { readonly charsheet: CharSheetBundle; readonly itemtext: ItemTextBundle } | null;
    };

/** Fetched only once a save is picked (the hook's component mounts then): lootfilter.json is the skill-row table */
const FILES = ['stash', 'stashnames', 'types', 'itemtext', 'sets', 'runewords', 'lootfilter'] as const;
/** Apart from FILES: the character stats are optional, so a failure here never blocks the import */
const SHEET_FILES = ['charsheet'] as const;

const NOT_AVAILABLE = 'The item data is not available yet. Reload the page and try again, or start a build by hand.';

/** The game data and local item tables a draft needs. Waits for the HTM sync: run too early, every unique would look unmatched. */
export function useSaveDraftData(): SaveDraftDataState {
  const gameData = useGameData(FILES);
  const sheetData = useGameData(SHEET_FILES);
  const items = useEquipmentItems();
  const ascendancies = useLiveQuery(async () => (await db.ascendancies.toArray()).map((ascendancy) => ascendancy.name));
  const isInitialized = useSelector(selectIsInitialized);
  const syncError = useSelector(selectError);

  if (gameData.status === 'error') return { status: 'error', message: NOT_AVAILABLE };
  if (gameData.status === 'loading' || sheetData.status === 'loading' || items === undefined || ascendancies === undefined) {
    return { status: 'loading' };
  }
  if (!isInitialized && syncError === null) return { status: 'loading' };
  if (items.uniques.length === 0) return { status: 'error', message: NOT_AVAILABLE };

  const { stash, stashnames, types, itemtext, sets, runewords, lootfilter } = gameData.data;
  const catalog = stashCatalog(withNames(stash, stashnames), buildItemTypeIndex(types.types));
  return {
    status: 'ready',
    stash,
    sheetBundles: sheetData.status === 'ready' ? { charsheet: sheetData.data.charsheet, itemtext } : null,
    data: {
      catalog,
      text: createItemTextContext(itemtext, catalog),
      sets,
      txtRunewords: runewords,
      typeNames: new Map(types.types.map((type) => [type.code, type.name])),
      uniques: items.uniques,
      mythicals: items.mythicals,
      runewords: items.runewords,
      gemwords: items.gemwords,
      ascendancies,
      skillIds: lootfilter.skillNames ?? [],
      skillNames: new Map(itemtext.skills.map((skill) => [skill.id, skill.name])),
    },
  };
}
