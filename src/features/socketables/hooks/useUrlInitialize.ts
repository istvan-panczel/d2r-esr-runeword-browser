import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { initializeFromUrl, type EnabledCategories } from '../store/socketablesSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  CATEGORIES: 'categories',
} as const;

/**
 * Initializes socketables filter state from URL query parameters (one-time on mount).
 * After initialization, cleans the URL to keep it tidy while browsing.
 * Use useShareUrl() to generate shareable URLs with current filter state.
 */
export function useUrlInitialize(): void {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  // Track initialization state
  const initializedRef = useRef(false);

  // URL → Redux (on mount)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const urlSearch = searchParams.get(URL_PARAM_KEYS.SEARCH);
    const urlCategories = searchParams.get(URL_PARAM_KEYS.CATEGORIES);

    const hasUrlParams = urlSearch !== null || urlCategories !== null;

    if (hasUrlParams) {
      const categoriesFromUrl = urlCategories ? new Set(urlCategories.split(',')) : null;

      const decodedCategories: EnabledCategories = {
        gems: categoriesFromUrl ? categoriesFromUrl.has('gems') : true,
        esrRunes: categoriesFromUrl ? categoriesFromUrl.has('esrRunes') : true,
        lodRunes: categoriesFromUrl ? categoriesFromUrl.has('lodRunes') : true,
        kanjiRunes: categoriesFromUrl ? categoriesFromUrl.has('kanjiRunes') : true,
        crystals: categoriesFromUrl ? categoriesFromUrl.has('crystals') : true,
      };

      dispatch(
        initializeFromUrl({
          searchText: urlSearch ?? '',
          enabledCategories: decodedCategories,
        })
      );

      // Clean the URL after initialization
      window.history.replaceState({}, '', window.location.pathname);
    }
    // If no URL params, keep the default state from the slice (all categories enabled)
  }, [searchParams, dispatch]);
}
