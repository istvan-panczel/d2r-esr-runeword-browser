import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSearchText, setMaxReqLevel, setSelectedTypeCodes, setIncludeCouponItems } from '../store/uniqueItemsSlice';

const URL_PARAM_KEYS = {
  SEARCH: 'search',
  MAXLVL: 'maxlvl',
  TYPES: 'types',
  COUPON: 'coupon',
} as const;

/**
 * Initializes unique items filter state from URL query parameters (one-time on mount).
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
    const urlMaxLvl = searchParams.get(URL_PARAM_KEYS.MAXLVL);
    const urlTypes = searchParams.get(URL_PARAM_KEYS.TYPES);
    const urlCoupon = searchParams.get(URL_PARAM_KEYS.COUPON);

    const hasUrlParams = urlSearch !== null || urlMaxLvl !== null || urlTypes !== null || urlCoupon !== null;

    if (hasUrlParams) {
      if (urlSearch !== null) {
        dispatch(setSearchText(urlSearch));
      }

      if (urlMaxLvl !== null) {
        const parsed = parseInt(urlMaxLvl, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 999) {
          dispatch(setMaxReqLevel(parsed));
        }
      }

      if (urlTypes !== null) {
        const typeCodes = urlTypes.split(',').filter(Boolean);
        if (typeCodes.length > 0) {
          dispatch(setSelectedTypeCodes(typeCodes));
        }
      }

      // Coupon: '0' means exclude coupon items, anything else or missing means include
      if (urlCoupon === '0') {
        dispatch(setIncludeCouponItems(false));
      }

      // Clean the URL after initialization
      window.history.replaceState({}, '', window.location.pathname);
    }
    // If no URL params, keep the default state from the slice
  }, [searchParams, dispatch]);
}
