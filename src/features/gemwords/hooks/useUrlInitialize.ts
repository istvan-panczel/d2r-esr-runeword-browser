import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { readPersistentJson } from '@/core/hooks/usePersistentState';
import {
  FILTER_URL_PARAM_KEYS,
  MAX_REQ_LEVEL_RANGE,
  SOCKET_COUNT_RANGE,
  clearUrlSearchParams,
  decodeSelectionParam,
  parseBoundedIntParam,
} from '@/core/utils/filterUrlParams';
import { useAvailableItemTypes } from './useAvailableItemTypes';
import { useGemGroups } from './useGemGroups';
import { setSearchText, setSocketCount, setMaxReqLevel, setAllItemTypes, setAllGems } from '../store/gemwordsSlice';

export const GEMWORD_FILTER_STORAGE_KEY = 'd2r-esr.gemwords.filters.v1';

interface PersistedGemwordFilters {
  readonly searchText: string;
  readonly socketCount: number | null;
  readonly maxReqLevel: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
  readonly selectedGems: Record<string, boolean>;
}

const DEFAULT_PERSISTED_FILTERS: PersistedGemwordFilters = {
  searchText: '',
  socketCount: null,
  maxReqLevel: null,
  selectedItemTypes: {},
  selectedGems: {},
};

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return typeof value === 'object' && value !== null && Object.values(value).every((entry) => typeof entry === 'boolean');
}

function isPersistedGemwordFilters(value: unknown): value is PersistedGemwordFilters {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PersistedGemwordFilters>;

  return (
    typeof candidate.searchText === 'string' &&
    (candidate.socketCount === null || typeof candidate.socketCount === 'number') &&
    (candidate.maxReqLevel === null || typeof candidate.maxReqLevel === 'number') &&
    isBooleanRecord(candidate.selectedItemTypes) &&
    isBooleanRecord(candidate.selectedGems)
  );
}

function readStoredGemwordFilters(): PersistedGemwordFilters {
  return readPersistentJson(
    typeof window === 'undefined' ? null : window.localStorage,
    GEMWORD_FILTER_STORAGE_KEY,
    DEFAULT_PERSISTED_FILTERS,
    isPersistedGemwordFilters
  );
}

/**
 * Initializes gemword filter state from URL query parameters (one-time on mount),
 * falling back to the user's persisted filters when no params are present.
 * After URL initialization, cleans the URL to keep it tidy while browsing.
 * Use useShareUrl() to generate shareable URLs with current filter state.
 */
export function useUrlInitialize(): void {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const itemTypes = useAvailableItemTypes();
  const gemGroups = useGemGroups();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!itemTypes || itemTypes.length === 0) return;
    if (!gemGroups || gemGroups.length === 0) return;

    initializedRef.current = true;

    const allGemNames = gemGroups.flatMap((group) => group.gems.map((gem) => gem.name));
    const urlSearch = searchParams.get(FILTER_URL_PARAM_KEYS.SEARCH);
    const urlSockets = searchParams.get(FILTER_URL_PARAM_KEYS.SOCKETS);
    const urlMaxLvl = searchParams.get(FILTER_URL_PARAM_KEYS.MAXLVL);
    const urlItems = searchParams.get(FILTER_URL_PARAM_KEYS.ITEMS);
    const urlGems = searchParams.get(FILTER_URL_PARAM_KEYS.GEMS);
    const hasUrlParams = urlSearch !== null || urlSockets !== null || urlMaxLvl !== null || urlItems !== null || urlGems !== null;

    if (hasUrlParams) {
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

      dispatch(setAllItemTypes(decodeSelectionParam(itemTypes, urlItems)));
      dispatch(setAllGems(decodeSelectionParam(allGemNames, urlGems)));

      clearUrlSearchParams();
    } else {
      const storedFilters = readStoredGemwordFilters();

      dispatch(setSearchText(storedFilters.searchText));
      dispatch(setSocketCount(storedFilters.socketCount));
      dispatch(setMaxReqLevel(storedFilters.maxReqLevel));
      dispatch(setAllItemTypes(decodeSelectionParam(itemTypes, null, storedFilters.selectedItemTypes)));
      dispatch(setAllGems(decodeSelectionParam(allGemNames, null, storedFilters.selectedGems)));
    }
  }, [itemTypes, gemGroups, searchParams, dispatch]);
}
