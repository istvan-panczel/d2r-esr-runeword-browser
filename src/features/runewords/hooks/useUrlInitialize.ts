import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  FILTER_URL_PARAM_KEYS,
  MAX_REQ_LEVEL_RANGE,
  SOCKET_COUNT_RANGE,
  clearUrlSearchParams,
  decodeSelectionParam,
  parseBoundedIntParam,
} from '@/core/utils/filterUrlParams';
import { useRuneGroups } from './useRuneGroups';
import { useAvailableItemTypes } from './useAvailableItemTypes';
import { setSearchText, setSocketCount, setMaxReqLevel, setAllRunes, setAllItemTypes, setMaxTierPoints } from '../store/runewordsSlice';

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
    const urlSearch = searchParams.get(FILTER_URL_PARAM_KEYS.SEARCH);
    const urlSockets = searchParams.get(FILTER_URL_PARAM_KEYS.SOCKETS);
    const urlMaxLvl = searchParams.get(FILTER_URL_PARAM_KEYS.MAXLVL);
    const urlItems = searchParams.get(FILTER_URL_PARAM_KEYS.ITEMS);
    const urlRunes = searchParams.get(FILTER_URL_PARAM_KEYS.RUNES);
    const urlTierPts = searchParams.get(FILTER_URL_PARAM_KEYS.TIERPTS);

    const hasUrlParams =
      urlSearch !== null || urlSockets !== null || urlMaxLvl !== null || urlItems !== null || urlRunes !== null || urlTierPts !== null;

    if (hasUrlParams) {
      // Initialize from URL params
      if (urlSearch !== null) {
        dispatch(setSearchText(urlSearch));
      }

      const socketCount = parseBoundedIntParam(urlSockets, SOCKET_COUNT_RANGE);
      if (socketCount !== null) {
        dispatch(setSocketCount(socketCount));
      }

      const maxReqLevel = parseBoundedIntParam(urlMaxLvl, MAX_REQ_LEVEL_RANGE);
      if (maxReqLevel !== null) {
        dispatch(setMaxReqLevel(maxReqLevel));
      }

      // Item types / runes: if param exists, only those are selected; otherwise all selected
      dispatch(setAllItemTypes(decodeSelectionParam(itemTypes, urlItems)));
      dispatch(setAllRunes(decodeSelectionParam(allRuneKeys, urlRunes)));

      // Tier points: parse "esrRunes:1=64,lodRunes:2=128" format
      if (urlTierPts) {
        for (const entry of urlTierPts.split(',')) {
          const eqIndex = entry.indexOf('=');
          if (eqIndex === -1) continue;
          const tierKey = entry.substring(0, eqIndex);
          const value = parseInt(entry.substring(eqIndex + 1), 10);
          if (!isNaN(value) && value >= 0) {
            dispatch(setMaxTierPoints({ tierKey, value }));
          }
        }
      }

      // Clean the URL after initialization
      clearUrlSearchParams();
    } else {
      // No URL params - initialize with defaults (all selected)
      dispatch(setAllItemTypes(decodeSelectionParam(itemTypes, null)));
      dispatch(setAllRunes(decodeSelectionParam(allRuneKeys, null)));
    }
  }, [runeGroups, itemTypes, searchParams, dispatch]);
}
