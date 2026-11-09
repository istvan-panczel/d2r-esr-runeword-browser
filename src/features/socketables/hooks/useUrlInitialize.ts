import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FILTER_URL_PARAM_KEYS, decodeSelectionParam, hasExactNameParam } from '@/core/utils/filterUrlParams';
import { parseExactNameParam } from '@/core/utils/exactName';
import { useExactNameFromUrl, type ExactNameFromUrl } from '@/core/hooks/useExactNameFromUrl';
import { useUrlArrival } from '@/core/hooks/useUrlArrival';
import { initializeFromUrl, setExactName, SOCKETABLE_CATEGORIES } from '../store/socketablesSlice';

export const SOCKETABLE_URL_PARAM_KEYS = {
  CATEGORIES: 'categories',
  ONLY_HIGHEST: 'onlyHighest',
} as const;

function hasSocketableFilterParams(params: URLSearchParams): boolean {
  return (
    params.has(FILTER_URL_PARAM_KEYS.SEARCH) ||
    params.has(SOCKETABLE_URL_PARAM_KEYS.CATEGORIES) ||
    params.has(SOCKETABLE_URL_PARAM_KEYS.ONLY_HIGHEST)
  );
}

/**
 * Initializes socketables filter state from URL query parameters (on mount and on a later arrival, see useUrlArrival).
 * After initialization, cleans the URL to keep it tidy while browsing.
 * Use useShareUrl() to generate shareable URLs with current filter state.
 */
export function useUrlInitialize(): ExactNameFromUrl {
  const dispatch = useDispatch();
  const [, setSearchParams] = useSearchParams();
  const { nameFromUrl, clearExactName } = useExactNameFromUrl(setExactName, hasSocketableFilterParams);

  // URL → Redux
  useUrlArrival({
    hasParams: (params) => hasExactNameParam(params) || hasSocketableFilterParams(params),
    apply: (searchParams) => {
      const urlSearch = searchParams.get(FILTER_URL_PARAM_KEYS.SEARCH);
      const urlCategories = searchParams.get(SOCKETABLE_URL_PARAM_KEYS.CATEGORIES);
      const urlOnlyHighest = searchParams.get(SOCKETABLE_URL_PARAM_KEYS.ONLY_HIGHEST);
      const exactName = parseExactNameParam(searchParams.get(FILTER_URL_PARAM_KEYS.NAME));

      const hasUrlParams = hasSocketableFilterParams(searchParams);

      // `name` itself is applied by useExactNameFromUrl; only the URL cleaning happens here (it needs the other params)
      if (exactName !== null && !hasUrlParams) {
        setSearchParams({}, { replace: true });
      }

      if (hasUrlParams) {
        dispatch(
          initializeFromUrl({
            searchText: urlSearch ?? '',
            enabledCategories: decodeSelectionParam(SOCKETABLE_CATEGORIES, urlCategories),
            onlyHighestQuality: urlOnlyHighest !== null ? urlOnlyHighest !== 'false' : undefined,
          })
        );

        // Clean the URL after initialization
        setSearchParams({}, { replace: true });
      }
      // If no URL params, keep the default state from the slice (all categories enabled)
    },
  });

  return { nameFromUrl, clearExactName };
}
