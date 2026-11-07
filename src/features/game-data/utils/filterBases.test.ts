import { describe, expect, it } from 'vitest';
import type { BaseItem } from '../engine/schema';
import { DEFAULT_BASE_FILTERS, type BaseFilters } from '../store/gameDataSlice';
import { averageDamage, filterBases, maxSockets } from './filterBases';

function makeBase(overrides: Partial<BaseItem> & Pick<BaseItem, 'code' | 'name'>): BaseItem {
  return {
    kind: 'weapon',
    type: 'axe',
    type2: null,
    ancestors: ['axe', 'mele', 'weap'],
    tier: 'normal',
    family: [overrides.code, '', ''],
    qlvl: 1,
    reqLvl: 0,
    reqStr: 0,
    reqDex: 0,
    gemSockets: 0,
    socketCaps: [0, 0, 0],
    dmg1: null,
    dmg2: null,
    throwDmg: null,
    speed: 0,
    strBonus: 0,
    dexBonus: 0,
    def: null,
    block: null,
    durability: 0,
    indestructible: false,
    magicLvl: 0,
    autoGroup: null,
    cls: null,
    inv: [1, 1],
    ...overrides,
  };
}

const handAxe = makeBase({ code: 'hax', name: 'Hand Axe', qlvl: 3, dmg1: [3, 6], speed: 0, socketCaps: [2, 2, 2] });
const greatAxe = makeBase({
  code: 'gax',
  name: 'Great Axe',
  type2: '2hsw',
  ancestors: ['axe', '2hsw', 'mele', 'weap'],
  tier: 'exceptional',
  qlvl: 40,
  reqLvl: 30,
  dmg2: [20, 40],
  speed: 10,
  socketCaps: [3, 4, 6],
});
const javelin = makeBase({
  code: 'jav',
  name: 'Javelin',
  type: 'jave',
  ancestors: ['jave', 'comb', 'spea', 'mele', 'thro', 'weap'],
  qlvl: 1,
  dmg1: [1, 1],
  throwDmg: [10, 20],
  speed: -10,
});
const orb = makeBase({
  code: 'ob1',
  name: 'Eagle Orb',
  type: 'orb',
  ancestors: ['orb', 'weap', 'sorc', 'clas'],
  cls: 'sor',
  tier: 'elite',
  qlvl: 60,
  reqLvl: 50,
  dmg1: [2, 5],
  speed: -5,
});
const plate = makeBase({
  code: 'plt',
  name: 'Plate Mail',
  kind: 'armor',
  type: 'tors',
  ancestors: ['tors', 'armo'],
  qlvl: 35,
  reqLvl: 20,
  def: [108, 116],
  socketCaps: [3, 4, 4],
});
const shield = makeBase({
  code: 'kit',
  name: 'Kite Shield',
  kind: 'armor',
  type: 'shie',
  ancestors: ['shie', 'shld', 'armo', 'seco'],
  qlvl: 15,
  def: [16, 18],
  block: 30,
  tier: 'mythical',
});
const ring = makeBase({ code: 'rin', name: 'Ring', kind: 'misc', type: 'ring', ancestors: ['ring', 'misc', 'merc'], qlvl: 1 });

const ALL = [handAxe, greatAxe, javelin, orb, plate, shield, ring];
const TYPE_NAMES = new Map([
  ['axe', 'Axe'],
  ['2hsw', 'Two-Handed Melee Weapon'],
  ['jave', 'Javelin'],
  ['orb', 'Orb'],
  ['tors', 'Armor'],
  ['shie', 'Shield'],
  ['ring', 'Ring'],
]);

function run(filters: Partial<BaseFilters>): string[] {
  return filterBases(ALL, { ...DEFAULT_BASE_FILTERS, ...filters }, TYPE_NAMES).map((base) => base.code);
}

describe('helpers', () => {
  it('averageDamage prefers 2H, then 1H, then throw', () => {
    expect(averageDamage(greatAxe)).toBe(30);
    expect(averageDamage(handAxe)).toBe(4.5);
    expect(averageDamage(makeBase({ code: 'x', name: 'x', throwDmg: [4, 6] }))).toBe(5);
    expect(averageDamage(plate)).toBeNull();
  });

  it('maxSockets is the highest band cap', () => {
    expect(maxSockets(greatAxe)).toBe(6);
  });
});

describe('filterBases', () => {
  it('returns everything sorted by qlvl (then name) with default filters', () => {
    expect(run({})).toEqual(['jav', 'rin', 'hax', 'kit', 'plt', 'gax', 'ob1']);
  });

  it('searches name, type name and code with AND semantics', () => {
    expect(run({ search: 'axe' })).toEqual(['hax', 'gax']);
    expect(run({ search: 'great axe' })).toEqual(['gax']);
    expect(run({ search: 'two-handed' })).toEqual(['gax']);
    expect(run({ search: 'plt' })).toEqual(['plt']);
    expect(run({ search: 'armor' })).toEqual(['plt']);
    expect(run({ search: '"hand axe"' })).toEqual(['hax']);
    expect(run({ search: 'axe shield' })).toEqual([]);
  });

  it('filters by kind and tier (empty = all)', () => {
    expect(run({ kinds: ['armor'] })).toEqual(['kit', 'plt']);
    expect(run({ kinds: ['misc', 'armor'] })).toEqual(['rin', 'kit', 'plt']);
    expect(run({ tiers: ['elite', 'mythical'] })).toEqual(['kit', 'ob1']);
  });

  it('filters by item type through ancestors', () => {
    expect(run({ types: ['axe'] })).toEqual(['hax', 'gax']);
    expect(run({ types: ['mele'] })).toEqual(['jav', 'hax', 'gax']);
    expect(run({ types: ['2hsw', 'ring'] })).toEqual(['rin', 'gax']);
  });

  it('filters by a list of base codes', () => {
    expect(run({ codes: ['gax', 'jav'] })).toEqual(['jav', 'gax']);
  });

  it('filters by min sockets using the highest band', () => {
    expect(run({ minSockets: 4 })).toEqual(['plt', 'gax']);
    expect(run({ minSockets: 5 })).toEqual(['gax']);
  });

  it('filters by max required level', () => {
    expect(run({ maxReqLvl: 20 })).toEqual(['jav', 'rin', 'hax', 'kit', 'plt']);
  });

  it('filters by class restriction', () => {
    expect(run({ classOnly: 'sor' })).toEqual(['ob1']);
    expect(run({ classOnly: 'ama' })).toEqual([]);
    expect(run({ classOnly: 'none' })).not.toContain('ob1');
    expect(run({ classOnly: 'none' })).toHaveLength(6);
  });

  it('sorts by name both ways', () => {
    expect(run({ sort: 'name' })).toEqual(['ob1', 'gax', 'hax', 'jav', 'kit', 'plt', 'rin']);
    expect(run({ sort: 'name', sortDir: 'desc' })).toEqual(['rin', 'plt', 'kit', 'jav', 'hax', 'gax', 'ob1']);
  });

  it('sorts by required level', () => {
    expect(run({ sort: 'reqLvl', sortDir: 'desc' }).slice(0, 3)).toEqual(['ob1', 'gax', 'plt']);
  });

  it('sorts by average damage with bases without damage last', () => {
    expect(run({ sort: 'dmg', sortDir: 'desc' })).toEqual(['gax', 'hax', 'ob1', 'jav', 'kit', 'plt', 'rin']);
    expect(run({ sort: 'dmg' })).toEqual(['jav', 'ob1', 'hax', 'gax', 'kit', 'plt', 'rin']);
  });

  it('sorts by max defense with bases without defense last', () => {
    expect(run({ sort: 'def', sortDir: 'desc', kinds: ['armor', 'misc'] })).toEqual(['plt', 'kit', 'rin']);
  });

  it('sorts by speed', () => {
    expect(run({ sort: 'speed', kinds: ['weapon'] })).toEqual(['jav', 'ob1', 'hax', 'gax']);
  });
});
