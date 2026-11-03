/**
 * The stash pages' text search: words and "quoted phrases" (parseSearchTerms), every term must match. A term that names
 * an item type ("belt", "helmet", "rings"; see itemTypes.ts) matches by the item's type chain only, so "ring" finds
 * rings but not Ring Mail; any other term matches the page's text as a substring ("sash" → the Sash only).
 */
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { typeCodesOfTerm, type ItemTypeIndex } from './itemTypes';

export interface ItemSearchTerm {
  /** Lower-case word or phrase */
  readonly term: string;
  /** The item type codes the term names, null when it names no type (then it is a text term) */
  readonly typeCodes: readonly string[] | null;
}

/** The terms of a search box value; without a types index every term is a text term */
export function parseItemSearch(search: string, types: ItemTypeIndex | null): ItemSearchTerm[] {
  return parseSearchTerms(search).map((term) => ({ term, typeCodes: types === null ? null : typeCodesOfTerm(term, types) }));
}

export interface SearchTarget {
  /** Lower-case text the text terms search (join the fields with "\n" so a term cannot span two of them) */
  readonly text: string;
  /** The item's type chain (type codes with their ancestors) */
  readonly typeCodes: readonly string[];
}

/** Every term matches: a type term by the type chain, a text term as a substring of `text`; no terms match anything. */
export function matchesItemSearch(terms: readonly ItemSearchTerm[], target: SearchTarget): boolean {
  return terms.every(({ term, typeCodes }) =>
    typeCodes === null ? target.text.includes(term) : typeCodes.some((code) => target.typeCodes.includes(code))
  );
}

/** The lower-cased search text of some fields (nulls skipped) */
export function searchText(fields: readonly (string | null | undefined)[]): string {
  return fields
    .filter((field) => field !== null && field !== undefined && field !== '')
    .join('\n')
    .toLowerCase();
}
