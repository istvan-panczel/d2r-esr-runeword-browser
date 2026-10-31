import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  BaseItem,
  BasesBundle,
  ItemTypeInfo,
  LootFilterDataBundle,
  LootFilterItem,
  LootFilterUniqueOrSet,
  TiersBundle,
  TypesBundle,
} from '@/features/game-data/engine/schema';
import {
  allCodes,
  applyBrowserSelection,
  columnItems,
  filterBrowser,
  initialBrowserSelection,
  itemCodes,
  toggleCodes,
  typeCodes,
  type BrowserItem,
  type BrowserModel,
  type BrowserType,
} from './browserModel';
import {
  DISABLED_HINT,
  MISC_GROUP,
  ambiguousIds,
  buildUniqueBrowserModel,
  formatIdRuns,
  getUniqueBrowserModel,
  qualityTellsApart,
} from './uniqueBrowser';

const type = (code: string, name: string, parents: string[] = [], cls: ItemTypeInfo['cls'] = null): ItemTypeInfo => ({
  code,
  name,
  parents,
  ancestors: [code, ...parents],
  sockets: [0, 0, 0],
  thresholds: [25, 40],
  cls,
  ui: null,
  rwCats: [],
  magic: true,
  rare: true,
  normal: true,
  bodyLoc: null,
});

/** Only the fields the browser reads (kind, type, tier). */
const base = (code: string, typeCode: string, kind: BaseItem['kind'], tier: BaseItem['tier']) =>
  ({ code, name: code, kind, type: typeCode, tier }) as BaseItem;

const item = (code: string, name: string, typeCode: string, kind: LootFilterItem['kind']): LootFilterItem => ({
  code,
  name,
  kind,
  type: typeCode,
  spawnable: true,
  drops: true,
});

const row = (id: number, name: string, code: string, reqLvl: number, extra: Partial<LootFilterUniqueOrSet> = {}) => ({
  id,
  name,
  code,
  reqLvl,
  ...extra,
});

const TYPES = [
  type('helm', 'Helm'),
  type('axe', 'Axe'),
  type('ring', 'Ring'),
  type('lcha', 'Grand Charm'),
  type('ocha', 'Odd Charm', ['lcha']),
  type('rock', 'Ore'),
];

// bases.json: spawnable bases only (no m01 / zzz / ocha / ore rows); its misc bases are "normal" unless mythical.
const BASES = [
  base('cap', 'helm', 'armor', 'normal'),
  base('xap', 'helm', 'armor', 'exceptional'),
  base('yap', 'helm', 'armor', 'elite'),
  base('hax', 'axe', 'weapon', 'normal'),
  base('rin', 'ring', 'misc', 'normal'),
  base('mri', 'ring', 'misc', 'mythical'),
  base('cm3', 'lcha', 'misc', 'normal'),
];

// tiers.json: every weapon and armor row, shadow bases and mythicals included.
const TIERS: TiersBundle['codes'] = { cap: 'normal', xap: 'exceptional', yap: 'elite', m01: 'mythical', zzz: 'normal', hax: 'normal' };

const LOOTFILTER: Pick<LootFilterDataBundle, 'items' | 'uniques' | 'sets'> = {
  items: [
    item('cap', 'Cap', 'helm', 'armor'),
    item('xap', 'War Hat', 'helm', 'armor'),
    item('yap', 'Shako', 'helm', 'armor'),
    item('m01', 'Mythical Helm', 'helm', 'armor'),
    item('zzz', 'Shadow Cap', 'helm', 'armor'),
    item('hax', 'Hand Axe', 'axe', 'weapon'),
    item('rin', 'Ring', 'ring', 'misc'),
    item('mri', 'Mythical Ring', 'ring', 'misc'),
    item('cm3', 'Grand Charm', 'lcha', 'misc'),
    item('cm4', 'Odd Charm', 'ocha', 'misc'),
    item('ore', 'Ore', 'rock', 'misc'),
  ],
  uniques: [
    row(0, 'The Perfect Cello', 'cm3', 1, { disabled: true }),
    row(1, "Biggin's Bonnet", 'cap', 3),
    row(2, 'Peasant Crown', 'xap', 28),
    row(3, 'Ore', 'ore', 1),
    row(4, 'Ore', 'ore', 1),
    row(5, 'Ore', 'ore', 20),
    row(6, 'Crown of Ages', 'yap', 82),
    row(7, 'Myth Helm', 'm01', 90),
    row(8, 'Shade', 'zzz', 10),
    row(9, 'Nagelring', 'rin', 7),
    row(10, 'Ring of Myth', 'mri', 95),
    row(11, 'Deviant Cell', 'cm4', 50),
    row(12, 'Axe of Fechmar', 'hax', 5),
    row(13, 'Coupon Bonnet', 'cap', 3, { coupon: true }),
    row(14, 'Coupon Halo', 'rin', 12, { coupon: true }),
  ],
  sets: [
    row(1, "Sigon's Visor", 'cap', 6, { set: "Sigon's Complete Steel" }),
    row(2, "Sigon's Shelter", 'xap', 6, { set: "Sigon's Complete Steel" }),
    row(20, 'Lone Axe', 'hax', 30, { set: 'Solo' }),
    row(3, 'Angelic Halo', 'rin', 12, { set: 'Angelic Raiment' }),
    row(14, 'Halo Set Piece', 'rin', 12, { set: 'Angelic Raiment' }),
  ],
};

const MODEL = buildUniqueBrowserModel(LOOTFILTER, TYPES, BASES, TIERS);

const typesOf = (model: BrowserModel) => model.groups.flatMap((group) => group.types);

function findType(model: BrowserModel, code: string): BrowserType {
  const found = typesOf(model).find((candidate) => candidate.code === code);
  if (found === undefined) throw new Error(`no type ${code}`);
  return found;
}

const names = (items: readonly BrowserItem[]) => items.map((cell) => cell.name);

function findCell(model: BrowserModel, name: string): BrowserItem {
  const found = typesOf(model)
    .flatMap((candidate) => [...candidate.items, ...candidate.extras])
    .find((cell) => cell.name === name);
  if (found === undefined) throw new Error(`no cell ${name}`);
  return found;
}

describe('buildUniqueBrowserModel: uniques', () => {
  it('groups by the base type group, unlisted types after the listed ones of their nearest listed ancestor’s group, else Misc', () => {
    expect(MODEL.uniques.groups.map((group) => [group.label, group.types.map((t) => t.code)])).toEqual([
      ['Weapons', ['axe']],
      ['Armor', ['helm']],
      ['Accessories', ['lcha', 'ring', 'ocha']],
      [MISC_GROUP, ['rock']],
    ]);
  });

  it('puts tiered bases (shadow bases too) in Normal | Exceptional | Elite columns by required level, mythicals below', () => {
    const helm = findType(MODEL.uniques, 'helm');
    expect(helm.layout).toBe('columns');
    expect(helm.columns.map((column) => column.key)).toEqual(['normal', 'exceptional', 'elite']);
    expect(names(columnItems(helm, 'normal'))).toEqual(["Biggin's Bonnet", 'Shade']);
    expect(names(columnItems(helm, 'exceptional'))).toEqual(['Peasant Crown']);
    expect(names(columnItems(helm, 'elite'))).toEqual(['Crown of Ages']);
    expect(names(helm.extras)).toEqual(['Myth Helm']);
    expect(helm.extrasColumn?.key).toBe('mythical');
    expect(typeCodes(helm, 'mythical')).toEqual(['7']);
    expect(typeCodes(helm)).toEqual(['1', '8', '2', '6', '7']);
  });

  it('lists types without tiered bases, a mythical accessory with its tier', () => {
    const ring = findType(MODEL.uniques, 'ring');
    expect(ring.layout).toBe('list');
    expect(ring.items.map((cell) => [cell.name, cell.column?.key ?? null])).toEqual([
      ['Nagelring', null],
      ['Ring of Myth', 'mythical'],
    ]);
  });

  it('describes a cell by base, required level and id, with the base code as its tag', () => {
    const cell = findCell(MODEL.uniques, "Biggin's Bonnet");
    expect(cell).toMatchObject({ code: 'Unique:1', codes: ['1'], tag: 'cap', stats: 'Cap · Lvl 3 · #1' });
  });

  it('merges rows with the same name and base into one cell selecting every id', () => {
    const ore = findCell(MODEL.uniques, 'Ore');
    expect(ore.codes).toEqual(['3', '4', '5']);
    expect(ore.stats).toBe('Ore · Lvl 1–20 · 3 rows #3–5');
    expect(typesOf(MODEL.uniques).filter((t) => t.items.some((cell) => cell.name === 'Ore'))).toHaveLength(1);
  });

  it('shows disabled rows without letting them be ticked', () => {
    const cello = findCell(MODEL.uniques, 'The Perfect Cello');
    expect(cello.disabled).toBe(DISABLED_HINT);
    expect(itemCodes(cello)).toEqual([]);
    expect(MODEL.uniques.codes).not.toContain('0');
    expect(MODEL.codes).not.toContain('0');
  });
});

describe('buildUniqueBrowserModel: sets', () => {
  it('has one block per set, by its lowest required level, items in table order with their base tier', () => {
    expect(MODEL.sets.groups.map((group) => group.label)).toEqual(['Sets']);
    const blocks = typesOf(MODEL.sets);
    expect(blocks.map((block) => [block.name, names(block.items)])).toEqual([
      ["Sigon's Complete Steel", ["Sigon's Visor", "Sigon's Shelter"]],
      ['Angelic Raiment', ['Angelic Halo', 'Halo Set Piece']],
      ['Solo', ['Lone Axe']],
    ]);
    expect(blocks[0]?.tag).toBe('');
    expect(blocks[0]?.items.map((cell) => cell.column?.key)).toEqual(['normal', 'exceptional']);
    expect(MODEL.sets.codes).toEqual(['1', '2', '3', '14', '20']);
  });

  it('lists every id once across both tabs, uniques first', () => {
    expect(MODEL.codes).toEqual(['12', '1', '8', '2', '6', '7', '9', '10', '11', '3', '4', '5', '14', '20']);
  });
});

describe('buildUniqueBrowserModel: coupon uniques', () => {
  it('leaves coupon uniques out of the Uniques tab and counts them', () => {
    expect(() => findCell(MODEL.uniques, 'Coupon Bonnet')).toThrow();
    expect(() => findCell(MODEL.uniques, 'Coupon Halo')).toThrow();
    expect(MODEL.uniques.codes).not.toContain('13');
    expect(MODEL.codes).not.toContain('13');
    expect(MODEL.couponCount).toBe(2);
  });

  it('keeps a set item that shares its id with a coupon unique, and warns about the shared id', () => {
    expect(MODEL.codes).toContain('14');
    expect(MODEL.shared.get('14')).toEqual({ id: '14', unique: 'Coupon Halo', set: 'Halo Set Piece' });
  });

  it('keeps a coupon unique id the filter already has on Apply', () => {
    const values = ['13', '1'];
    const draft = initialBrowserSelection(values, MODEL.codes);
    expect([...draft]).toEqual(['1']);
    expect(applyBrowserSelection(values, MODEL.codes, toggleCodes(draft, ['1'], false))).toEqual(['13']);
    expect(applyBrowserSelection(values, MODEL.codes, toggleCodes(draft, ['12'], true))).toEqual(['13', '1', '12']);
  });
});

describe('search', () => {
  const search = (model: BrowserModel, query: string) => allCodes(filterBrowser(model.groups, query));

  it('matches every term against name, base name and code, set name, type and group labels and ids', () => {
    expect(search(MODEL.uniques, 'crown')).toEqual(['2', '6']);
    expect(search(MODEL.uniques, 'war hat')).toEqual(['2']);
    expect(search(MODEL.uniques, 'yap')).toEqual(['6']);
    expect(search(MODEL.uniques, 'odd charm')).toEqual(['11']);
    expect(search(MODEL.uniques, 'accessories myth')).toEqual(['10']);
    expect(search(MODEL.uniques, 'helm mythical')).toEqual(['7']);
    expect(search(MODEL.uniques, '12')).toEqual(['12']);
    expect(search(MODEL.sets, 'complete visor')).toEqual(['1']);
    expect(search(MODEL.sets, 'raiment')).toEqual(['3', '14']);
  });
});

describe('the shared id space', () => {
  it('knows the ids both tables have', () => {
    expect([...MODEL.shared.keys()]).toEqual(['1', '2', '3', '14']);
    expect(MODEL.shared.get('1')).toEqual({ id: '1', unique: "Biggin's Bonnet", set: "Sigon's Visor" });
  });

  it('tells a quality that admits set items or uniques, not both', () => {
    expect(qualityTellsApart(undefined)).toBe(false);
    expect(qualityTellsApart('unique')).toBe(true);
    expect(qualityTellsApart(5)).toBe(true);
    expect(qualityTellsApart(['set', 'rare'])).toBe(true);
    expect(qualityTellsApart(['set', 'unique'])).toBe(false);
    expect(qualityTellsApart({ min: 'set', max: 'rare' })).toBe(true);
    expect(qualityTellsApart({ min: 'magic' })).toBe(false);
    expect(qualityTellsApart('magic')).toBe(false);
  });

  it('lists the ticked shared ids by id unless the quality tells them apart', () => {
    const selected = new Set(['12', '3', '1', '20']);
    expect(ambiguousIds(selected, MODEL.shared, undefined).map((entry) => entry.id)).toEqual(['1', '3']);
    expect(ambiguousIds(selected, MODEL.shared, { min: 'magic' }).map((entry) => entry.id)).toEqual(['1', '3']);
    expect(ambiguousIds(selected, MODEL.shared, 'set')).toEqual([]);
  });
});

describe('selection', () => {
  it('applies like the item browser: unknown and disabled ids stay, unticked go, new ones follow in display order', () => {
    const values = ['99', '0', '9', '1'];
    const draft = initialBrowserSelection(values, MODEL.codes);
    expect([...draft]).toEqual(['9', '1']);
    const ore = findCell(MODEL.uniques, 'Ore');
    const next = toggleCodes(toggleCodes(toggleCodes(draft, ['9'], false), itemCodes(ore), true), ['20'], true);
    expect(applyBrowserSelection(values, MODEL.codes, next)).toEqual(['99', '0', '1', '3', '4', '5', '20']);
  });

  it('formats id runs', () => {
    expect(formatIdRuns([5, 3, 4, 9, 11, 12])).toBe('3–5, 9, 11–12');
    expect(formatIdRuns([7])).toBe('7');
  });
});

describe('the unique and set model on the shipped bundles', () => {
  const read = (path: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  const lootfilter = read('public/game-data/lootfilter.json') as LootFilterDataBundle;
  const types = read('public/game-data/types.json') as TypesBundle;
  const bases = read('public/game-data/bases.json') as BasesBundle;
  const tiers = read('public/game-data/tiers.json') as TiersBundle;
  const model = getUniqueBrowserModel(lootfilter, types, bases, tiers);
  const cells = typesOf(model.uniques).flatMap((t) => [...t.items, ...t.extras]);

  it('lists every unique but the coupon ones and every set row once, merging Ember of Creation and Ore, with the disabled rows greyed', () => {
    const listedIds = cells.flatMap((cell) => cell.codes ?? []);
    expect(new Set(listedIds).size).toBe(listedIds.length);
    const coupons = lootfilter.uniques.filter((entry) => entry.coupon === true);
    expect(model.couponCount).toBe(coupons.length);
    expect(coupons.length).toBeGreaterThan(300);
    expect(listedIds.length).toBe(lootfilter.uniques.length - coupons.length);
    expect(listedIds.some((id) => coupons.some((entry) => String(entry.id) === id))).toBe(false);
    const merged = new Map(cells.filter((cell) => (cell.codes?.length ?? 1) > 1).map((cell) => [cell.name, cell.codes?.length]));
    expect(merged.get('Ember of Creation')).toBe(230);
    expect(merged.get('Ore')).toBe(16);
    expect(cells.filter((cell) => cell.disabled !== undefined)).toHaveLength(
      lootfilter.uniques.filter((entry) => entry.disabled === true).length
    );
    const setCells = typesOf(model.sets).flatMap((t) => t.items);
    expect(setCells.flatMap((cell) => cell.codes ?? [])).toHaveLength(lootfilter.sets.length);
    expect(new Set(model.codes).size).toBe(model.codes.length);
    expect(model.shared.size).toBe(lootfilter.sets.filter((entry) => lootfilter.uniques.some((unique) => unique.id === entry.id)).length);
  });

  it('starts with the weapons and has Normal | Exceptional | Elite columns for helms', () => {
    expect(model.uniques.groups[0]?.label).toBe('Weapons');
    const helm = findType(model.uniques, 'helm');
    expect(helm.layout).toBe('columns');
    expect(columnItems(helm, 'elite').length).toBeGreaterThan(5);
    expect(getUniqueBrowserModel(lootfilter, types, bases, tiers)).toBe(model);
  });
});
