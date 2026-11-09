import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { selectBestBaseOptions, selectCharacter, setBestBaseRuneword, updateCharacter } from '../store/gameDataSlice';
import { BEST_BASE_PARAM_KEYS, decodeBestBaseParams, encodeBestBaseParams, hasBestBaseParams } from '../store/bestBaseUrl';

const BEST_BASE_ROUTE = 'best-base';

/**
 * URL ↔ Redux for the Best Base page (runewords `useUrlInitialize` / `useShareUrl` pattern): on mount, `rw`/`v`
 * select the runeword and `cls`/`lvl`/`str`/`dex` override (and persist) the character; the params are then removed
 * from the URL. The returned function builds a share URL from the current state.
 */
export function useBestBaseUrlState(): () => string {
  const dispatch = useDispatch();
  const character = useSelector(selectCharacter);
  const { selected } = useSelector(selectBestBaseOptions);
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (!hasBestBaseParams(searchParams)) return;

    const decoded = decodeBestBaseParams(searchParams);
    if (decoded.selected !== null) dispatch(setBestBaseRuneword(decoded.selected));
    if (Object.keys(decoded.character).length > 0) dispatch(updateCharacter(decoded.character));
    const remaining = new URLSearchParams(searchParams);
    for (const key of BEST_BASE_PARAM_KEYS) remaining.delete(key);
    setSearchParams(remaining, { replace: true });
  }, [searchParams, setSearchParams, dispatch]);

  return () => buildShareUrl(BEST_BASE_ROUTE, encodeBestBaseParams(selected, character));
}
