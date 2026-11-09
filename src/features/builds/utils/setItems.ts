import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { loadGameDataFile } from '@/features/game-data/engine/browser/loadGameData';
import type { SetInfo, SetItemInfo, SetsBundle } from '@/features/game-data/engine/schema';

export interface SetItemMatch {
  readonly item: SetItemInfo;
  readonly set: SetInfo;
}

/** The set item with this name and its set (set item names are unique across sets.json), or null. */
export function findSetItem(bundle: SetsBundle, name: string): SetItemMatch | null {
  for (const set of bundle.sets) {
    const item = set.items.find((entry) => entry.name === name);
    if (item !== undefined) return { item, set };
  }
  return null;
}

/**
 * The sets.json bundle (cached per page by the game-data loader). Wrapped in
 * Promise.resolve because callers run inside Dexie liveQuery queriers
 * (computeBuildItemDiffs, resolveFullItem), and Dexie asks for non-Dexie async
 * calls (here a fetch) to be wrapped so its query tracking survives the await.
 */
export function loadSetsBundle(): Promise<SetsBundle> {
  return Promise.resolve(loadGameDataFile('sets'));
}

/** Set item green, as on the Sets page. */
export const SET_NAME_CLASS = 'text-green-700 dark:text-green-400';

/** The Sets page focused on this item's set, with the item highlighted (`?name=` takes a set or set item name). */
export function setItemPageUrl(itemName: string): string {
  return `/sets?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.NAME]: itemName }).toString()}`;
}
