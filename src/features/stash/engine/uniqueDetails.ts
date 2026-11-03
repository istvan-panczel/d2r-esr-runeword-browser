/**
 * The Uniques page item (HTM docs data) of a coupon's unique, for "Show all item information". Names are matched the
 * way the `?name=` links match (normaliseItemName); a name the docs list twice (ESR's two Azurewraths) is told apart
 * by the base code.
 */
import { normaliseItemName } from '@/core/utils/itemName';
import type { HtmUniqueItem } from '@/core/db';

export type UniqueDetailsIndex = ReadonlyMap<string, readonly HtmUniqueItem[]>;

export function indexUniqueDetails(items: readonly HtmUniqueItem[]): UniqueDetailsIndex {
  const index = new Map<string, HtmUniqueItem[]>();
  for (const item of items) {
    const key = normaliseItemName(item.name);
    index.set(key, [...(index.get(key) ?? []), item]);
  }
  return index;
}

/** The docs item of a unique, preferring the one on `baseCode`; undefined when the docs do not list the name. */
export function findUniqueDetails(index: UniqueDetailsIndex, name: string, baseCode: string | null): HtmUniqueItem | undefined {
  const items = index.get(normaliseItemName(name)) ?? [];
  return items.find((item) => baseCode !== null && item.baseItemCode === baseCode) ?? items.at(0);
}
