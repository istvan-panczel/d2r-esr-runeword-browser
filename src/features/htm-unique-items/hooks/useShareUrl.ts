import { useSelector } from 'react-redux';
import { selectSearchText, selectMaxReqLevel, selectSelectedCategoriesRaw, selectIncludeCouponItems } from '../store';
import { NO_CATEGORIES_MARKER } from '@/core/constants/categoryFilter';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  MAXLVL: 'maxlvl',
  CATS: 'cats',
  COUPON: 'coupon',
} as const;

/**
 * Returns a function that generates a shareable URL with current filter state.
 */
export function useShareUrl(): () => string {
  const searchText = useSelector(selectSearchText);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedCategories = useSelector(selectSelectedCategoriesRaw);
  const includeCouponItems = useSelector(selectIncludeCouponItems);

  return () => {
    const params = new URLSearchParams();

    if (searchText) {
      params.set(URL_PARAM_KEYS.SEARCH, searchText);
    }

    if (maxReqLevel !== null) {
      params.set(URL_PARAM_KEYS.MAXLVL, String(maxReqLevel));
    }

    if (selectedCategories.length > 0 && selectedCategories[0] !== NO_CATEGORIES_MARKER) {
      params.set(URL_PARAM_KEYS.CATS, selectedCategories.join(','));
    }

    if (!includeCouponItems) {
      params.set(URL_PARAM_KEYS.COUPON, '0');
    }

    const base = `${window.location.origin}${import.meta.env.BASE_URL}uniques`;
    return params.toString() ? `${base}?${params.toString()}` : base;
  };
}
