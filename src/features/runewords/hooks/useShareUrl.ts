import { useSelector } from 'react-redux';
import { selectSearchText, selectSocketCount, selectSelectedItemTypes, selectSelectedRunes } from '../store/runewordsSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  SOCKETS: 'sockets',
  ITEMS: 'items',
  RUNES: 'runes',
} as const;

/**
 * Returns a function that generates a shareable URL with current filter state.
 * Used by CopyLinkButton to create links that can be shared.
 */
export function useShareUrl(): () => string {
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedRunes = useSelector(selectSelectedRunes);

  return () => {
    const params = new URLSearchParams();

    // Search: add if not empty
    if (searchText) {
      params.set(URL_PARAM_KEYS.SEARCH, searchText);
    }

    // Sockets: add if set
    if (socketCount !== null) {
      params.set(URL_PARAM_KEYS.SOCKETS, String(socketCount));
    }

    // Items: only add if NOT all selected
    const itemKeys = Object.keys(selectedItemTypes);
    if (itemKeys.length > 0) {
      const allItemsSelected = Object.values(selectedItemTypes).every(Boolean);
      if (!allItemsSelected) {
        const selectedItems = itemKeys.filter((k) => selectedItemTypes[k]);
        if (selectedItems.length > 0) {
          params.set(URL_PARAM_KEYS.ITEMS, selectedItems.join(','));
        }
      }
    }

    // Runes: only add if NOT all selected
    const runeKeys = Object.keys(selectedRunes);
    if (runeKeys.length > 0) {
      const allRunesSelected = Object.values(selectedRunes).every(Boolean);
      if (!allRunesSelected) {
        const selectedRuneKeys = runeKeys.filter((k) => selectedRunes[k]);
        if (selectedRuneKeys.length > 0) {
          params.set(URL_PARAM_KEYS.RUNES, selectedRuneKeys.join(','));
        }
      }
    }

    const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
    return params.toString() ? `${base}?${params.toString()}` : base;
  };
}
