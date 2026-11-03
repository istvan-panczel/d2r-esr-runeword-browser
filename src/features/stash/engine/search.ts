/**
 * The stash pages' text search: words and "quoted phrases" (parseSearchTerms), every term must match. A term that names
 * an item type ("belt", "helmet", "rings", "orb", "rune"; see itemTypes.ts) matches by the item's type chain, or as a
 * whole word of the item's other text (`typeWordText`: its own name and what is socketed in it, without the fields that
 * name its base and type), so "ring" finds rings and an item named "… Ring …" but not a plain Ring Mail, and "rune" or
 * "orb" still find "Ru Rune" in a socket and Milabrega's Orb. Any other term matches the page's text as a substring
 * ("sash" → the Sash only).
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
  /**
   * Lower-case text a type term may also match as a whole word: `text` without the fields that name the item's own base
   * and type (base name, type name, code, and the base name inside the item's name), so a base is found by its type only
   */
  readonly typeWordText: string;
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** `term` occurs in `text` starting at a word start ("ring" in "stone of jordan ring", "rings"; not in "tinkering") */
export function containsWord(text: string, term: string): boolean {
  if (term === '') return true;
  for (let at = text.indexOf(term); at !== -1; at = text.indexOf(term, at + 1)) {
    if (!isWordChar(text[at - 1])) return true;
  }
  return false;
}

/**
 * Every term matches: a type term by the type chain or as a word of `typeWordText`, a text term as a substring of
 * `text`; no terms match anything.
 */
export function matchesItemSearch(terms: readonly ItemSearchTerm[], target: SearchTarget): boolean {
  return terms.every(({ term, typeCodes }) =>
    typeCodes === null
      ? target.text.includes(term)
      : typeCodes.some((code) => target.typeCodes.includes(code)) || containsWord(target.typeWordText, term)
  );
}

/** `name` without the base name in it ("Ring Mail of the Fox" → " of the Fox"; a plain "Ring Mail" → "") */
export function withoutBaseName(name: string, baseName: string | null | undefined): string {
  return baseName === null || baseName === undefined || baseName === '' ? name : name.split(baseName).join(' ');
}

/** The lower-cased search text of some fields (nulls skipped) */
export function searchText(fields: readonly (string | null | undefined)[]): string {
  return fields
    .filter((field) => field !== null && field !== undefined && field !== '')
    .join('\n')
    .toLowerCase();
}
