import { describe, it, expect } from 'vitest';
import type { ItemTypeInfo, LootFilterDataBundle } from '../../game-data/engine/schema.ts';
import { buildLootFilterReference, EMPTY_LOOT_FILTER_REFERENCE } from './reference.ts';

const itemType = (code: string, parents: string[] = []): ItemTypeInfo => ({
  code,
  name: code,
  parents,
  ancestors: [code, ...parents],
  sockets: [0, 0, 0],
  thresholds: [0, 0],
  cls: null,
  ui: null,
  rwCats: [],
  magic: true,
  rare: true,
  normal: true,
  bodyLoc: null,
});

const data: LootFilterDataBundle = {
  items: [
    { code: 'hax', name: 'Hand Axe', kind: 'weapon', type: 'axe', spawnable: true, drops: true },
    { code: 'r01', name: 'El Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
  ],
  stats: [
    { id: 0, name: 'strength' },
    { id: 1, name: 'energy' },
  ],
  areas: [{ id: 1, name: 'Rogue Encampment', act: 0 }],
  sounds: ['', 'cursor_pass', 'item_rune'],
  uniques: [
    { id: 0, name: 'The Perfect Cello', code: 'cm1', reqLvl: 1 },
    { id: 2, name: "Lothar's Will", code: 'hax', reqLvl: 1 },
  ],
  sets: [{ id: 2, name: "Autolycus' Robes", code: 'qui', reqLvl: 1 }],
};

describe('buildLootFilterReference', () => {
  it('collects the validator lookups', () => {
    const reference = buildLootFilterReference(data, { types: [itemType('axe'), itemType('rune')], classes: [] });
    expect([...reference.itemCodes]).toEqual(['hax', 'r01']);
    expect([...reference.itemTypes]).toEqual(['axe', 'rune']);
    expect([...reference.statNames]).toEqual(['strength', 'energy']);
    expect([...reference.statIds]).toEqual([0, 1]);
    expect([...reference.areaIds]).toEqual([1]);
    expect([...reference.soundNames]).toEqual(['cursor_pass', 'item_rune']);
    expect(reference.soundRowCount).toBe(3);
    expect([...reference.uniqueOrSetIds].sort()).toEqual([0, 2]);
    expect([...reference.statNamesById]).toEqual([
      [0, 'strength'],
      [1, 'energy'],
    ]);
  });

  it('names the skill tab layers by class id and tab', () => {
    const classes = [
      { code: 'ass', name: 'Assassin', tabs: ['Traps', 'Shadow Disciplines', 'Martial Arts'] },
      { code: 'war', name: 'Warlock', tabs: ['Demon Skills', 'Eldritch Skills', 'Chaos Skills'] },
    ] as const;
    const reference = buildLootFilterReference(data, { types: [], classes: classes.map((info) => ({ ...info, tabs: [...info.tabs] })) });
    expect(reference.skillTabNames.get(50)).toBe('Assassin Martial Arts');
    expect(reference.skillTabNames.get(56)).toBe('Warlock Demon Skills');
    expect(reference.skillTabNames.size).toBe(6);
  });

  it('maps item codes to the ancestors of their type and type2', () => {
    const withType2: LootFilterDataBundle = {
      ...data,
      items: [...data.items, { code: 'dbl', name: 'Double', kind: 'weapon', type: 'axe', type2: 'club', spawnable: true, drops: true }],
    };
    const types = { types: [itemType('axe', ['weap']), itemType('club', ['blun', 'weap']), itemType('weap')], classes: [] };
    const reference = buildLootFilterReference(withType2, types);
    expect([...(reference.itemCodeTypes.get('hax') ?? [])]).toEqual(['axe', 'weap']);
    // A type types.json lacks counts as itself.
    expect([...(reference.itemCodeTypes.get('r01') ?? [])]).toEqual(['rune']);
    expect([...(reference.itemCodeTypes.get('dbl') ?? [])].sort()).toEqual(['axe', 'blun', 'club', 'weap']);
    expect([...(reference.typeAncestors.get('club') ?? [])]).toEqual(['club', 'blun', 'weap']);
  });

  it('has an empty fallback', () => {
    expect(EMPTY_LOOT_FILTER_REFERENCE.itemCodes.size).toBe(0);
    expect(EMPTY_LOOT_FILTER_REFERENCE.soundRowCount).toBe(0);
  });
});
