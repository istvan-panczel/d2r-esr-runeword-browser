import type { NavEntry } from '@/core/navigation/navConfig';
import { HOME_SEARCH_GROUP_LIMIT, rankNames, type HomeSearchResult } from '@/features/home/utils/homeSearch';

export interface PageSearchResult extends HomeSearchResult {
  /** The menu group the page sits in; plain links have none */
  readonly section: string | null;
}

interface PageName {
  readonly name: string;
  readonly id: string;
  readonly section: string | null;
}

function pageNames(entries: readonly NavEntry[]): PageName[] {
  return entries.flatMap((entry): PageName[] =>
    entry.kind === 'group'
      ? entry.items.map((item) => ({ name: item.label, id: item.to, section: entry.label }))
      : [{ name: entry.item.label, id: entry.item.to, section: null }]
  );
}

/**
 * The menu pages matching `query`, at most `limit`: those whose own label matches, ranked like the item results (`rankNames`),
 * then the pages of the menu groups whose label matches, in menu order ("stash" lists the My Stash pages).
 */
export function searchPages(query: string, entries: readonly NavEntry[], limit = HOME_SEARCH_GROUP_LIMIT): PageSearchResult[] {
  const pages = pageNames(entries);
  const byLabel = rankNames(pages, query, limit);
  const listed = new Set(byLabel.map((page) => page.id));
  const groupLabels = entries.flatMap((entry) => (entry.kind === 'group' ? [entry.label] : []));
  const byGroup = rankNames(groupLabels, query, limit).flatMap((label) =>
    pages.filter((page) => page.section === label && !listed.has(page.id))
  );
  return [...byLabel, ...byGroup].slice(0, limit).map(({ name, id, section }) => ({ name, href: id, section }));
}
