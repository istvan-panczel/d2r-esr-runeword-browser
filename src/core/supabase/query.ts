// PostgREST query helpers shared by the Supabase-backed features (builds, loot filter sharing). Plain string logic:
// importing this does not pull in @supabase/supabase-js.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a string is a UUID. Row ids are uuid columns, so a malformed id (e.g. a hand-typed bad URL) would make
 * PostgREST error on the type cast rather than return zero rows — callers treat those as "not found" without querying.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** One column of a keyset cursor and its value on the last row of the current page. */
export interface KeysetColumn {
  readonly column: string;
  readonly value: string | number;
}

/**
 * The PostgREST `.or()` condition for the rows strictly after a cursor in an all-descending order
 * `(c1 desc, c2 desc, …, cn desc)`: `c1 < v1`, or `c1 = v1 and c2 < v2`, and so on. The last column should be unique
 * (the id) so the order is total and no row is skipped or repeated between pages.
 */
export function descendingKeysetFilter(columns: readonly KeysetColumn[]): string {
  return columns
    .map((current, index) => {
      const equal = columns.slice(0, index).map(({ column, value }) => `${column}.eq.${String(value)}`);
      const less = `${current.column}.lt.${String(current.value)}`;
      return equal.length === 0 ? less : `and(${[...equal, less].join(',')})`;
    })
    .join(',');
}
