import { parseLootFilter } from '../engine/parse';
import type { SharedFilterLevel } from './types';

/** The `loot_filters` columns read from the file at save time. */
export interface FilterMetadata {
  readonly title: string | null;
  readonly author: string | null;
  readonly file_version: string | null;
  /** Enabled rules: the ones in the file's `rules` list (the `disabledRules` the plugin ignores are not counted). */
  readonly rule_count: number;
  /** The file's `filterLevels`, or null when it has none. */
  readonly levels: SharedFilterLevel[] | null;
}

// The table's check constraints: title / author / file_version up to 200 characters, levels up to 4 KB of jsonb text.
const TEXT_LIMIT = 200;
const LEVELS_BYTE_LIMIT = 4096;

/** Trims, clips to the column limit (by code point, like Postgres' char_length) and maps empty to null. */
function columnText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return null;
  const codePoints = Array.from(trimmed);
  return codePoints.length > TEXT_LIMIT ? codePoints.slice(0, TEXT_LIMIT).join('') : trimmed;
}

const encoder = new TextEncoder();

/** The `:` and `,` of a JSON value's structure (not inside strings): Postgres prints a space after each. */
function separators(value: unknown): number {
  if (Array.isArray(value)) return Math.max(value.length - 1, 0) + value.reduce((sum: number, entry) => sum + separators(entry), 0);
  if (typeof value !== 'object' || value === null) return 0;
  const entries = Object.values(value);
  // Per key a ": ", between keys a ", ".
  return entries.length + Math.max(entries.length - 1, 0) + entries.reduce((sum: number, entry) => sum + separators(entry), 0);
}

/**
 * The size of the levels as Postgres prints jsonb (`[{"id": 1, "name": "x"}, …]` or a per-language name object: a space
 * after each `:` and `,`).
 */
function jsonbTextBytes(levels: readonly SharedFilterLevel[]): number {
  return encoder.encode(JSON.stringify(levels)).length + separators(levels);
}

/** The file's levels, dropping trailing ones until they fit the column (a real filter has a handful). */
function columnLevels(levels: readonly SharedFilterLevel[] | undefined): SharedFilterLevel[] | null {
  if (levels === undefined || levels.length === 0) return null;
  const kept = levels.map(({ id, name }) => ({ id, name }));
  while (kept.length > 0 && jsonbTextBytes(kept) > LEVELS_BYTE_LIMIT) kept.pop();
  return kept.length > 0 ? kept : null;
}

/**
 * The list metadata of a filter file, read with the editor's lenient parser (comments and trailing commas allowed).
 * Pure; throws `JsoncSyntaxError` when the text is not readable JSON. A file that is JSON but not a filter yields empty
 * metadata: whether such a file may be saved is the caller's check (the parser's diagnostics), not this one's.
 */
export function filterMetadata(text: string): FilterMetadata {
  const { filter } = parseLootFilter(text);
  return {
    title: columnText(filter.title),
    author: columnText(filter.author),
    file_version: columnText(filter.version),
    rule_count: filter.rules.filter((rule) => rule.disabled !== true).length,
    levels: columnLevels(filter.filterLevels),
  };
}
