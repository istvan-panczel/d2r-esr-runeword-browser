import { useSelector } from 'react-redux';
import { selectSearchText, selectSelectedTypeCodesRaw, selectIncludeCouponItems } from '../store/uniqueItemsSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  TYPES: 'types',
  COUPON: 'coupon',
} as const;

/**
 * Returns a function that generates a shareable URL with current filter state.
 * Used by CopyLinkButton to create links that can be shared.
 */
export function useShareUrl(): () => string {
  const searchText = useSelector(selectSearchText);
  const selectedTypeCodes = useSelector(selectSelectedTypeCodesRaw);
  const includeCouponItems = useSelector(selectIncludeCouponItems);

  return () => {
    const params = new URLSearchParams();

    // Search: add if not empty
    if (searchText) {
      params.set(URL_PARAM_KEYS.SEARCH, searchText);
    }

    // Types: only add if NOT all selected (empty array = all selected)
    // Also skip if it's the special "__none__" marker
    if (selectedTypeCodes.length > 0 && selectedTypeCodes[0] !== '__none__') {
      params.set(URL_PARAM_KEYS.TYPES, selectedTypeCodes.join(','));
    }

    // Coupon: only add if excluding coupon items (default is true/include)
    if (!includeCouponItems) {
      params.set(URL_PARAM_KEYS.COUPON, '0');
    }

    const base = `${window.location.origin}${import.meta.env.BASE_URL}uniques`;
    return params.toString() ? `${base}?${params.toString()}` : base;
  };
}
