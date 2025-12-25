import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { initializeFromUrl, selectSearchText, selectEnabledCategories, type EnabledCategories } from '../store/socketablesSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  CATEGORIES: 'categories',
} as const;

const ALL_CATEGORIES: (keyof EnabledCategories)[] = ['gems', 'esrRunes', 'lodRunes', 'kanjiRunes', 'crystals'];

/**
 * Synchronizes socketables filter state with URL query parameters.
 * - On mount: parses URL params and initializes Redux state
 * - On state change: updates URL params (using replace to avoid history pollution)
 */
export function useUrlSync(): void {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  // Current Redux state
  const searchText = useSelector(selectSearchText);
  const enabledCategories = useSelector(selectEnabledCategories);

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
    }
    // If no URL params, keep the default state from the slice (all categories enabled)
  }, [searchParams, dispatch]);

  // Redux → URL (on state change)
  useEffect(() => {
    if (!initializedRef.current) return;

    const newParams = new URLSearchParams();

    // Search: add if not empty
    if (searchText) {
      newParams.set(URL_PARAM_KEYS.SEARCH, searchText);
    }

    // Categories: only add if NOT all enabled
    const allEnabled = ALL_CATEGORIES.every((cat) => enabledCategories[cat]);
    if (!allEnabled) {
      const enabledList = ALL_CATEGORIES.filter((cat) => enabledCategories[cat]);
      if (enabledList.length > 0) {
        newParams.set(URL_PARAM_KEYS.CATEGORIES, enabledList.join(','));
      }
    }

    setSearchParams(newParams, { replace: true });
  }, [searchText, enabledCategories, setSearchParams]);
}
