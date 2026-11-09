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

/** The menu pages whose label matches `query`, ranked like the item results (`rankNames`). */
export function searchPages(query: string, entries: readonly NavEntry[], limit = HOME_SEARCH_GROUP_LIMIT): PageSearchResult[] {
  return rankNames(pageNames(entries), query, limit).map(({ name, id, section }) => ({ name, href: id, section }));
}
