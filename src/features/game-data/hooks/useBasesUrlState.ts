import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { useUrlArrival } from '@/core/hooks/useUrlArrival';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { selectBaseFilters, setBaseFilters } from '../store/gameDataSlice';
import { BASE_FILTER_PARAM_KEYS, decodeBaseFilters, encodeBaseFilters, hasBaseFilterParams } from '../store/baseFiltersUrl';

const BASES_ROUTE = 'bases';

/**
 * URL ↔ Redux for the Bases page, following the runewords `useUrlInitialize` / `useShareUrl` pattern:
 * URL params (on mount or a later arrival, see useUrlArrival) replace the whole filter state and are then removed from the URL;
 * the returned function builds a share URL from the current filters.
 */
export function useBasesUrlState(knownTypes: ReadonlySet<string>): () => string {
  const dispatch = useDispatch();
  const filters = useSelector(selectBaseFilters);
  const [, setSearchParams] = useSearchParams();

  useUrlArrival({
    hasParams: hasBaseFilterParams,
    apply: (searchParams) => {
      if (!hasBaseFilterParams(searchParams)) return;

      dispatch(setBaseFilters(decodeBaseFilters(searchParams, knownTypes)));
      const remaining = new URLSearchParams(searchParams);
      for (const key of BASE_FILTER_PARAM_KEYS) remaining.delete(key);
      setSearchParams(remaining, { replace: true });
    },
  });

  return () => buildShareUrl(BASES_ROUTE, encodeBaseFilters(filters));
}
