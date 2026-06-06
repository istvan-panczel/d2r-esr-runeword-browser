import { useSelector } from 'react-redux';
import { FILTER_URL_PARAM_KEYS, appendCommonFilterParams, appendSelectionParam, buildShareUrl } from '@/core/utils/filterUrlParams';
import {
  selectSearchText,
  selectSocketCount,
  selectMaxReqLevel,
  selectSelectedItemTypes,
  selectSelectedRunes,
  selectMaxTierPoints,
} from '../store/runewordsSlice';

/**
 * Returns a function that generates a shareable URL with current filter state.
 * Used by CopyLinkButton to create links that can be shared.
 */
export function useShareUrl(): () => string {
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedRunes = useSelector(selectSelectedRunes);
  const maxTierPoints = useSelector(selectMaxTierPoints);

  return () => {
    const params = new URLSearchParams();
    appendCommonFilterParams(params, { searchText, socketCount, maxReqLevel, selectedItemTypes });
    appendSelectionParam(params, FILTER_URL_PARAM_KEYS.RUNES, selectedRunes);

    // Tier points: serialize non-null entries as "esrRunes:1=64,lodRunes:2=128"
    const tierPtsEntries = Object.entries(maxTierPoints)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => `${key}=${String(value)}`);
    if (tierPtsEntries.length > 0) {
      params.set(FILTER_URL_PARAM_KEYS.TIERPTS, tierPtsEntries.join(','));
    }

    return buildShareUrl('', params);
  };
}
