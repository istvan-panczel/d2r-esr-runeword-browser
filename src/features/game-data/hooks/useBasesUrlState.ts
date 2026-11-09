import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { selectBaseFilters, setBaseFilters } from '../store/gameDataSlice';
import { BASE_FILTER_PARAM_KEYS, decodeBaseFilters, encodeBaseFilters, hasBaseFilterParams } from '../store/baseFiltersUrl';

const BASES_ROUTE = 'bases';

/**
 * URL ↔ Redux for the Bases page, following the runewords `useUrlInitialize` / `useShareUrl` pattern:
 * on mount, URL params (if any) replace the whole filter state and are then removed from the URL;
 * the returned function builds a share URL from the current filters.
 */
export function useBasesUrlState(knownTypes: ReadonlySet<string>): () => string {
  const dispatch = useDispatch();
  const filters = useSelector(selectBaseFilters);
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (!hasBaseFilterParams(searchParams)) return;

    dispatch(setBaseFilters(decodeBaseFilters(searchParams, knownTypes)));
    const remaining = new URLSearchParams(searchParams);
    for (const key of BASE_FILTER_PARAM_KEYS) remaining.delete(key);
    setSearchParams(remaining, { replace: true });
  }, [searchParams, setSearchParams, dispatch, knownTypes]);

  return () => buildShareUrl(BASES_ROUTE, encodeBaseFilters(filters));
}
