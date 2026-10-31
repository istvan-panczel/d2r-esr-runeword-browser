import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/core/db';
import type { Runeword } from '@/core/db/models';
import { expandRunewordsByColumn } from '../utils/filteringHelpers';
import { queryRunewordsInDisplayOrder } from './useFilteredRunewords';

function createRuneword(name: string, reqLevel: number, isLod: boolean, variant = 1): Runeword {
  return {
    name,
    variant,
    sockets: 2,
    reqLevel,
    sortKey: reqLevel,
    isLod,
    runes: [],
    gems: [],
    ingredients: [],
    allowedItems: ['Weapon'],
    excludedItems: [],
    affixes: [],
    columnAffixes: { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: [] },
    tierPointTotals: [],
  };
}

const names = (runewords: readonly Runeword[]) => runewords.map((rw) => `${String(rw.reqLevel)} ${rw.name} v${String(rw.variant)}`);

beforeEach(async () => {
  await db.runewords.clear();
});

afterAll(async () => {
  await db.runewords.clear();
});

describe('queryRunewordsInDisplayOrder', () => {
  it('should list ESR, Kanji and LoD runewords in one list by level, then name, then variant', async () => {
    await db.runewords.bulkPut([
      createRuneword('Call to Arms', 57, true),
      createRuneword('Stone', 4, false),
      createRuneword('Steel', 13, true),
      createRuneword('Serpent', 13, false, 2),
      createRuneword('Hades', 13, false),
      createRuneword('Serpent', 13, false, 1),
      createRuneword('hand of Justice', 67, true),
      createRuneword('Pride', 67, true),
    ]);

    const ordered = await queryRunewordsInDisplayOrder();
    const expected = [
      '4 Stone v1',
      '13 Hades v1',
      '13 Serpent v1',
      '13 Serpent v2',
      '13 Steel v1',
      '57 Call to Arms v1',
      '67 hand of Justice v1',
      '67 Pride v1',
    ];
    expect(names(ordered)).toEqual(expected);
    // The column split keeps that order (no runeword here has differing columns)
    expect(names(expandRunewordsByColumn(ordered))).toEqual(expected);
  });

  it('should order old cached rows (legacy LoD sortKey = 10000 + reqLevel, no isLod) by level too', async () => {
    const { isLod: _isLod, ...legacyLod } = { ...createRuneword('Spirit', 30, true), sortKey: 10030 };
    await db.runewords.bulkPut([legacyLod as Runeword, createRuneword('Zeal', 40, false), createRuneword('Hunt', 12, false)]);

    expect(names(await queryRunewordsInDisplayOrder())).toEqual(['12 Hunt v1', '30 Spirit v1', '40 Zeal v1']);
  });
});
