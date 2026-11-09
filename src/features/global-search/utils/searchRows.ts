import { homeSearchRowValue, SEARCH_RUNEWORDS_VALUE, type HomeSearchGroup } from '@/features/home/utils/homeSearch';
import type { PageSearchResult } from './pageSearch';

/**
 * The cmdk value of whichever row is currently first. cmdk keeps its selection when rows appear above it, and the names
 * arrive after the first render, so Enter would stay on the "Search runewords" row; this one value makes the selection
 * follow the first row. (Controlling cmdk's `value` instead makes it scroll to the previously selected row: it scrolls
 * before a controlled value reaches the DOM.)
 */
export const FIRST_ROW_VALUE = '__first-row';

export function pageRowValue(href: string): string {
  return `page:${href}`;
}

/** The value the first result row would otherwise have: the best page, else the best item, else "Search runewords". */
export function firstRowValue(pages: readonly PageSearchResult[], groups: readonly HomeSearchGroup[]): string {
  const page = pages.at(0);
  if (page !== undefined) return pageRowValue(page.href);
  const group = groups.at(0);
  const result = group?.results.at(0);
  return group !== undefined && result !== undefined ? homeSearchRowValue(group.category, result.href) : SEARCH_RUNEWORDS_VALUE;
}
