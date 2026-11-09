import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FILTER_URL_PARAM_KEYS, hasExactNameParam } from '@/core/utils/filterUrlParams';
import { parseExactNameParam } from '@/core/utils/exactName';
import { useExactNameFromUrl, type ExactNameFromUrl } from '@/core/hooks/useExactNameFromUrl';
import { useUrlArrival } from '@/core/hooks/useUrlArrival';
import { setSearchText, setExactName, setMaxReqLevel, setSelectedCategories } from '../store';
import { hasMythicalFilterParams, parseMythicalUrlParams } from '../utils/urlParams';

/**
 * Initializes mythical uniques filter state from URL query parameters (on mount and on a later arrival, see useUrlArrival).
 * After initialization, cleans the URL to keep it tidy while browsing.
 */
export function useUrlInitialize(): ExactNameFromUrl {
  const dispatch = useDispatch();
  const [, setSearchParams] = useSearchParams();
  const { nameFromUrl, clearExactName } = useExactNameFromUrl(setExactName, hasMythicalFilterParams);

  useUrlArrival({
    hasParams: (params) => hasExactNameParam(params) || hasMythicalFilterParams(params),
    apply: (searchParams) => {
      const exactName = parseExactNameParam(searchParams.get(FILTER_URL_PARAM_KEYS.NAME));
      const hasUrlParams = hasMythicalFilterParams(searchParams);

      // `name` itself is applied by useExactNameFromUrl; only the URL cleaning happens here (it needs the other params)
      if (exactName !== null && !hasUrlParams) {
        setSearchParams({}, { replace: true });
      }

      if (hasUrlParams) {
        const filters = parseMythicalUrlParams(searchParams);

        if (filters.searchText !== null) {
          dispatch(setSearchText(filters.searchText));
        }

        if (filters.maxReqLevel !== null) {
          dispatch(setMaxReqLevel(filters.maxReqLevel));
        }

        if (filters.categories !== null) {
          dispatch(setSelectedCategories(filters.categories));
        }

        // Clean the URL after initialization
        setSearchParams({}, { replace: true });
      }
    },
  });

  return { nameFromUrl, clearExactName };
}
