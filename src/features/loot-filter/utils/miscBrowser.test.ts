import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BasesBundle, ItemTypeInfo, LootFilterDataBundle, LootFilterItem, TypesBundle } from '@/features/game-data/engine/schema';
import { allCodes, filterBrowser, typeCodes, type BrowserType } from './browserModel';
import { buildMiscBrowserModel, getMiscBrowserModel } from './miscBrowser';

const type = (code: string, name: string, parents: string[] = ['misc']): ItemTypeInfo => ({
  code,
  name,
  parents,
  ancestors: [code, ...parents],
  sockets: [0, 0, 0],
  thresholds: [25, 40],
  cls: null,
  ui: null,
  rwCats: [],
  magic: false,
  rare: false,
  normal: true,
  bodyLoc: null,
});

const item = (code: string, name: string, typeCode: string, extra: Partial<LootFilterItem> = {}): LootFilterItem => ({
  code,
  name,
  kind: 'misc',
  type: typeCode,
  spawnable: true,
  drops: true,
  ...extra,
});

const TYPES = [
  type('misc', 'Miscellaneous', []),
  type('sock', 'Socket Filler'),
  type('gem', 'Gem', ['sock']),
  type('gema', 'Amethyst', ['gem']),
  type('gemt', 'Topaz', ['gem']),
  type('rune', 'Rune', ['sock']),
  // Listed out of ladder order on purpose: the columns follow the items' first use.
  type('gem0', 'Chipped Gem', ['gem']),
  type('gem2', 'Standard Gem', ['gem']),
  type('gem5', 'Perfect Gem', ['gem']),
  type('gem1', 'Flawed Gem', ['gem']),
  type('poti', 'Potion'),
  type('hpot', 'Healing Potion', ['poti']),
  type('mpot', 'Mana Potion', ['poti']),
  type('rpot', 'Rejuv Potion', ['hpot', 'mpot']),
  type('ques', 'Quest', []),
  type('body', 'Body Part'),
  type('amu', 'Amulet'),
  type('can2', 'Gem Can 2'),
];

const ITEMS = [
  item('gcv', 'Chipped Amethyst', 'gema', { type2: 'gem0' }),
  item('gfv', 'Flawed Amethyst', 'gema', { type2: 'gem1' }),
  item('gsv', 'Amethyst', 'gema', { type2: 'gem2' }),
  item('gvb', 'Perfect Amethyst', 'gema', { type2: 'gem5' }),
  // A second family in the same type, with an irregular perfect code.
  item('gck', 'Chipped Obsidian', 'gema', { type2: 'gem0' }),
  item('gsk', 'Obsidian', 'gema', { type2: 'gem2' }),
  item('gbk', 'Perfect Obsidian', 'gema', { type2: 'gem5' }),
  item('gsy', 'Topaz', 'gemt', { type2: 'gem2' }),
  item('r01', 'El Rune', 'rune'),
  item('xr0', 'Chipped Frozen Soul', 'rune'),
  item('r02', 'Eld Rune', 'rune'),
  item('xl0', 'Flawed Frozen Soul', 'rune'),
  item('xt0', 'Frozen Soul', 'rune'),
  // A ladder word without a family member to strip to.
  item('xx1', 'Perfect Nonsense', 'rune'),
  item('hp1', 'Minor Healing Potion', 'hpot'),
  item('rvs', 'Rejuvenation Potion', 'rpot'),
  item('mp1', 'Minor Mana Potion', 'mpot'),
  item('std', 'Standard of Heroes', 'ques'),
  item('ear', 'Ear', 'body'),
  // Not spawnable, but a treasure class names it: listed.
  item('lmb', 'Limb', 'body', { spawnable: false }),
  item('ko1', 'Rune Stocker', 'can2'),
  item('ko2', 'Rune Stocker', 'can2'),
  // Not listed: a base, an item that never drops, a weapon.
  item('amu', 'Amulet', 'amu'),
  item('xxx', 'Shadow', 'body', { spawnable: false, drops: false }),
  item('axe', 'Axe', 'axe', { kind: 'weapon' }),
];

const MODEL = buildMiscBrowserModel(ITEMS, TYPES, new Set(['amu']));

function findType(code: string): BrowserType {
  const found = MODEL.groups.flatMap((group) => group.types).find((candidate) => candidate.code === code);
  if (found === undefined) throw new Error(`no type ${code}`);
  return found;
}

const rowCodes = (browserType: BrowserType) => browserType.rows.map((row) => [row.key, ...row.cells.map((cell) => cell?.code ?? null)]);

describe('buildMiscBrowserModel', () => {
  it('groups by the topmost type below misc, preferred groups first, then by label', () => {
    expect(MODEL.groups.map((group) => [group.label, group.types.map((t) => t.code)])).toEqual([
      ['Socket Filler', ['gem', 'rune']],
      ['Potion', ['hpot', 'mpot']],
      ['Quest', ['ques']],
      ['Body Part', ['body']],
    ]);
  });

  it('puts a type under its first parent below the group root', () => {
    expect(findType('hpot').items.map((i) => i.code)).toEqual(['hp1', 'rvs']);
  });

  it('leaves out stacks of identically named containers', () => {
    expect(MODEL.excluded).toEqual([{ code: 'can2', name: 'Gem Can 2', itemName: 'Rune Stocker', count: 2 }]);
    expect(MODEL.codes).not.toContain('ko1');
  });

  it('builds quality families from the ladder words of the type2 types, with only the columns in use', () => {
    const gem = findType('gem');
    expect(gem.layout).toBe('grid');
    expect(gem.columns.map((column) => column.label)).toEqual(['Chipped', 'Flawed', 'Standard', 'Perfect']);
    expect(rowCodes(gem)).toEqual([
      ['Amethyst', 'gcv', 'gfv', 'gsv', 'gvb'],
      ['Obsidian', 'gck', null, 'gsk', 'gbk'],
    ]);
    // A lone standard member is no family.
    expect(gem.extras.map((i) => i.code)).toEqual(['gsy']);
    expect(typeCodes(gem, 'gem5')).toEqual(['gvb', 'gbk']);
  });

  it('places an unprefixed member without type2 in the standard column and keeps the rest in bundle order', () => {
    const rune = findType('rune');
    expect(rune.columns.map((column) => column.label)).toEqual(['Chipped', 'Flawed', 'Standard']);
    expect(rowCodes(rune)).toEqual([['Frozen Soul', 'xr0', 'xl0', 'xt0']]);
    expect(rune.extras.map((i) => i.code)).toEqual(['r01', 'r02', 'xx1']);
    expect(rune.extras.every((i) => i.column === null)).toBe(true);
  });

  it('lists types without families, and has no stats line', () => {
    expect(findType('ques')).toMatchObject({ layout: 'list', rows: [], items: [{ code: 'std', column: null }] });
    expect(findType('ques').items[0]?.stats).toBeUndefined();
  });

  it('lists every code once in display order', () => {
    // prettier-ignore
    expect(MODEL.codes).toEqual([
      'gcv', 'gfv', 'gsv', 'gvb', 'gck', 'gsk', 'gbk', 'gsy',
      'xr0', 'xl0', 'xt0', 'r01', 'r02', 'xx1',
      'hp1', 'rvs', 'mp1', 'std', 'ear', 'lmb',
    ]);
  });

  it('searches names, codes, type names, column and group labels', () => {
    expect(allCodes(filterBrowser(MODEL.groups, 'perfect gem'))).toEqual(['gcv', 'gfv', 'gsv', 'gvb', 'gck', 'gsk', 'gbk']);
    expect(allCodes(filterBrowser(MODEL.groups, 'rune'))).toEqual(['xr0', 'xl0', 'xt0', 'r01', 'r02', 'xx1']);
    expect(allCodes(filterBrowser(MODEL.groups, 'socket topaz'))).toEqual(['gsy']);
    expect(allCodes(filterBrowser(MODEL.groups, 'potion rejuv'))).toEqual(['rvs']);
  });

  it('is cached per bundle triple', () => {
    const lootfilter = { items: ITEMS } as LootFilterDataBundle;
    const types: TypesBundle = { types: TYPES, classes: [] };
    const bases: BasesBundle = { bases: [] };
    expect(getMiscBrowserModel(lootfilter, types, bases)).toBe(getMiscBrowserModel(lootfilter, types, bases));
    expect(getMiscBrowserModel(lootfilter, types, { bases: [] })).not.toBe(getMiscBrowserModel(lootfilter, types, bases));
  });
});

describe('buildMiscBrowserModel with other type2 users (ESR 3.3)', () => {
  it('keeps the gem grades as the ladder when potions and elixirs carry a type2 too', () => {
    const types = [...TYPES, type('upot', 'Utility Potions', ['poti']), type('relx', 'Regular Elixirs', ['poti', 'upot'])];
    const items = [
      ...ITEMS,
      item('vps', 'Stamina Potion', 'hpot', { type2: 'upot' }),
      item('01p', 'Elixir of Attributes', 'upot', { type2: 'relx' }),
    ];
    const gem = buildMiscBrowserModel(items, types, new Set(['amu']))
      .groups.flatMap((group) => group.types)
      .find((t) => t.code === 'gem');
    expect(gem?.columns.map((column) => column.label)).toEqual(['Chipped', 'Flawed', 'Standard', 'Perfect']);
  });
});

describe('the misc model on the shipped bundles', () => {
  const read = (path: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  const model = getMiscBrowserModel(
    read('public/game-data/lootfilter.json') as LootFilterDataBundle,
    read('public/game-data/types.json') as TypesBundle,
    read('public/game-data/bases.json') as BasesBundle
  );
  const types = model.groups.flatMap((group) => group.types);

  it('starts with the socket fillers and finds the gem families', () => {
    expect(model.groups[0]?.label).toBe('Socket Filler');
    const gem = types.find((t) => t.code === 'gem');
    expect(gem?.columns.map((column) => column.label)).toEqual(['Chipped', 'Flawed', 'Standard', 'Flawless', 'Blemished', 'Perfect']);
    expect(gem?.rows.length).toBeGreaterThanOrEqual(7);
    expect(new Set(model.codes).size).toBe(model.codes.length);
  });
});
