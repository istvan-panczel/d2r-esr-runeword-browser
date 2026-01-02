import { useSelector } from 'react-redux';
import { selectSearchText, selectEnabledCategories, type EnabledCategories } from '../store/socketablesSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  CATEGORIES: 'categories',
} as const;

const ALL_CATEGORIES: (keyof EnabledCategories)[] = ['gems', 'esrRunes', 'lodRunes', 'kanjiRunes', 'crystals'];

/**
 * Returns a function that generates a shareable URL with current filter state.
 * Used by CopyLinkButton to create links that can be shared.
 */
export function useShareUrl(): () => string {
  const searchText = useSelector(selectSearchText);
  const enabledCategories = useSelector(selectEnabledCategories);

  return () => {
    const params = new URLSearchParams();

    // Search: add if not empty
    if (searchText) {
      params.set(URL_PARAM_KEYS.SEARCH, searchText);
    }

    // Categories: only add if NOT all enabled
    const allEnabled = ALL_CATEGORIES.every((cat) => enabledCategories[cat]);
    if (!allEnabled) {
      const enabledList = ALL_CATEGORIES.filter((cat) => enabledCategories[cat]);
      if (enabledList.length > 0) {
        params.set(URL_PARAM_KEYS.CATEGORIES, enabledList.join(','));
      }
    }

    const base = `${window.location.origin}${import.meta.env.BASE_URL}socketables`;
    return params.toString() ? `${base}?${params.toString()}` : base;
  };
}
