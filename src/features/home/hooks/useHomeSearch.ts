import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectError, selectIsInitialized } from '@/core/store';
import { searchHome, type HomeSearchGroup, type HomeSearchSources } from '../utils/homeSearch';
import { useBundleNames, useItemNames } from './useHomeSearchSources';

export interface HomeSearchState {
  readonly groups: readonly HomeSearchGroup[];
  /** Runeword and unique names are not read yet (the startup sync has not initialized, or the first read is running) */
  readonly itemsPending: boolean;
  /** A static game-data bundle is not fetched yet */
  readonly bundlesPending: boolean;
  /** The startup sync failed before it initialized, so the runeword and unique names will not come */
  readonly itemsFailed: boolean;
}

/**
 * The search behind the home page input and the global search dialog. Nothing is read or fetched until `query` is first
 * non-empty; from then on results are computed synchronously from the current query and the names loaded so far, so a slow
 * earlier query cannot overwrite a newer one.
 */
export function useHomeSearch(query: string): HomeSearchState {
  const isInitialized = useSelector(selectIsInitialized);
  const syncError = useSelector(selectError);
  const trimmed = query.trim();
  const [activated, setActivated] = useState(trimmed !== '');
  if (!activated && trimmed !== '') setActivated(true);

  const itemNames = useItemNames(activated && isInitialized);
  const bundleNames = useBundleNames(activated);
  const sources: HomeSearchSources = { ...itemNames, ...bundleNames.sources };

  return {
    groups: searchHome(trimmed, sources),
    itemsPending: !isInitialized || itemNames === undefined,
    bundlesPending: bundleNames.pending,
    itemsFailed: syncError !== null && !isInitialized,
  };
}
