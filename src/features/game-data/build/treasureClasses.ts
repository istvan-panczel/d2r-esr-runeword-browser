/**
 * Treasure-class graph reverse-mapped to the monsters that can drop each item reference.
 *
 * A treasureclassex.txt `ItemN` cell is either another treasure class (a sub-TC) or an item reference: an item code,
 * a unique/set index, or an engine auto-TC (`weap54`, `armo96`, …). Auto-TCs are not rows of the table, so they end
 * up as plain item references that never match an item; they are deliberately not expanded (no level-band replica).
 */
import { resolveName } from './itemNames.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

export interface DropMonster {
  /** `m:<monstats Id>` or `s:<superuniques Superunique>` */
  key: string;
  name: string;
  /** One of its treasure classes leads to an endgame-map TC (`EGM …`, `Endgame Map …`) */
  map: boolean;
}

export interface TreasureClassIndex {
  /** Monsters whose treasure classes (any difficulty/variant) reach this item code or unique/set index */
  monstersFor(ref: string): DropMonster[];
}

/**
 * Endgame-map TC families. "Endgame Maps Tier N Campaign" (the maps themselves dropping in the campaign) is not one.
 * "Uber Loot Map Boss" is the root TC of the extra-loot dummy monster the engine spawns beside a map boss (monstats
 * `primordialsoulstoneloot`, MonStatsEx extrabossloot); since ESR 3.2.22 its Hell desecrated TCs lead to the Primordial
 * Soulstone, and without this entry that dummy would turn a maps-only drop into "Drops (random)". It has no row in
 * treasureclassex.txt, so the map test below also looks at the TC names the monster columns reference.
 */
const MAP_TC = /^(EGM |Endgame Map |Uber Loot Map Boss)/;

/** treasureclassex.txt has `Item1` … `Item10` */
const TC_ITEM_COLUMNS = 10;

/**
 * Monster display names that would be ambiguous or wrong: the clone reuses Diablo's name string, and so does the loot
 * dummy uber Lucion spawns when he dies on players 8 (his "Lucion Essence Drop" death skill; it drops Lucion's Essence).
 */
const NAME_OVERRIDES: Readonly<Partial<Record<string, string>>> = {
  diabloclone: 'Diablo Clone',
  extralucionloot: 'Uber Lucion (players 8)',
};

/** First comma-separated token of a cell, without quotes (`"01c,qty=3"` → `01c`). */
export function refOf(cell: string): string {
  return (cell.replace(/"/g, '').split(',')[0] ?? '').trim();
}

function addTo<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key);
  if (set === undefined) map.set(key, new Set([value]));
  else set.add(value);
}

export function createTreasureClassIndex(
  treasureClasses: TsvTable,
  monstats: TsvTable,
  superuniques: TsvTable,
  strings: ReadonlyMap<string, string>
): TreasureClassIndex {
  const names = new Set(treasureClasses.rows.map((row) => row.str('Treasure Class')).filter((name) => name !== ''));
  const parents = new Map<string, Set<string>>();
  const itemTcs = new Map<string, Set<string>>();
  for (const row of treasureClasses.rows) {
    const tc = row.str('Treasure Class');
    if (tc === '') continue;
    for (let i = 1; i <= TC_ITEM_COLUMNS; i++) {
      const column = `Item${String(i)}`;
      if (!row.has(column)) continue;
      const ref = refOf(row.str(column));
      if (ref === '') continue;
      addTo(names.has(ref) ? parents : itemTcs, ref, tc);
    }
  }

  // Root TC → monsters using it in any TreasureClass*/TC* column
  const monsters = new Map<string, DropMonster>();
  const roots = new Map<string, Set<string>>();
  const addMonster = (key: string, name: string, tcColumns: string[], row: TsvRow) => {
    monsters.set(key, { key, name, map: false });
    for (const column of tcColumns) {
      const tc = row.str(column);
      if (tc !== '') addTo(roots, tc, key);
    }
  };
  const monsterColumns = monstats.columns.filter((column) => column.startsWith('TreasureClass'));
  for (const row of monstats.rows) {
    const id = row.str('Id');
    if (id === '') continue;
    const name = NAME_OVERRIDES[id] ?? resolveName(strings, row.str('NameStr'), id);
    addMonster(`m:${id}`, name, monsterColumns, row);
  }
  const superColumns = superuniques.columns.filter((column) => column.startsWith('TC'));
  for (const row of superuniques.rows) {
    const id = row.str('Superunique');
    if (id === '') continue;
    addMonster(`s:${id}`, resolveName(strings, row.str('Name'), id), superColumns, row);
  }

  /** TCs reachable upward (towards the monster columns) from the start TCs, the start TCs included. */
  const ancestors = (start: Iterable<string>): Set<string> => {
    const seen = new Set<string>();
    const stack = [...start];
    for (let tc = stack.pop(); tc !== undefined; tc = stack.pop()) {
      if (seen.has(tc)) continue;
      seen.add(tc);
      for (const parent of parents.get(tc) ?? []) stack.push(parent);
    }
    return seen;
  };

  for (const tc of ancestors([...new Set([...names, ...roots.keys()])].filter((name) => MAP_TC.test(name)))) {
    for (const key of roots.get(tc) ?? []) {
      const monster = monsters.get(key);
      if (monster !== undefined) monster.map = true;
    }
  }

  return {
    monstersFor(ref) {
      const keys = new Set<string>();
      for (const tc of ancestors(itemTcs.get(ref) ?? [])) for (const key of roots.get(tc) ?? []) keys.add(key);
      return [...keys].flatMap((key) => monsters.get(key) ?? []);
    },
  };
}
