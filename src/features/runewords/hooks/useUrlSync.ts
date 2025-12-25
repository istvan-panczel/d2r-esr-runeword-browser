import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useRuneGroups } from './useRuneGroups';
import { useAvailableItemTypes } from './useAvailableItemTypes';
import {
  setSearchText,
  setSocketCount,
  setAllRunes,
  setAllItemTypes,
  selectSearchText,
  selectSocketCount,
  selectSelectedItemTypes,
  selectSelectedRunes,
} from '../store/runewordsSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  SOCKETS: 'sockets',
  ITEMS: 'items',
  RUNES: 'runes',
} as const;

/**
 * Synchronizes runeword filter state with URL query parameters.
 * - On mount: parses URL params and initializes Redux state
 * - On state change: updates URL params (using replace to avoid history pollution)
 * - Replaces useInitializeFilters functionality
 */
export function useUrlSync(): void {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  // Current Redux state
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedRunes = useSelector(selectSelectedRunes);

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

  // Redux → URL (on state change, after initialization)
  useEffect(() => {
    // Don't update URL until initialized
    if (!initializedRef.current) return;
    // Wait for data
    if (!itemTypes || itemTypes.length === 0) return;

    const newParams = new URLSearchParams();

    // Search: add if not empty
    if (searchText) {
      newParams.set(URL_PARAM_KEYS.SEARCH, searchText);
    }

    // Sockets: add if set
    if (socketCount !== null) {
      newParams.set(URL_PARAM_KEYS.SOCKETS, String(socketCount));
    }

    // Items: only add if NOT all selected
    const itemKeys = Object.keys(selectedItemTypes);
    if (itemKeys.length > 0) {
      const allItemsSelected = Object.values(selectedItemTypes).every(Boolean);
      if (!allItemsSelected) {
        const selectedItems = itemKeys.filter((k) => selectedItemTypes[k]);
        if (selectedItems.length > 0) {
          newParams.set(URL_PARAM_KEYS.ITEMS, selectedItems.join(','));
        }
      }
    }

    // Runes: only add if NOT all selected
    const runeKeys = Object.keys(selectedRunes);
    if (runeKeys.length > 0) {
      const allRunesSelected = Object.values(selectedRunes).every(Boolean);
      if (!allRunesSelected) {
        const selectedRuneKeys = runeKeys.filter((k) => selectedRunes[k]);
        if (selectedRuneKeys.length > 0) {
          newParams.set(URL_PARAM_KEYS.RUNES, selectedRuneKeys.join(','));
        }
      }
    }

    // Update URL without adding to history
    setSearchParams(newParams, { replace: true });
  }, [searchText, socketCount, selectedItemTypes, selectedRunes, itemTypes, setSearchParams]);
}
