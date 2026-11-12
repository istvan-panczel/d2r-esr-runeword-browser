import type { AffixStat, LootFilterDataBundle, LootFilterItem, LootFilterUniqueOrSet } from '../engine/schema.ts';
import type { BuildResult } from './bundleTypes.ts';
import { ancientCouponCodes, couponCubeOutputs } from './coupons.ts';
import { readUniqueOrSetRows, resolveName } from './itemNames.ts';
import { optStr } from './model.ts';
import { distinctFamilyTier } from './tiers.ts';
import { refOf } from './treasureClasses.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

/**
 * Tables read by the loot-filter bundle. `itemstatcost`, `sounds`, `uniqueitems` and `setitems` are addressed by row
 * number, so they must be parsed with `keepExpansionRows` (the game counts every data row).
 */
export interface LootFilterTables {
  weapons: TsvTable;
  armor: TsvTable;
  misc: TsvTable;
  itemstatcost: TsvTable;
  levels: TsvTable;
  sounds: TsvTable;
  uniqueitems: TsvTable;
  setitems: TsvTable;
  treasureclassex: TsvTable;
  gems: TsvTable;
  cubemain: TsvTable;
}

/** treasureclassex.txt has `Item1` … `Item10` */
const TC_ITEM_COLUMNS = 10;

/**
 * Item codes a treasure class can drop although their row is not spawnable: every `Item*` cell of every treasure
 * class row that is an item code, plus the base code of every unique/set row a cell names by its `index`. A cell that
 * names another treasure class needs no expansion: that class's own row is scanned too.
 */
function treasureClassCodes(tables: LootFilterTables): Set<string> {
  const refs = new Set<string>();
  for (const row of tables.treasureclassex.rows) {
    if (row.str('Treasure Class') === '') continue;
    for (let i = 1; i <= TC_ITEM_COLUMNS; i++) {
      const column = `Item${String(i)}`;
      if (!row.has(column)) continue;
      const ref = refOf(row.str(column));
      if (ref !== '') refs.add(ref);
    }
  }
  const codes = new Set(refs);
  for (const [table, codeColumn] of [
    [tables.uniqueitems, 'code'],
    [tables.setitems, 'item'],
  ] as const) {
    for (const row of table.rows) {
      const code = row.str(codeColumn);
      if (code !== '' && refs.has(row.str('index'))) codes.add(code);
    }
  }
  return codes;
}

/**
 * A spawnable rune without a gems.txt row is an unused row: it has no socket stats, and no recipe or treasure class
 * makes it (ESR 3.2.24: only `r48` "Hu Rune", whose namestr makes it a second "Fu Rune"). Misc items only drop through
 * treasure classes, so spawnable alone does not prove a misc item drops; this narrow check catches the one row the data
 * proves dead without hiding engine drops (the essences) that no table names. ESR has no item type below `rune`.
 */
function isUnusedRune(type: string, code: string, gemCodes: ReadonlySet<string>): boolean {
  return type === 'rune' && !gemCodes.has(code);
}

/**
 * The colour code a string-table name starts in (`StringTable.colors`), when the key resolves to a name; a name taken
 * from the row's own `name` column (no string) has none.
 */
function nameColorOf(strings: ReadonlyMap<string, string>, colors: ReadonlyMap<string, string>, key: string): string | undefined {
  return resolveName(strings, key, '') === '' ? undefined : colors.get(key);
}

/** misc.txt / weapons.txt `quest` above 0: a quest item (not the `ques` item type: Key of Terror is one without the flag). */
function isQuestRow(row: TsvRow): boolean {
  return row.has('quest') && row.num('quest') > 0;
}

function readItemRows(
  tables: LootFilterTables,
  warnings: string[],
  strings: ReadonlyMap<string, string>,
  colors: ReadonlyMap<string, string>
): LootFilterItem[] {
  const dropCodes = treasureClassCodes(tables);
  const gemCodes = new Set(tables.gems.rows.map((row) => row.str('code')).filter((code) => code !== ''));
  const items: LootFilterItem[] = [];
  const seen = new Set<string>();
  for (const [kind, table] of [
    ['weapon', tables.weapons],
    ['armor', tables.armor],
    ['misc', tables.misc],
  ] as const) {
    for (const row of table.rows) {
      const code = row.str('code');
      if (code === '') continue;
      if (seen.has(code)) {
        warnings.push(`lootfilter: duplicate item code "${code}" (${row.str('name')}); kept the first row`);
        continue;
      }
      seen.add(code);
      const name = row.str('name');
      const spawnable = row.num('spawnable') === 1;
      const type2 = row.str('type2');
      // misc.txt has no tier families; neither do weapons/armor rows whose family points at themselves
      const tier =
        kind === 'misc' ? undefined : distinctFamilyTier(code, optStr(row, 'normcode'), optStr(row, 'ubercode'), optStr(row, 'ultracode'));
      const nameColor = nameColorOf(strings, colors, row.str('namestr'));
      items.push({
        code,
        name: resolveName(strings, row.str('namestr'), name),
        kind,
        type: row.str('type'),
        ...(type2 === '' ? {} : { type2 }),
        ...(tier === undefined ? {} : { tier }),
        spawnable,
        drops: dropCodes.has(code) || (spawnable && !isUnusedRune(row.str('type'), code, gemCodes)),
        ...(nameColor === undefined ? {} : { nameColor }),
        ...(isQuestRow(row) ? { quest: true as const } : {}),
      });
    }
  }
  return items;
}

/**
 * Rows with a base code, numbered by their 0-based data-row index (marker rows count but are not listed), with the
 * `lvl req` column, the `disabled` flag (only when set), the `coupon` flag (ids in `couponIds`) and, for set items,
 * the set's display name (`set` column).
 */
function lootFilterRows(
  table: TsvTable,
  codeColumn: 'code' | 'item',
  strings: ReadonlyMap<string, string>,
  colors: ReadonlyMap<string, string>,
  couponIds: ReadonlySet<number> = new Set()
): LootFilterUniqueOrSet[] {
  return readUniqueOrSetRows(table, codeColumn, strings).map(({ id, index, name, code, disabled }) => {
    const row = table.rows.at(id);
    const setId = codeColumn === 'item' && row?.has('set') === true ? row.str('set') : '';
    const nameColor = nameColorOf(strings, colors, index);
    return {
      id,
      name,
      code,
      reqLvl: row?.has('lvl req') === true ? row.num('lvl req') : 0,
      ...(setId === '' ? {} : { set: resolveName(strings, setId, setId) }),
      ...(disabled ? { disabled: true as const } : {}),
      ...(couponIds.has(id) ? { coupon: true as const } : {}),
      ...(nameColor === undefined ? {} : { nameColor }),
    };
  });
}

/**
 * Row ids of the coupon uniques: the uniqueitems.txt row an enabled Ancient Coupon cube recipe outputs. A cube output
 * names the unique by its `index`, which resolves to the first row with that index (a later duplicate is warned
 * about). A row that rolls as a random drop (`rarity` above 0) is no coupon unique even if a coupon recipe makes it
 * (warned about; none in ESR 3.2.24, where every coupon unique has `rarity` 0). Rows with `rarity` 0 that no coupon
 * makes (Annihilus, Gheed's Fortune, Voidforge in ESR 3.2.24) are not coupon uniques either.
 */
function couponUniqueIds(tables: LootFilterTables, warnings: string[]): Set<number> {
  const outputs = couponCubeOutputs(tables.cubemain, ancientCouponCodes(tables.misc));
  const ids = new Set<number>();
  const seen = new Set<string>();
  tables.uniqueitems.rows.forEach((row, id) => {
    const index = row.str('index');
    if (index === '' || row.str('code') === '' || !outputs.has(index)) return;
    if (seen.has(index)) {
      warnings.push(
        `lootfilter: unique ${String(id)} repeats the coupon unique index "${index}"; only the first row counts as a coupon unique`
      );
      return;
    }
    seen.add(index);
    if (row.has('rarity') && row.num('rarity') > 0) {
      warnings.push(
        `lootfilter: unique ${String(id)} (${index}) is cubed from an Ancient Coupon but has rarity ${row.str('rarity')}; not marked coupon`
      );
      return;
    }
    ids.add(id);
  });
  return ids;
}

/**
 * Every itemstatcost row by row number, with the affix browser's label (affixes.json `stats`) when an affix writes the
 * stat and the label is not just the stat name. Stats no affix writes get none: many ESR rows describe unrelated text.
 */
function lootFilterStats(itemstatcost: TsvTable, affixStats: readonly AffixStat[]): LootFilterDataBundle['stats'] {
  const labels = new Map(affixStats.map((stat) => [stat.id, stat.label]));
  return itemstatcost.rows.map((row, id) => {
    const name = row.str('Stat');
    const label = labels.get(id);
    return label === undefined || label === name ? { id, name } : { id, name, label };
  });
}

export function buildLootFilterBundle(
  tables: LootFilterTables,
  strings: ReadonlyMap<string, string>,
  /** The skill pickers' data (build/bundleLootFilterSkills.ts), appended to the bundle */
  skillData: Pick<LootFilterDataBundle, 'skills' | 'knownLayers' | 'skillNames'> = {},
  /** The stats affixes write, with the affix browser's labels (affixes.json `stats`), for the stat labels */
  affixStats: readonly AffixStat[] = [],
  /** The colour code each string starts its display line in (`StringTable.colors`), for the names' `nameColor` */
  colors: ReadonlyMap<string, string> = new Map()
): BuildResult<LootFilterDataBundle> {
  const warnings: string[] = [];
  const items = readItemRows(tables, warnings, strings, colors);

  const stats = lootFilterStats(tables.itemstatcost, affixStats);

  const areas: LootFilterDataBundle['areas'] = [];
  for (const row of tables.levels.rows) {
    if (row.str('Id') === '') continue;
    const levelName = row.str('LevelName');
    areas.push({
      id: row.num('Id'),
      name: resolveName(strings, levelName, levelName === '' ? row.str('Name') : levelName),
      act: row.num('Act'),
    });
  }

  const sounds = tables.sounds.rows.map((row) => row.str('Sound'));

  const uniques = lootFilterRows(tables.uniqueitems, 'code', strings, colors, couponUniqueIds(tables, warnings));
  const sets = lootFilterRows(tables.setitems, 'item', strings, colors);
  const codes = new Set(items.map((item) => item.code));
  for (const [label, entries] of [
    ['unique', uniques],
    ['set', sets],
  ] as const) {
    for (const entry of entries) {
      if (!codes.has(entry.code))
        warnings.push(`lootfilter: ${label} ${String(entry.id)} (${entry.name}) has unknown base code "${entry.code}"`);
    }
  }

  return { bundle: { items, stats, areas, sounds, uniques, sets, ...skillData }, warnings };
}
