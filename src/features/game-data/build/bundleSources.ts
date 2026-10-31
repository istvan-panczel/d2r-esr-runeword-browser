/**
 * sources.json: qualitative "where does this item come from" labels for uniques, set items and crafting-relevant misc
 * items. See docs/features/GAME-DATA.md "Sources" for the rules and their limitations.
 */
import type { ItemSource, SourceKind, SourceLabel, SourcesBundle } from '../engine/schema.ts';
import { ancientCouponCodes, cubeInputRefs, CUBE_OUTPUTS } from './coupons.ts';
import { resolveName } from './itemNames.ts';
import { optNum, optStr } from './model.ts';
import { readBossSetUniqueDrops } from './pluginUniques.ts';
import { createTreasureClassIndex, refOf, type DropMonster, type TreasureClassIndex } from './treasureClasses.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

export interface SourceTables {
  uniqueitems: TsvTable;
  setitems: TsvTable;
  weapons: TsvTable;
  armor: TsvTable;
  misc: TsvTable;
  cubemain: TsvTable;
  treasureclassex: TsvTable;
  monstats: TsvTable;
  superuniques: TsvTable;
  gamble: TsvTable;
}

const KIND_ORDER: readonly SourceKind[] = ['cube', 'boss', 'maps', 'drop', 'buy', 'gamble', 'plugin', 'unknown'];

/** NPCs with `<Npc>Min` / `<Npc>Max` columns on the item tables */
const VENDORS = [
  'Charsi',
  'Gheed',
  'Akara',
  'Fara',
  'Lysander',
  'Drognan',
  'Hratli',
  'Alkor',
  'Ormus',
  'Elzix',
  'Asheara',
  'Cain',
  'Halbu',
  'Malah',
  'Larzuk',
  'Anya',
  'Jamella',
] as const;

/** At most this many distinct monsters → "Drops from <monsters>" instead of a generic drop label */
const BOSS_MAX_MONSTERS = 5;
/** Items of this level or higher only roll from monster level ≥ 100, i.e. endgame-map monsters */
const MAP_ITEM_LEVEL = 100;

const DROP_MAPS_TEXT = 'Drops in Endgame Maps';
const DROP_RANDOM_TEXT = 'Drops (random)';

/** Misc types that are never interesting as a source (potions, scrolls, tomes, keys, gold, ammo) */
const NOISE_TYPES = new Set(['hpot', 'mpot', 'rpot', 'spot', 'apot', 'wpot', 'scro', 'book', 'key', 'gold', 'tpot', 'bowq', 'xboq']);

interface BaseRow {
  kind: 'weapon' | 'armor' | 'misc';
  row: TsvRow;
}

interface CubeIndex {
  /** Output ref → whether a creating row uses an Ancient Coupon / a creating row does not */
  made: Map<string, { coupon: boolean; plain: boolean }>;
  /** Every ref used as an input of an enabled row */
  inputs: Set<string>;
}

/** What the label rules look up, built once per bundle */
interface SourceContext {
  bases: ReadonlyMap<string, BaseRow>;
  cube: CubeIndex;
  drops: TreasureClassIndex;
  gamble: ReadonlySet<string>;
}

function label(kind: SourceKind, text: string): SourceLabel {
  return { kind, text };
}

function indexBases(tables: SourceTables): Map<string, BaseRow> {
  const bases = new Map<string, BaseRow>();
  for (const [kind, table] of [
    ['weapon', tables.weapons],
    ['armor', tables.armor],
    ['misc', tables.misc],
  ] as const) {
    for (const row of table.rows) {
      const code = row.str('code');
      if (code !== '' && !bases.has(code)) bases.set(code, { kind, row });
    }
  }
  return bases;
}

function indexCube(cubemain: TsvTable, couponCodes: ReadonlySet<string>): CubeIndex {
  const made = new Map<string, { coupon: boolean; plain: boolean }>();
  const inputs = new Set<string>();
  for (const row of cubemain.rows) {
    if (row.num('enabled') !== 1) continue;
    const rowInputs = cubeInputRefs(row);
    for (const input of rowInputs) inputs.add(input);
    const coupon = rowInputs.some((input) => couponCodes.has(input));
    for (const column of CUBE_OUTPUTS) {
      if (!row.has(column)) continue;
      const output = refOf(row.str(column));
      if (output === '' || rowInputs.includes(output)) continue; // rerolls do not create the item
      const entry = made.get(output) ?? { coupon: false, plain: false };
      if (coupon) entry.coupon = true;
      else entry.plain = true;
      made.set(output, entry);
    }
  }
  return { made, inputs };
}

function cubeLabels({ cube }: SourceContext, ref: string): SourceLabel[] {
  const made = cube.made.get(ref);
  if (made === undefined) return [];
  return [...(made.coupon ? [label('cube', 'Cube: Ancient Coupon')] : []), ...(made.plain ? [label('cube', 'Cube')] : [])];
}

/** Labels from treasure classes naming this ref directly */
function namedDropLabels(monsters: DropMonster[]): SourceLabel[] {
  const names = [...new Set(monsters.map((monster) => monster.name))].sort((a, b) => a.localeCompare(b));
  if (names.length === 0) return [];
  if (names.length <= BOSS_MAX_MONSTERS) return [label('boss', `Drops from ${names.join(', ')}`)];
  return monsters.every((monster) => monster.map) ? [label('maps', DROP_MAPS_TEXT)] : [label('drop', DROP_RANDOM_TEXT)];
}

/** Random unique/set roll on a base: endgame maps when the item level needs map monsters (or the base only drops there) */
function randomDropLabel({ bases, drops }: SourceContext, level: number, baseCode: string): SourceLabel {
  const base = bases.get(baseCode);
  const baseMonsters = base?.kind === 'misc' ? drops.monstersFor(baseCode) : [];
  const mapsOnly = level >= MAP_ITEM_LEVEL || (baseMonsters.length > 0 && baseMonsters.every((monster) => monster.map));
  return mapsOnly ? label('maps', DROP_MAPS_TEXT) : label('drop', DROP_RANDOM_TEXT);
}

/** Weapons and armor roll through auto-TCs when spawnable; misc bases only when a treasure class names them */
function baseCanDrop({ bases, drops }: SourceContext, baseCode: string): boolean {
  const base = bases.get(baseCode);
  if (base === undefined || base.row.num('spawnable') !== 1) return false;
  return base.kind !== 'misc' || drops.monstersFor(baseCode).length > 0;
}

function vendorLabels({ bases }: SourceContext, code: string): SourceLabel[] {
  const base = bases.get(code);
  if (base === undefined) return [];
  return VENDORS.filter((npc) => optNum(base.row, `${npc}Min`) > 0 || optNum(base.row, `${npc}Max`) > 0).map((npc) =>
    label('buy', `Buy: ${npc}`)
  );
}

function inGamble({ bases, gamble }: SourceContext, baseCode: string): boolean {
  const base = bases.get(baseCode);
  if (base === undefined) return false;
  return [baseCode, optStr(base.row, 'normcode'), optStr(base.row, 'ubercode'), optStr(base.row, 'ultracode')].some((code) =>
    gamble.has(code)
  );
}

/** Deduped (kind + text) labels in KIND_ORDER; `Unknown` only when nothing else applies */
export function orderLabels(found: readonly SourceLabel[]): SourceLabel[] {
  const labels: SourceLabel[] = [];
  for (const entry of found) {
    if (entry.kind !== 'unknown' && !labels.some((known) => known.kind === entry.kind && known.text === entry.text)) labels.push(entry);
  }
  labels.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return labels.length > 0 ? labels : [label('unknown', 'Unknown')];
}

/**
 * One entry per (item kind, name): rows sharing both (ES + Ancient Coupon LoD versions of a unique, 47 "Rune Stocker"
 * misc variants, …) merge into the first one's code with the union of their labels, in KIND_ORDER.
 */
class SourceCollector {
  readonly items: ItemSource[] = [];
  merged = 0;
  readonly #byName = new Map<string, ItemSource>();

  add(name: string, code: string, item: ItemSource['item'], found: SourceLabel[]): void {
    const existing = this.#byName.get(`${item}:${name}`);
    const finalLabels = orderLabels([...(existing?.labels ?? []), ...found]);
    if (existing !== undefined) {
      existing.labels = finalLabels;
      this.merged++;
      return;
    }
    const source: ItemSource = { name, code, item, labels: finalLabels };
    this.#byName.set(`${item}:${name}`, source);
    this.items.push(source);
  }
}

export interface SourcesBuildResult {
  bundle: SourcesBundle;
  warnings: string[];
  merged: number;
  /**
   * The labels of one misc code by the same rules (cube, named drops, vendors), for any misc row including the ones
   * the bundle leaves out (potions, scrolls, tomes, keys); not merged by name. Used by the materials bundle.
   */
  miscLabels: (code: string) => SourceLabel[];
}

export function buildSourcesBundle(
  tables: SourceTables,
  strings: ReadonlyMap<string, string>,
  pluginToml: string | null
): SourcesBuildResult {
  const warnings: string[] = [];

  const couponCodes = ancientCouponCodes(tables.misc);
  const ctx: SourceContext = {
    bases: indexBases(tables),
    cube: indexCube(tables.cubemain, couponCodes),
    drops: createTreasureClassIndex(tables.treasureclassex, tables.monstats, tables.superuniques, strings),
    gamble: new Set(tables.gamble.rows.map((row) => row.str('code')).filter((code) => code !== '')),
  };
  const pluginUniques = readBossSetUniqueDrops(pluginToml);
  const sources = new SourceCollector();

  for (const row of tables.uniqueitems.rows) {
    const index = row.str('index');
    if (index === '' || row.num('disabled') === 1) continue;
    const code = row.str('code');
    if (!ctx.bases.has(code)) warnings.push(`sources: unique "${index}" has unknown base "${code}"`);
    const rarity = row.num('rarity');
    const random = row.num('spawnable') === 1 && rarity > 0 && baseCanDrop(ctx, code);
    sources.add(resolveName(strings, index, index), code, 'unique', [
      ...cubeLabels(ctx, index),
      ...namedDropLabels(ctx.drops.monstersFor(index)),
      ...(random ? [randomDropLabel(ctx, row.num('lvl'), code)] : []),
      ...(rarity > 0 && inGamble(ctx, code) ? [label('gamble', 'Gamble')] : []),
      ...(pluginUniques.has(index) ? [label('plugin', 'Boss drop (launcher plugin)')] : []),
    ]);
  }

  for (const row of tables.setitems.rows) {
    const index = row.str('index');
    if (index === '' || row.num('disabled') === 1) continue;
    const code = row.str('item');
    sources.add(resolveName(strings, index, index), code, 'set', [
      ...cubeLabels(ctx, index),
      ...namedDropLabels(ctx.drops.monstersFor(index)),
      ...(row.num('spawnable') === 1 ? [randomDropLabel(ctx, row.num('lvl'), code)] : []),
    ]);
  }

  const miscFound = (code: string) => [
    ...cubeLabels(ctx, code),
    ...namedDropLabels(ctx.drops.monstersFor(code)),
    ...vendorLabels(ctx, code),
  ];
  for (const row of tables.misc.rows) {
    const code = row.str('code');
    if (code === '' || NOISE_TYPES.has(row.str('type'))) continue;
    const found = miscFound(code);
    if (!ctx.cube.inputs.has(code) && found.length === 0) continue;
    sources.add(resolveName(strings, row.str('namestr'), row.str('name')), code, 'misc', found);
  }

  return { bundle: { items: sources.items }, warnings, merged: sources.merged, miscLabels: (code) => orderLabels(miscFound(code)) };
}
