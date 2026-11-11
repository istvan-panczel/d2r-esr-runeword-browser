/** The Storage tab's text filter: the All Items search (words, item type words, "phrases") over each section's item rows. */
import { matchesItemSearch, parseItemSearch } from '@/features/stash/engine/search';
import type { ItemTypeIndex } from '@/features/stash/engine/itemTypes';
import type { ItemSection } from './characterItems';

export interface FilteredSection {
  readonly section: ItemSection;
  /** The rows that match (all of them without a search) */
  readonly rows: ItemSection['rows'];
}

/** Each section with its matching rows; with a search, sections without a match are left out. */
export function filterStorageSections(sections: readonly ItemSection[], search: string, types: ItemTypeIndex | null): FilteredSection[] {
  const terms = parseItemSearch(search, types);
  if (terms.length === 0) return sections.map((section) => ({ section, rows: section.rows }));
  return sections.flatMap((section) => {
    const rows = section.rows.filter(({ row }) =>
      matchesItemSearch(terms, { text: row.search, typeCodes: row.info.typeChain, typeWordText: row.typeWordText })
    );
    return rows.length === 0 ? [] : [{ section, rows }];
  });
}
