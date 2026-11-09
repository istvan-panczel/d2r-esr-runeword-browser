import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FILTER_URL_PARAM_KEYS, hasExactNameParam } from '@/core/utils/filterUrlParams';
import { parseExactNameParam } from '@/core/utils/exactName';
import { useExactNameFromUrl, type ExactNameFromUrl } from '@/core/hooks/useExactNameFromUrl';
import { useUrlArrival } from '@/core/hooks/useUrlArrival';
import { setSearchText, setExactName, setMaxReqLevel, setSelectedCategories, setAcquisition, setTiers } from '../store';
import { hasHtmFilterParams, parseHtmUrlParams } from '../utils/urlParams';

/**
 * Initializes HTM unique items filter state from URL query parameters (on mount and on a later arrival, see useUrlArrival).
 * After initialization, cleans the URL to keep it tidy while browsing.
 */
export function useUrlInitialize(): ExactNameFromUrl {
  const dispatch = useDispatch();
  const [, setSearchParams] = useSearchParams();
  const { nameFromUrl, clearExactName } = useExactNameFromUrl(setExactName, hasHtmFilterParams);

  useUrlArrival({
    hasParams: (params) => hasExactNameParam(params) || hasHtmFilterParams(params),
    apply: (searchParams) => {
      const exactName = parseExactNameParam(searchParams.get(FILTER_URL_PARAM_KEYS.NAME));
      const hasUrlParams = hasHtmFilterParams(searchParams);

      // `name` itself is applied by useExactNameFromUrl; only the URL cleaning happens here (it needs the other params)
      if (exactName !== null && !hasUrlParams) {
        setSearchParams({}, { replace: true });
      }

      if (hasUrlParams) {
        const filters = parseHtmUrlParams(searchParams);

        if (filters.searchText !== null) {
          dispatch(setSearchText(filters.searchText));
        }

        if (filters.maxReqLevel !== null) {
          dispatch(setMaxReqLevel(filters.maxReqLevel));
        }

        if (filters.categories !== null) {
          dispatch(setSelectedCategories(filters.categories));
        }

        // `acq`, or the legacy `coupon=0` (→ "No coupon")
        if (filters.acquisition !== null) {
          dispatch(setAcquisition(filters.acquisition));
        }

        if (filters.tiers !== null) {
          dispatch(setTiers(filters.tiers));
        }

        // Clean the URL after initialization
        setSearchParams({}, { replace: true });
      }
    },
  });

  return { nameFromUrl, clearExactName };
}
