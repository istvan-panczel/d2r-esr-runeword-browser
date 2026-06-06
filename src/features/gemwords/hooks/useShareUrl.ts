import { useSelector } from 'react-redux';
import { FILTER_URL_PARAM_KEYS, appendCommonFilterParams, appendSelectionParam, buildShareUrl } from '@/core/utils/filterUrlParams';
import {
  selectSearchText,
  selectSocketCount,
  selectMaxReqLevel,
  selectSelectedItemTypes,
  selectSelectedGems,
} from '../store/gemwordsSlice';

/**
 * Returns a function that generates a shareable URL with current filter state.
 * Used by CopyLinkButton to create links that can be shared.
 */
export function useShareUrl(): () => string {
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedGems = useSelector(selectSelectedGems);

  return () => {
    const params = new URLSearchParams();
    appendCommonFilterParams(params, { searchText, socketCount, maxReqLevel, selectedItemTypes });
    appendSelectionParam(params, FILTER_URL_PARAM_KEYS.GEMS, selectedGems);
    return buildShareUrl('gemwords', params);
  };
}
