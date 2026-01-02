import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useRuneGroups } from './useRuneGroups';
import { useAvailableItemTypes } from './useAvailableItemTypes';
import { setSearchText, setSocketCount, setAllRunes, setAllItemTypes } from '../store/runewordsSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  SOCKETS: 'sockets',
  ITEMS: 'items',
  RUNES: 'runes',
} as const;

/**
 * Initializes runeword filter state from URL query parameters (one-time on mount).
 * After initialization, cleans the URL to keep it tidy while browsing.
 * Use useShareUrl() to generate shareable URLs with current filter state.
 */
export function useUrlInitialize(): void {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  // Available options from DB
  const runeGroups = useRuneGroups();
  const itemTypes = useAvailableItemTypes();

  // Track initialization state
  const initializedRef = useRef(false);

  // URL → Redux (on mount, once data is loaded)
  useEffect(() => {
    // Skip if already initialized
    if (initializedRef.current) return;
    // Wait for data to load
    if (!runeGroups || runeGroups.length === 0) return;
    if (!itemTypes || itemTypes.length === 0) return;

    initializedRef.current = true;

    // Build all possible rune keys
    const allRuneKeys: string[] = [];
    for (const group of runeGroups) {
      for (const rune of group.runes) {
        allRuneKeys.push(`${group.category}:${rune}`);
      }
    }

    // Parse URL params
    const urlSearch = searchParams.get(URL_PARAM_KEYS.SEARCH);
    const urlSockets = searchParams.get(URL_PARAM_KEYS.SOCKETS);
    const urlItems = searchParams.get(URL_PARAM_KEYS.ITEMS);
    const urlRunes = searchParams.get(URL_PARAM_KEYS.RUNES);

    const hasUrlParams = urlSearch !== null || urlSockets !== null || urlItems !== null || urlRunes !== null;

    if (hasUrlParams) {
      // Initialize from URL params
      if (urlSearch !== null) {
        dispatch(setSearchText(urlSearch));
      }

      if (urlSockets !== null) {
        const parsed = parseInt(urlSockets, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
          dispatch(setSocketCount(parsed));
        }
      }

      // Item types: if param exists, only those items are selected; otherwise all selected
      const urlItemSet = urlItems ? new Set(urlItems.split(',')) : null;
      const decodedItemTypes: Record<string, boolean> = {};
      for (const type of itemTypes) {
        decodedItemTypes[type] = urlItemSet ? urlItemSet.has(type) : true;
      }
      dispatch(setAllItemTypes(decodedItemTypes));

      // Runes: if param exists, only those runes are selected; otherwise all selected
      const urlRuneSet = urlRunes ? new Set(urlRunes.split(',')) : null;
      const decodedRunes: Record<string, boolean> = {};
      for (const key of allRuneKeys) {
        decodedRunes[key] = urlRuneSet ? urlRuneSet.has(key) : true;
      }
      dispatch(setAllRunes(decodedRunes));

      // Clean the URL after initialization
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // No URL params - initialize with defaults (all selected)
      const allItemTypes: Record<string, boolean> = {};
      for (const type of itemTypes) {
        allItemTypes[type] = true;
      }
      dispatch(setAllItemTypes(allItemTypes));

      const allRunes: Record<string, boolean> = {};
      for (const key of allRuneKeys) {
        allRunes[key] = true;
      }
      dispatch(setAllRunes(allRunes));
    }
  }, [runeGroups, itemTypes, searchParams, dispatch]);
}
