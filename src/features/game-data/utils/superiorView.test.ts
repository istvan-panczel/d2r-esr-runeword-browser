import { describe, expect, it } from 'vitest';
import type { SuperiorAffixes, SuperiorRow } from '../engine/schema';
import { filterSuperiorPools, superiorTypeOptions } from './superiorView';

const row = (index: number, weight: number, text: string): SuperiorRow => ({
  row: index,
  weight,
  mods: [],
  text: [text],
  columns: [],
  itypes: ['weap'],
  etypes: [],
});

const superior: SuperiorAffixes = {
  enabled: true,
  defaultWeight: 100,
  rows: [row(0, 100, '+(50 to 100) to Attack Rating'), row(1, 1, '+1 to All Skills'), row(2, 99, '+(5 to 10)% to Spell Damage')],
  pools: [
    { label: 'Weapon (other types)', types: ['axe', 'abow'], bases: 20, rows: [0, 1], total: 101 },
    { label: 'Orb', types: ['orb'], bases: 4, rows: [1, 2], total: 100 },
  ],
};
const typeNames = new Map([
  ['axe', 'Axe'],
  ['abow', 'Amazon Bow'],
  ['orb', 'Orb'],
]);

describe('superiorTypeOptions', () => {
  it('lists every pool type by name', () => {
    expect(superiorTypeOptions(superior, typeNames).map((option) => option.code)).toEqual(['abow', 'axe', 'orb']);
  });
});

describe('filterSuperiorPools', () => {
  it('shows every pool with every row and its chance by default', () => {
    const views = filterSuperiorPools(superior, { search: '', superiorType: null }, typeNames);
    expect(views.map((view) => view.typeNames)).toEqual([['Axe', 'Amazon Bow'], ['Orb']]);
    expect(views[0]?.rolls.map((roll) => [roll.row.row, roll.chance])).toEqual([
      [0, 100 / 101],
      [1, 1 / 101],
    ]);
  });

  it('keeps the rows matching every search term and the full-pool chances', () => {
    const views = filterSuperiorPools(superior, { search: 'all skills', superiorType: null }, typeNames);
    expect(views.map((view) => [view.pool.label, view.rolls.map((roll) => roll.chance)])).toEqual([
      ['Weapon (other types)', [1 / 101]],
      ['Orb', [1 / 100]],
    ]);
  });

  it('matches the pool label and type names too', () => {
    const views = filterSuperiorPools(superior, { search: '"amazon bow" skills', superiorType: null }, typeNames);
    expect(views.map((view) => view.rolls.map((roll) => roll.row.row))).toEqual([[1]]);
    expect(filterSuperiorPools(superior, { search: 'zzz', superiorType: null }, typeNames)).toEqual([]);
  });

  it('keeps only the pools of the selected item type', () => {
    const views = filterSuperiorPools(superior, { search: '', superiorType: 'orb' }, typeNames);
    expect(views.map((view) => view.pool.label)).toEqual(['Orb']);
  });
});
