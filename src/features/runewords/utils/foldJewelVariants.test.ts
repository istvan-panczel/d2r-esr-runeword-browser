import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { Affix, Runeword } from '@/core/db/models';
import { parseRunewordsHtml } from '@/features/data-sync/parsers/runewordsParser';
import { compareRunewordsByLevel, matchesSockets } from './filteringHelpers';
import { foldJewelVariants, formatJewelInfo } from './foldJewelVariants';

const RUNEWORDS = resolve(__dirname, '../../../../test-fixtures/runewords.htm');

function affix(rawText: string): Affix {
  return { rawText, pattern: rawText, value: null, valueType: 'none' };
}

function runeword(overrides: Partial<Runeword>): Runeword {
  const affixes = overrides.affixes ?? [affix('+10 to Strength')];
  return {
    name: 'Test',
    variant: 1,
    sockets: 2,
    reqLevel: 10,
    sortKey: 10,
    isLod: false,
    runes: ['El Rune', 'Eld Rune'],
    gems: [],
    ingredients: ['El Rune', 'Eld Rune'],
    allowedItems: ['Weapon'],
    excludedItems: [],
    affixes,
    columnAffixes: { weaponsGloves: affixes, helmsBoots: [], armorShieldsBelts: [] },
    tierPointTotals: [],
    ...overrides,
  };
}

/** The socket label the card shows ("3-6") and the jewel info. */
const summary = (entry: Runeword) => ({
  sockets: entry.socketsMax === undefined ? String(entry.sockets) : `${String(entry.sockets)}-${String(entry.socketsMax)}`,
  jewelInfo: entry.jewelInfo,
});

describe('formatJewelInfo', () => {
  it('follows the parser formats', () => {
    expect(formatJewelInfo(0, 0)).toBeUndefined();
    expect(formatJewelInfo(0, 3)).toBe('(0-3) Jewels');
    expect(formatJewelInfo(0, 1)).toBe('(0-1) Jewels');
    expect(formatJewelInfo(1, 2)).toBe('(1-2) Jewels');
    expect(formatJewelInfo(1, 1)).toBe('(1) Jewel');
    expect(formatJewelInfo(2, 2)).toBe('(2) Jewels');
  });
});

describe('foldJewelVariants', () => {
  const range = runeword({ variant: 1, sockets: 2, socketsMax: 4, jewelInfo: '(0-2) Jewels' });
  const one = runeword({ variant: 2, sockets: 3, jewelInfo: '(1) Jewel' });
  const two = runeword({ variant: 3, sockets: 4, jewelInfo: '(2) Jewels' });

  it('folds the per-count rows of the same content into the lowest variant with the full range', () => {
    const folded = foldJewelVariants([range, one, two]);
    expect(folded).toHaveLength(1);
    expect(folded[0]?.variant).toBe(1);
    expect(folded[0] && summary(folded[0])).toEqual({ sockets: '2-4', jewelInfo: '(0-2) Jewels' });
  });

  it('keeps the range row to its own count when the per-count rows differ', () => {
    const other = [affix('+20 to Strength')];
    const folded = foldJewelVariants([range, { ...one, affixes: other }, { ...two, affixes: other }]);
    expect(folded.map(summary)).toEqual([
      { sockets: '2', jewelInfo: undefined },
      { sockets: '3-4', jewelInfo: '(1-2) Jewels' },
    ]);
    expect(folded.map((entry) => entry.variant)).toEqual([1, 2]);
  });

  it('keeps a range row without per-count rows as it is', () => {
    expect(foldJewelVariants([range])).toEqual([range]);
  });

  it('passes rows without jewels through unchanged and keeps the order', () => {
    const a = runeword({ name: 'A' });
    const b = runeword({ name: 'B' });
    const folded = foldJewelVariants([a, range, b, one, two]);
    expect(folded.map((entry) => entry.name)).toEqual(['A', 'Test', 'B']);
    expect(folded[0]).toBe(a);
    expect(folded[2]).toBe(b);
  });

  it('keeps rows of different item types apart', () => {
    const melee = { allowedItems: ['Melee Weapon'] };
    const folded = foldJewelVariants([range, runeword({ ...melee, variant: 2, socketsMax: 4, jewelInfo: '(0-2) Jewels' }), one, two]);
    expect(folded).toHaveLength(2);
    expect(folded.map((entry) => entry.allowedItems.join())).toEqual(['Weapon', 'Melee Weapon']);
  });

  describe.skipIf(!existsSync(RUNEWORDS))('with the runewords.htm fixture', () => {
    const runewords = parseRunewordsHtml(readFileSync(RUNEWORDS, 'utf-8')).sort(compareRunewordsByLevel);
    const folded = foldJewelVariants(runewords);
    const entries = (name: string) => folded.filter((entry) => entry.name === name);

    it('folds 409 rows into 386 entries; runewords without jewels stay as they are', () => {
      expect(runewords).toHaveLength(409);
      expect(folded).toHaveLength(386);
      const jewelNames = new Set(runewords.filter((entry) => entry.jewelInfo !== undefined).map((entry) => entry.name));
      expect(folded.filter((entry) => !jewelNames.has(entry.name))).toEqual(runewords.filter((entry) => !jewelNames.has(entry.name)));
    });

    it('shows Dragon Master, Moonlight and Storm, Earth and Fire as one 3-6 card each', () => {
      for (const name of ['Dragon Master', 'Moonlight', 'Storm, Earth and Fire']) {
        expect(entries(name).map(summary), name).toEqual([{ sockets: '3-6', jewelInfo: '(0-3) Jewels' }]);
        expect(entries(name)[0]?.variant).toBe(1);
      }
    });

    it('splits Tourbillion into the 4-socket recipe and the 5-6 one with 1 required jewel', () => {
      const tourbillion = entries('Tourbillion');
      expect(tourbillion.map(summary)).toEqual([
        { sockets: '4', jewelInfo: undefined },
        { sockets: '5-6', jewelInfo: '(1-2) Jewels' },
      ]);
      expect(tourbillion[0]?.affixes.some((entry) => entry.rawText.includes('Bleed'))).toBe(true);
      expect(tourbillion[1]?.affixes.some((entry) => entry.rawText.includes('Bleed'))).toBe(false);
    });

    it('splits Wooden Colossus into 5 sockets (+300 Strength) and 6 sockets with 1 jewel (+150)', () => {
      const colossus = entries('Wooden Colossus');
      expect(colossus.map(summary)).toEqual([
        { sockets: '5', jewelInfo: undefined },
        { sockets: '6', jewelInfo: '(1) Jewel' },
      ]);
      expect(colossus[0]?.affixes.map((entry) => entry.rawText)).toContain('+300 to Strength');
      expect(colossus[1]?.affixes.map((entry) => entry.rawText)).toContain('+150 to Strength');
    });

    it('keeps one Shinigami card per item-type group, each with the full jewel range', () => {
      const shinigami = entries('Shinigami');
      expect(shinigami.map(summary)).toEqual([
        { sockets: '2-6', jewelInfo: '(0-4) Jewels' },
        { sockets: '2-6', jewelInfo: '(0-4) Jewels' },
      ]);
      expect(new Set(shinigami.map((entry) => entry.allowedItems.join())).size).toBe(2);
    });

    it('folds the other jewel runewords into one card with their range', () => {
      expect(entries('Gold Scarab').map(summary)).toEqual([{ sockets: '4-6', jewelInfo: '(0-2) Jewels' }]);
      expect(entries('Sunlight').map(summary)).toEqual([{ sockets: '3-4', jewelInfo: '(0-1) Jewels' }]);
      expect(entries('Might of the Earth').map(summary)).toEqual([{ sockets: '5-6', jewelInfo: '(0-1) Jewels' }]);
      expect(entries('Work of God').map(summary)).toEqual([{ sockets: '5-6', jewelInfo: '(0-1) Jewels' }]);
    });

    it('still finds the folded entries with the socket filter', () => {
      const matching = (min: number, max: number, name: string) =>
        entries(name)
          .filter((entry) => matchesSockets(entry, { min, max }))
          .map((entry) => summary(entry).sockets);
      expect(matching(5, 5, 'Dragon Master')).toEqual(['3-6']);
      expect(matching(5, 5, 'Tourbillion')).toEqual(['5-6']);
      expect(matching(4, 4, 'Tourbillion')).toEqual(['4']);
      expect(matching(4, 5, 'Tourbillion')).toEqual(['4', '5-6']);
      expect(matching(6, 6, 'Wooden Colossus')).toEqual(['6']);
    });
  });
});
