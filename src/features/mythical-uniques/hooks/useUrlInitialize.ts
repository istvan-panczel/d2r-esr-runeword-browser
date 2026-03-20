import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSearchText, setSelectedCategories } from '../store';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  CATS: 'cats',
} as const;

/**
 * Initializes mythical uniques filter state from URL query parameters (one-time on mount).
 * After initialization, cleans the URL to keep it tidy while browsing.
 */
export function useUrlInitialize(): void {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const urlSearch = searchParams.get(URL_PARAM_KEYS.SEARCH);
    const urlCats = searchParams.get(URL_PARAM_KEYS.CATS);

    const hasUrlParams = urlSearch !== null || urlCats !== null;

    if (hasUrlParams) {
      if (urlSearch !== null) {
        dispatch(setSearchText(urlSearch));
      }

      if (urlCats !== null) {
        const categories = urlCats.split(',').filter(Boolean);
        if (categories.length > 0) {
          dispatch(setSelectedCategories(categories));
        }
      }

      // Clean the URL after initialization
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, dispatch]);
}
