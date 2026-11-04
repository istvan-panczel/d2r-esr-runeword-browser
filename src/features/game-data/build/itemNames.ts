import type { TsvTable } from './tsv.ts';

/**
 * Display text of a (colour-stripped) string-table entry. Multi-line item names are drawn bottom-up in game, so the
 * last line is the name and the lines above it are descriptors: "(Buckler, Pelta Lunata)\nAncient Coupon" →
 * "Ancient Coupon (Buckler, Pelta Lunata)".
 */
export function displayName(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .reverse()
    .join(' ');
}

/** Display name of a string-table key, or `fallback` when the key is missing or blank. */
export function resolveName(strings: ReadonlyMap<string, string>, key: string, fallback: string): string {
  const text = displayName(strings.get(key) ?? '');
  return text === '' ? fallback : text;
}

/**
 * Display name of a weapons / armor / misc.txt row (`namestr`, else `name`), as stashnames.json `bases` lists it. ESR
 * abbreviates potion and scroll names for the belt ("*HP1", "*Thaw", "+TP"): the `name` column reads in full then (as
 * the cube names do, cube/cubeRows.ts).
 */
export function itemRowName(strings: ReadonlyMap<string, string>, namestr: string, name: string): string {
  const shown = resolveName(strings, namestr, name);
  return /^[*+]/.test(shown) && name !== '' ? name : shown;
}

/** A uniqueitems.txt / setitems.txt row with a base code: its `index` key and the string-resolved display name. */
export interface UniqueOrSetRow {
  /** 0-based data-row number (row-numbered when the table was parsed with `keepExpansionRows`) */
  readonly id: number;
  /** The `index` column (string-table key and the slug source of the HD art maps) */
  readonly index: string;
  readonly name: string;
  /** Base item code (`code` in uniqueitems.txt, `item` in setitems.txt) */
  readonly code: string;
  readonly disabled: boolean;
  /** `invtransform`: colors.txt code the inventory art is recoloured with (blank: none) */
  readonly invTransform: string;
}

/** The rows of uniqueitems.txt (`codeColumn` = `code`) or setitems.txt (`item`) that name a base; others are skipped. */
export function readUniqueOrSetRows(table: TsvTable, codeColumn: 'code' | 'item', strings: ReadonlyMap<string, string>): UniqueOrSetRow[] {
  const entries: UniqueOrSetRow[] = [];
  table.rows.forEach((row, id) => {
    const code = row.str(codeColumn);
    if (code === '') return;
    const index = row.str('index');
    entries.push({
      id,
      index,
      name: resolveName(strings, index, index),
      code,
      disabled: row.has('disabled') && row.str('disabled') === '1',
      invTransform: row.has('invtransform') ? row.str('invtransform') : '',
    });
  });
  return entries;
}
