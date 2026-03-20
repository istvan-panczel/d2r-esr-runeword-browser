import { useStore } from 'react-redux';
import type { RootState } from '@/core/store/store';
import { selectSearchText, selectSelectedCategoriesRaw } from '../store';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  CATS: 'cats',
} as const;

/**
 * Returns a function that generates a shareable URL with current filter state.
 * Reads state at call time via store.getState() to avoid stale closures.
 */
export function useShareUrl(): () => string {
  const store = useStore<RootState>();

  return () => {
    const state = store.getState();
    const searchText = selectSearchText(state);
    const selectedCategories = selectSelectedCategoriesRaw(state);

    const params = new URLSearchParams();

    if (searchText) {
      params.set(URL_PARAM_KEYS.SEARCH, searchText);
    }

    if (selectedCategories.length > 0 && selectedCategories[0] !== '__none__') {
      params.set(URL_PARAM_KEYS.CATS, selectedCategories.join(','));
    }

    const base = `${window.location.origin}${import.meta.env.BASE_URL}mythicals`;
    return params.toString() ? `${base}?${params.toString()}` : base;
  };
}
