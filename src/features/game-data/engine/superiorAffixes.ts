/**
 * Which superior affix rows (qualityitems.txt) an item may roll and how likely each is, by the rules documented in ESR's
 * `d2rloader/config/celestialrayone.superior-affixes.toml`. Shared by the generator (pools) and the pages (per base).
 *
 * - A row with any `itype` rolls only on items whose type or type2 is one of them or below one in itemtypes.txt
 *   (Equiv1/Equiv2; `BaseItem.ancestors` is that union); its stock columns are then ignored.
 * - A row without itypes uses the stock columns, tested against the item's OWN type only:
 *   `weapon` = every weapon except own type scep, wand, staf, bow, xbow (so Amazon bows, orbs, claws use it);
 *   `armor` = every armor except own type shie, boot, glov, belt (so Paladin shields, heads, helms, circlets use it);
 *   `shield`, `scepter`, `wand`, `staff`, `boots`, `gloves`, `belt` = own type exactly shie, scep, wand, staf, boot,
 *   glov, belt; `bow` = own type exactly bow or xbow (Amazon bows do NOT count).
 * - `etype` always excludes, matched like itypes.
 * - Only weapons and armor roll Superior; misc items never match.
 * - The odds of a row are its weight divided by the summed weights of every row the item may use.
 */
import type { BaseItem, BasesBundle, SuperiorAffixes, SuperiorColumn, SuperiorRow } from './schema.ts';

/** What the rules read of an item: its file (kind), own type and the Equiv ancestors of type + type2. */
export type SuperiorItem = Pick<BaseItem, 'kind' | 'type' | 'ancestors'>;

const WEAPON_COLUMN_EXCEPT = new Set(['scep', 'wand', 'staf', 'bow', 'xbow']);
const ARMOR_COLUMN_EXCEPT = new Set(['shie', 'boot', 'glov', 'belt']);
const EXACT_COLUMN_TYPES: Readonly<Record<Exclude<SuperiorColumn, 'weapon' | 'armor'>, readonly string[]>> = {
  shield: ['shie'],
  scepter: ['scep'],
  wand: ['wand'],
  staff: ['staf'],
  bow: ['bow', 'xbow'],
  boots: ['boot'],
  gloves: ['glov'],
  belt: ['belt'],
};

/** The stock qualityitems.txt item-class column test (own type only, no Equiv walk). */
export function stockColumnAllows(column: SuperiorColumn, item: SuperiorItem): boolean {
  if (column === 'weapon') return item.kind === 'weapon' && !WEAPON_COLUMN_EXCEPT.has(item.type);
  if (column === 'armor') return item.kind === 'armor' && !ARMOR_COLUMN_EXCEPT.has(item.type);
  return EXACT_COLUMN_TYPES[column].includes(item.type);
}

/** Whether `row` may roll on `item` (weight not considered). */
export function superiorRowAllows(row: Pick<SuperiorRow, 'columns' | 'itypes' | 'etypes'>, item: SuperiorItem): boolean {
  if (item.kind === 'misc') return false;
  if (row.etypes.some((code) => item.ancestors.includes(code))) return false;
  if (row.itypes.length > 0) return row.itypes.some((code) => item.ancestors.includes(code));
  return row.columns.some((column) => stockColumnAllows(column, item));
}

export interface SuperiorRoll {
  row: SuperiorRow;
  /** weight / total; 0 for a weight-0 row (or when nothing can roll) */
  chance: number;
}

export interface SuperiorRolls {
  /** Rows the item may use, in row order (weight-0 rows included with chance 0) */
  rolls: SuperiorRoll[];
  /** Summed weights */
  total: number;
}

/** The rows `item` may roll with their chances; `limited` = only rows 0-3 (the stock throwing / nodurability rule). */
export function superiorRollsFor(rows: readonly SuperiorRow[], item: SuperiorItem, limited = false): SuperiorRolls {
  const allowed = rows.filter((row) => (!limited || row.row < 4) && superiorRowAllows(row, item));
  const total = allowed.reduce((sum, row) => sum + row.weight, 0);
  return { rolls: allowed.map((row) => ({ row, chance: total > 0 ? row.weight / total : 0 })), total };
}

/** `superiorRollsFor` for a base of the bundle (applies `firstFourRowBases`). */
export function superiorRollsForBase(superior: SuperiorAffixes, base: BaseItem): SuperiorRolls {
  return superiorRollsFor(superior.rows, base, superior.firstFourRowBases?.includes(base.code) === true);
}

/** A chance as a percentage: 1 decimal from 1%, 2 below, "<0.01%" for tiny non-zero chances. */
export function formatSuperiorChance(chance: number): string {
  if (chance <= 0) return '0%';
  const percent = chance * 100;
  if (percent < 0.01) return '<0.01%';
  return `${percent >= 1 ? percent.toFixed(1) : percent.toFixed(2)}%`;
}

/** The bundle's superior keys as one `SuperiorAffixes`; null for a bundle without them. */
export function readSuperiorAffixes(bundle: BasesBundle): SuperiorAffixes | null {
  const { superior, superiorRows, superiorPools } = bundle;
  if (superior === undefined || superiorRows === undefined || superiorPools === undefined) return null;
  return { ...superior, rows: superiorRows, pools: superiorPools };
}
