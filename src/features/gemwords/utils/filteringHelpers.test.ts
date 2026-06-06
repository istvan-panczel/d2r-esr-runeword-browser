import { describe, expect, it } from 'vitest';
import type { Gem, Gemword } from '@/core/db/models';
import type { GemGroup } from '../types';
import {
  buildGemQualitySelection,
  matchesGemSelection,
  matchesGemwordSearch,
  matchesGemwordSockets,
  matchesGemwordMaxReqLevel,
  matchesGemwordItemTypes,
} from './filteringHelpers';

function createGemword(overrides: Partial<Gemword> = {}): Gemword {
  return {
    name: 'Holy',
    variant: 1,
    sockets: 1,
    reqLevel: 1,
    sortKey: 1,
    gems: ['Chipped Diamond'],
    ingredients: ['Chipped Diamond'],
    allowedItems: ['Body Armor', 'Any Shield'],
    affixes: [
      {
        rawText: 'Cold Resist +5%',
        pattern: 'Cold Resist +#%',
        value: 5,
        valueType: 'percent',
      },
    ],
    columnAffixes: {
      weaponsGloves: [],
      helmsBoots: [],
      armorShieldsBelts: [
        {
          rawText: 'Cold Resist +5%',
          pattern: 'Cold Resist +#%',
          value: 5,
          valueType: 'percent',
        },
      ],
    },
    ...overrides,
  };
}

describe('gemword filtering helpers', () => {
  it('matches search against name, affixes, gems, and item types', () => {
    const gemword = createGemword();

    expect(matchesGemwordSearch(gemword, ['holy'])).toBe(true);
    expect(matchesGemwordSearch(gemword, ['cold resist'])).toBe(true);
    expect(matchesGemwordSearch(gemword, ['chipped diamond'])).toBe(true);
    expect(matchesGemwordSearch(gemword, ['body armor'])).toBe(true);
    expect(matchesGemwordSearch(gemword, ['missing'])).toBe(false);
  });

  it('filters by socket count and max required level', () => {
    const gemword = createGemword({ sockets: 3, reqLevel: 21 });

    expect(matchesGemwordSockets(gemword, null)).toBe(true);
    expect(matchesGemwordSockets(gemword, 3)).toBe(true);
    expect(matchesGemwordSockets(gemword, 2)).toBe(false);
    expect(matchesGemwordMaxReqLevel(gemword, null)).toBe(true);
    expect(matchesGemwordMaxReqLevel(gemword, 21)).toBe(true);
    expect(matchesGemwordMaxReqLevel(gemword, 20)).toBe(false);
  });

  it('requires every gem ingredient to be selected', () => {
    const gemword = createGemword({ gems: ['Perfect Diamond', 'Perfect Diamond'], ingredients: ['Perfect Diamond', 'Perfect Diamond'] });

    expect(matchesGemSelection(gemword, {})).toBe(true);
    expect(matchesGemSelection(gemword, { 'Perfect Diamond': true })).toBe(true);
    expect(matchesGemSelection(gemword, { 'Perfect Diamond': false })).toBe(false);
  });

  it('matches when at least one allowed item type is selected', () => {
    const gemword = createGemword({ allowedItems: ['Body Armor', 'Any Shield'] });

    expect(matchesGemwordItemTypes(gemword, {})).toBe(true);
    expect(matchesGemwordItemTypes(gemword, { 'Body Armor': false, 'Any Shield': true })).toBe(true);
    expect(matchesGemwordItemTypes(gemword, { 'Body Armor': false, 'Any Shield': false })).toBe(false);
  });
});

describe('buildGemQualitySelection', () => {
  const noBonuses = { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: [] } as const;

  function createGem(name: string, type: Gem['type'], quality: Gem['quality']): Gem {
    return { name, type, quality, color: 'WHITE', reqLevel: 1, bonuses: noBonuses };
  }

  const gemGroups: readonly GemGroup[] = [
    {
      type: 'Diamond',
      gems: [createGem('Chipped Diamond', 'Diamond', 'Chipped'), createGem('Perfect Diamond', 'Diamond', 'Perfect')],
    },
    {
      type: 'Ruby',
      gems: [createGem('Chipped Ruby', 'Ruby', 'Chipped'), createGem('Flawed Ruby', 'Ruby', 'Flawed')],
    },
  ];

  it('selects only gems of the given quality across all gem types', () => {
    expect(buildGemQualitySelection(gemGroups, 'Chipped')).toEqual({
      'Chipped Diamond': true,
      'Perfect Diamond': false,
      'Chipped Ruby': true,
      'Flawed Ruby': false,
    });
  });

  it('deselects everything when no gem has the given quality', () => {
    expect(buildGemQualitySelection(gemGroups, 'Blemished')).toEqual({
      'Chipped Diamond': false,
      'Perfect Diamond': false,
      'Chipped Ruby': false,
      'Flawed Ruby': false,
    });
  });
});
