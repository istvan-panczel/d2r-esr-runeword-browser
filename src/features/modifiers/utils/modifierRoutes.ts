/** The /modifiers route and its URL params (kept apart so the home search can link without the page's code) */
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';

export const MODIFIERS_ROUTE = 'modifiers';

export const MODIFIERS_URL_PARAMS = {
  KIND: 'kind',
  CATEGORY: 'category',
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
  VIEW: 'view',
} as const;
