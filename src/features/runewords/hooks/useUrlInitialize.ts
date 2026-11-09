import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  FILTER_URL_PARAM_KEYS,
  MAX_REQ_LEVEL_RANGE,
  decodeSelectionParam,
  parseBoundedIntParam,
  parseSocketRangeParam,
  parseMatchModeParam,
  hasExactNameParam,
} from '@/core/utils/filterUrlParams';
import { parseExactNameParam } from '@/core/utils/exactName';
import { useUrlArrival } from '@/core/hooks/useUrlArrival';
import { useExactNameFromUrl, type ExactNameFromUrl } from '@/core/hooks/useExactNameFromUrl';
import { useRuneGroups } from './useRuneGroups';
import { useAvailableItemTypes } from './useAvailableItemTypes';
import {
  setSearchText,
  setExactName,
  setSocketRange,
  setMaxReqLevel,
  setAllRunes,
  setAllItemTypes,
  setMaxTierPoints,
  setRuneMatchMode,
} from '../store/runewordsSlice';

const RUNEWORD_FILTER_PARAM_KEYS = [
  FILTER_URL_PARAM_KEYS.SEARCH,
  FILTER_URL_PARAM_KEYS.SOCKETS,
  FILTER_URL_PARAM_KEYS.MAXLVL,
  FILTER_URL_PARAM_KEYS.ITEMS,
  FILTER_URL_PARAM_KEYS.RUNES,
  FILTER_URL_PARAM_KEYS.TIERPTS,
  FILTER_URL_PARAM_KEYS.RUNEMODE,
];

function hasRunewordFilterParams(params: URLSearchParams): boolean {
  return RUNEWORD_FILTER_PARAM_KEYS.some((key) => params.has(key));
}

/**
 * Initializes runeword filter state from URL query parameters (on mount and on a later arrival, see useUrlArrival).
 * After initialization, cleans the URL to keep it tidy while browsing.
 * Use useShareUrl() to generate shareable URLs with current filter state.
 */
export function useUrlInitialize(): ExactNameFromUrl {
  const dispatch = useDispatch();
  const [, setSearchParams] = useSearchParams();
  const { nameFromUrl, clearExactName } = useExactNameFromUrl(setExactName, hasRunewordFilterParams);

  // Available options from DB
  const runeGroups = useRuneGroups();
  const itemTypes = useAvailableItemTypes();

  // URL → Redux (once data is loaded)
  useUrlArrival({
    ready: Boolean(runeGroups?.length) && Boolean(itemTypes?.length),
    hasParams: (params) => hasExactNameParam(params) || hasRunewordFilterParams(params),
    apply: (searchParams, firstMount) => {
      if (!runeGroups || !itemTypes) return;

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
      const urlRuneMode = searchParams.get(FILTER_URL_PARAM_KEYS.RUNEMODE);
      const exactName = parseExactNameParam(searchParams.get(FILTER_URL_PARAM_KEYS.NAME));

      const hasUrlParams = hasRunewordFilterParams(searchParams);

      // `name` itself is applied by useExactNameFromUrl; only the URL cleaning happens here (it needs the other params)
      if (exactName !== null && !hasUrlParams) {
        setSearchParams({}, { replace: true });
      }

      if (hasUrlParams) {
        // Initialize from URL params
        if (urlSearch !== null) {
          dispatch(setSearchText(urlSearch));
        }

        const socketRange = parseSocketRangeParam(urlSockets);
        if (socketRange !== null) {
          dispatch(setSocketRange(socketRange));
        }

        const maxReqLevel = parseBoundedIntParam(urlMaxLvl, MAX_REQ_LEVEL_RANGE);
        if (maxReqLevel !== null) {
          dispatch(setMaxReqLevel(maxReqLevel));
        }

        // Item types / runes: if param exists, only those are selected; otherwise all selected
        dispatch(setAllItemTypes(decodeSelectionParam(itemTypes, urlItems)));
        dispatch(setAllRunes(decodeSelectionParam(allRuneKeys, urlRunes)));

        const runeMatchMode = parseMatchModeParam(urlRuneMode);
        if (runeMatchMode !== null) {
          dispatch(setRuneMatchMode(runeMatchMode));
        }

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
        setSearchParams({}, { replace: true });
      } else if (firstMount) {
        // No URL params - initialize with defaults (all selected). Only on mount: a later `?name=` arrival keeps the filters
        dispatch(setAllItemTypes(decodeSelectionParam(itemTypes, null)));
        dispatch(setAllRunes(decodeSelectionParam(allRuneKeys, null)));
      }
    },
  });

  return { nameFromUrl, clearExactName };
}
