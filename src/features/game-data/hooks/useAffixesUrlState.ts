import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { selectAffixFilters, setAffixFilters } from '../store/gameDataSlice';
import { AFFIX_FILTER_PARAM_KEYS, decodeAffixFilters, encodeAffixFilters, hasAffixFilterParams } from '../store/affixFiltersUrl';

const AFFIXES_ROUTE = 'affixes';

/**
 * URL ↔ Redux for the Affixes page (same pattern as `useBasesUrlState`): on mount, URL params (if any) replace the whole
 * filter state and are then removed from the URL; the returned function builds a share URL from the current filters.
 */
export function useAffixesUrlState(knownTypes: ReadonlySet<string>, knownBases: ReadonlySet<string>): () => string {
  const dispatch = useDispatch();
  const filters = useSelector(selectAffixFilters);
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (!hasAffixFilterParams(searchParams)) return;

    dispatch(setAffixFilters(decodeAffixFilters(searchParams, { types: knownTypes, bases: knownBases })));
    const remaining = new URLSearchParams(searchParams);
    for (const key of AFFIX_FILTER_PARAM_KEYS) remaining.delete(key);
    setSearchParams(remaining, { replace: true });
  }, [searchParams, setSearchParams, dispatch, knownTypes, knownBases]);

  return () => buildShareUrl(AFFIXES_ROUTE, encodeAffixFilters(filters));
}
