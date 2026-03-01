import { describe, it, expect } from 'vitest';
import type { Runeword, EsrRune, LodRune, KanjiRune, SocketableBonuses, Affix } from '@/core/db/models';
import {
  parseSearchTerms,
  matchesSearch,
  matchesSockets,
  matchesMaxReqLevel,
  matchesItemTypes,
  matchesRunes,
  matchesTierPoints,
  buildRuneCategoryMap,
  buildRunePriorityMap,
  buildRuneBonusMap,
  getRunewordSortKey,
  getRuneBonusesText,
  expandRunewordsByColumn,
  type RuneBonusMap,
  type RuneCategoryMap,
} from './filteringHelpers';

// Helper to create a minimal affix
function createAffix(rawText: string): Affix {
  return {
    rawText,
    pattern: rawText,
    value: null,
    valueType: 'none',
  };
}

// Helper to create empty bonuses
function createEmptyBonuses(): SocketableBonuses {
  return {
    weaponsGloves: [],
    helmsBoots: [],
    armorShieldsBelts: [],
  };
}

// Helper to create a minimal runeword
function createRuneword(overrides: Partial<Runeword> = {}): Runeword {
  return {
    name: 'Test Runeword',
    variant: 1,
    sockets: 3,
    reqLevel: 11,
    sortKey: 11, // ESR/Kanji runeword, sortKey = reqLevel
    runes: ['El Rune', 'Eld Rune', 'Tir Rune'],
    allowedItems: ['All Weapons'],
    excludedItems: [],
    affixes: [],
    columnAffixes: createEmptyBonuses(),
    tierPointTotals: [],
    ...overrides,
  };
}

// Helper to create a minimal ESR rune
function createEsrRune(name: string, tier: number, order: number = 1): EsrRune {
  return {
    name,
    order,
    tier,
    color: '#FFFFFF',
    reqLevel: 1,
    bonuses: createEmptyBonuses(),
  };
}

// Helper to create a minimal LoD rune
function createLodRune(name: string, order: number, tier: number = 1): LodRune {
  return {
    name,
    order,
    tier,
    reqLevel: 1,
    bonuses: createEmptyBonuses(),
  };
}

// Helper to create a minimal Kanji rune
function createKanjiRune(name: string): KanjiRune {
  return {
    name,
    reqLevel: 60,
    bonuses: createEmptyBonuses(),
  };
}

describe('parseSearchTerms', () => {
  it('should return empty array for empty string', () => {
    expect(parseSearchTerms('')).toEqual([]);
  });

  it('should return empty array for whitespace only', () => {
    expect(parseSearchTerms('   ')).toEqual([]);
  });

  it('should parse single word', () => {
    expect(parseSearchTerms('fire')).toEqual(['fire']);
  });

  it('should parse multiple words as separate terms', () => {
    expect(parseSearchTerms('fire resist')).toEqual(['fire', 'resist']);
  });

  it('should parse quoted phrase as single term', () => {
    expect(parseSearchTerms('"life stolen per hit"')).toEqual(['life stolen per hit']);
  });

  it('should parse mixed quoted and unquoted terms', () => {
    expect(parseSearchTerms('defense "life stolen" resist')).toEqual(['defense', 'life stolen', 'resist']);
  });

  it('should lowercase all terms', () => {
    expect(parseSearchTerms('FIRE Resist')).toEqual(['fire', 'resist']);
  });

  it('should handle multiple quoted phrases', () => {
    expect(parseSearchTerms('"fire damage" "cold resist"')).toEqual(['fire damage', 'cold resist']);
  });

  it('should handle empty quotes as literal match', () => {
    // Empty quotes are treated as a literal "" term by the regex
    expect(parseSearchTerms('fire "" resist')).toEqual(['fire', '""', 'resist']);
  });
});

describe('matchesSockets', () => {
  it('should return true when socketCount is null', () => {
    const runeword = createRuneword({ sockets: 3 });
    expect(matchesSockets(runeword, null)).toBe(true);
  });

  it('should return true when socket count matches', () => {
    const runeword = createRuneword({ sockets: 4 });
    expect(matchesSockets(runeword, 4)).toBe(true);
  });

  it('should return false when socket count does not match', () => {
    const runeword = createRuneword({ sockets: 3 });
    expect(matchesSockets(runeword, 4)).toBe(false);
  });
});

describe('matchesMaxReqLevel', () => {
  it('should return true when maxReqLevel is null', () => {
    const runeword = createRuneword({ reqLevel: 50 });
    expect(matchesMaxReqLevel(runeword, null)).toBe(true);
  });

  it('should return true when runeword reqLevel is below maxReqLevel', () => {
    const runeword = createRuneword({ reqLevel: 30 });
    expect(matchesMaxReqLevel(runeword, 50)).toBe(true);
  });

  it('should return true when runeword reqLevel equals maxReqLevel', () => {
    const runeword = createRuneword({ reqLevel: 50 });
    expect(matchesMaxReqLevel(runeword, 50)).toBe(true);
  });

  it('should return false when runeword reqLevel is above maxReqLevel', () => {
    const runeword = createRuneword({ reqLevel: 60 });
    expect(matchesMaxReqLevel(runeword, 50)).toBe(false);
  });

  it('should return true for runeword with reqLevel 0', () => {
    const runeword = createRuneword({ reqLevel: 0 });
    expect(matchesMaxReqLevel(runeword, 10)).toBe(true);
  });

  it('should handle edge case of maxReqLevel 1', () => {
    const lowLevelRuneword = createRuneword({ reqLevel: 1 });
    const midLevelRuneword = createRuneword({ reqLevel: 2 });
    expect(matchesMaxReqLevel(lowLevelRuneword, 1)).toBe(true);
    expect(matchesMaxReqLevel(midLevelRuneword, 1)).toBe(false);
  });

  it('should handle backwards compatibility for runewords without reqLevel field', () => {
    // Create a runeword object without reqLevel (simulating old cached data)
    const oldRuneword = {
      name: 'Old Runeword',
      variant: 1,
      sockets: 3,
      runes: ['El Rune', 'Eld Rune', 'Tir Rune'],
      allowedItems: ['All Weapons'],
      excludedItems: [],
      affixes: [],
      tierPointTotals: [],
    } as unknown as Runeword;

    // Should return true even with a filter set (don't hide old data)
    expect(matchesMaxReqLevel(oldRuneword, 50)).toBe(true);
  });
});

describe('matchesItemTypes', () => {
  it('should return true when selectedItemTypes is empty (uninitialized)', () => {
    const runeword = createRuneword({ allowedItems: ['Swords', 'Axes'] });
    expect(matchesItemTypes(runeword, {})).toBe(true);
  });

  it('should return true when any allowed item is selected', () => {
    const runeword = createRuneword({ allowedItems: ['Swords', 'Axes'] });
    expect(matchesItemTypes(runeword, { Swords: true, Axes: false })).toBe(true);
  });

  it('should return false when no allowed items are selected', () => {
    const runeword = createRuneword({ allowedItems: ['Swords', 'Axes'] });
    expect(matchesItemTypes(runeword, { Swords: false, Axes: false, Maces: true })).toBe(false);
  });

  it('should return true when multiple allowed items are selected', () => {
    const runeword = createRuneword({ allowedItems: ['Swords', 'Axes', 'Maces'] });
    expect(matchesItemTypes(runeword, { Swords: true, Axes: true, Maces: false })).toBe(true);
  });
});

describe('buildRuneCategoryMap', () => {
  it('should map ESR rune to esrRunes category', () => {
    const esrRunes = [createEsrRune('I Rune', 1)];
    const map = buildRuneCategoryMap(esrRunes, [], []);
    expect(map.get('I Rune')).toEqual(['esrRunes']);
  });

  it('should map LoD rune to lodRunes category', () => {
    const lodRunes = [createLodRune('El Rune', 1)];
    const map = buildRuneCategoryMap([], lodRunes, []);
    expect(map.get('El Rune')).toEqual(['lodRunes']);
  });

  it('should map Kanji rune to kanjiRunes category', () => {
    const kanjiRunes = [createKanjiRune('Moon Rune')];
    const map = buildRuneCategoryMap([], [], kanjiRunes);
    expect(map.get('Moon Rune')).toEqual(['kanjiRunes']);
  });

  it('should handle rune in multiple categories (Ko Rune)', () => {
    const esrRunes = [createEsrRune('Ko Rune', 3)];
    const lodRunes = [createLodRune('Ko Rune', 18, 2)];
    const map = buildRuneCategoryMap(esrRunes, lodRunes, []);
    expect(map.get('Ko Rune')).toEqual(['esrRunes', 'lodRunes']);
  });

  it('should return empty array for unknown rune', () => {
    const map = buildRuneCategoryMap([], [], []);
    expect(map.get('Unknown Rune')).toBeUndefined();
  });
});

describe('matchesRunes', () => {
  it('should return true when selectedRunes is empty (uninitialized)', () => {
    const runeword = createRuneword({ runes: ['El Rune', 'Eld Rune'] });
    const runeCategoryMap = new Map<string, string[]>();
    expect(matchesRunes(runeword, {}, runeCategoryMap)).toBe(true);
  });

  it('should return true when all runes are selected', () => {
    const runeword = createRuneword({ runes: ['El Rune', 'Eld Rune'] });
    const runeCategoryMap: RuneCategoryMap = new Map([
      ['El Rune', ['lodRunes']],
      ['Eld Rune', ['lodRunes']],
    ]);
    const selectedRunes = {
      'lodRunes:El Rune': true,
      'lodRunes:Eld Rune': true,
    };
    expect(matchesRunes(runeword, selectedRunes, runeCategoryMap)).toBe(true);
  });

  it('should return false when any rune is not selected in any category', () => {
    const runeword = createRuneword({ runes: ['El Rune', 'Eld Rune'] });
    const runeCategoryMap: RuneCategoryMap = new Map([
      ['El Rune', ['lodRunes']],
      ['Eld Rune', ['lodRunes']],
    ]);
    const selectedRunes = {
      'lodRunes:El Rune': true,
      'lodRunes:Eld Rune': false,
    };
    expect(matchesRunes(runeword, selectedRunes, runeCategoryMap)).toBe(false);
  });

  it('should return true when rune is selected in at least one category', () => {
    const runeword = createRuneword({ runes: ['Ko Rune'] });
    const runeCategoryMap: RuneCategoryMap = new Map([['Ko Rune', ['esrRunes', 'lodRunes']]]);
    const selectedRunes = {
      'esrRunes:Ko Rune': true,
      'lodRunes:Ko Rune': false,
    };
    expect(matchesRunes(runeword, selectedRunes, runeCategoryMap)).toBe(true);
  });

  it('should return false when rune is not in any category', () => {
    const runeword = createRuneword({ runes: ['Unknown Rune'] });
    const runeCategoryMap: RuneCategoryMap = new Map();
    const selectedRunes = { 'lodRunes:El Rune': true };
    expect(matchesRunes(runeword, selectedRunes, runeCategoryMap)).toBe(false);
  });
});

describe('buildRunePriorityMap', () => {
  it('should assign ESR tier 1 rune priority 100', () => {
    const esrRunes = [createEsrRune('I Rune', 1)];
    const map = buildRunePriorityMap(esrRunes, [], []);
    expect(map.get('I Rune')).toBe(100);
  });

  it('should assign ESR tier 7 rune priority 700', () => {
    const esrRunes = [createEsrRune('Null Rune', 7)];
    const map = buildRunePriorityMap(esrRunes, [], []);
    expect(map.get('Null Rune')).toBe(700);
  });

  it('should assign Kanji rune priority 800', () => {
    const kanjiRunes = [createKanjiRune('Moon Rune')];
    const map = buildRunePriorityMap([], kanjiRunes, []);
    expect(map.get('Moon Rune')).toBe(800);
  });

  it('should assign LoD rune El (order 1) priority 901', () => {
    const lodRunes = [createLodRune('El Rune', 1)];
    const map = buildRunePriorityMap([], [], lodRunes);
    expect(map.get('El Rune')).toBe(901);
  });

  it('should assign LoD rune Zod (order 33) priority 933', () => {
    const lodRunes = [createLodRune('Zod Rune', 33, 3)];
    const map = buildRunePriorityMap([], [], lodRunes);
    expect(map.get('Zod Rune')).toBe(933);
  });

  it('should return undefined for unknown rune', () => {
    const map = buildRunePriorityMap([], [], []);
    expect(map.get('Unknown Rune')).toBeUndefined();
  });
});

describe('getRunewordSortKey', () => {
  it('should return 0 for runeword with empty rune list', () => {
    const runeword = createRuneword({ runes: [] });
    const priorityMap = new Map<string, number>();
    expect(getRunewordSortKey(runeword, priorityMap)).toBe(0);
  });

  it('should return single rune priority', () => {
    const runeword = createRuneword({ runes: ['El Rune'] });
    const priorityMap = new Map([['El Rune', 901]]);
    expect(getRunewordSortKey(runeword, priorityMap)).toBe(901);
  });

  it('should return max priority among multiple runes', () => {
    const runeword = createRuneword({ runes: ['I Rune', 'Zod Rune', 'Moon Rune'] });
    const priorityMap = new Map([
      ['I Rune', 100],
      ['Zod Rune', 933],
      ['Moon Rune', 800],
    ]);
    expect(getRunewordSortKey(runeword, priorityMap)).toBe(933);
  });

  it('should return 0 for runes not in priority map', () => {
    const runeword = createRuneword({ runes: ['Unknown Rune'] });
    const priorityMap = new Map<string, number>();
    expect(getRunewordSortKey(runeword, priorityMap)).toBe(0);
  });
});

describe('buildRuneBonusMap', () => {
  it('should map ESR rune to its bonuses', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+10 to Attack Rating')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    const esrRunes: EsrRune[] = [{ ...createEsrRune('I Rune', 1), bonuses }];
    const map = buildRuneBonusMap(esrRunes, [], []);
    expect(map.get('I Rune')).toBe(bonuses);
  });

  it('should map LoD rune to its bonuses', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+50 to Attack Rating')],
      helmsBoots: [createAffix('+15 Defense')],
      armorShieldsBelts: [createAffix('+1 Light Radius')],
    };
    const lodRunes: LodRune[] = [{ ...createLodRune('El Rune', 1), bonuses }];
    const map = buildRuneBonusMap([], lodRunes, []);
    expect(map.get('El Rune')).toBe(bonuses);
  });

  it('should map Kanji rune to its bonuses', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+5% Fire Damage')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    const kanjiRunes: KanjiRune[] = [{ ...createKanjiRune('Fire Rune'), bonuses }];
    const map = buildRuneBonusMap([], [], kanjiRunes);
    expect(map.get('Fire Rune')).toBe(bonuses);
  });
});

describe('getRuneBonusesText', () => {
  it('should return empty string for runeword with no runes', () => {
    const runeword = createRuneword({ runes: [], allowedItems: ['All Weapons'] });
    const runeBonusMap: RuneBonusMap = new Map();
    expect(getRuneBonusesText(runeword, runeBonusMap)).toBe('');
  });

  it('should return empty string for rune not in bonus map', () => {
    const runeword = createRuneword({ runes: ['Unknown Rune'], allowedItems: ['All Weapons'] });
    const runeBonusMap: RuneBonusMap = new Map();
    expect(getRuneBonusesText(runeword, runeBonusMap)).toBe('');
  });

  it('should include relevant category bonuses for weapon runeword', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+10 to Attack Rating')],
      helmsBoots: [createAffix('+15 Defense')],
      armorShieldsBelts: [createAffix('+1 Light Radius')],
    };
    const runeBonusMap: RuneBonusMap = new Map([['El Rune', bonuses]]);
    const runeword = createRuneword({ runes: ['El Rune'], allowedItems: ['All Weapons'] });
    const result = getRuneBonusesText(runeword, runeBonusMap);
    expect(result).toContain('+10 to Attack Rating');
    expect(result).not.toContain('+15 Defense');
    expect(result).not.toContain('+1 Light Radius');
  });
});

describe('matchesSearch', () => {
  const emptyBonusMap: RuneBonusMap = new Map();

  it('should return true for empty search terms', () => {
    const runeword = createRuneword({ name: 'Spirit' });
    expect(matchesSearch(runeword, [], emptyBonusMap)).toBe(true);
  });

  it('should match runeword name', () => {
    const runeword = createRuneword({ name: 'Spirit' });
    expect(matchesSearch(runeword, ['spirit'], emptyBonusMap)).toBe(true);
  });

  it('should match runeword name case-insensitively', () => {
    // Note: searchTerms are expected to be lowercased (by parseSearchTerms)
    // matchesSearch lowercases the runeword name for comparison
    const runeword = createRuneword({ name: 'Spirit' });
    expect(matchesSearch(runeword, ['spirit'], emptyBonusMap)).toBe(true);
  });

  it('should match affix text', () => {
    const runeword = createRuneword({
      name: 'Test',
      affixes: [createAffix('+2 To All Skills')],
    });
    expect(matchesSearch(runeword, ['skills'], emptyBonusMap)).toBe(true);
  });

  it('should require all terms to match (AND logic)', () => {
    const runeword = createRuneword({
      name: 'Spirit Shield',
      affixes: [createAffix('+2 To All Skills')],
    });
    expect(matchesSearch(runeword, ['spirit', 'skills'], emptyBonusMap)).toBe(true);
    expect(matchesSearch(runeword, ['spirit', 'damage'], emptyBonusMap)).toBe(false);
  });

  it('should match rune bonus text', () => {
    const bonuses: SocketableBonuses = {
      weaponsGloves: [createAffix('+50% Fire Damage')],
      helmsBoots: [],
      armorShieldsBelts: [],
    };
    const runeBonusMap: RuneBonusMap = new Map([['El Rune', bonuses]]);
    const runeword = createRuneword({
      name: 'Test',
      runes: ['El Rune'],
      allowedItems: ['All Weapons'],
    });
    expect(matchesSearch(runeword, ['fire damage'], runeBonusMap)).toBe(true);
  });
});

describe('matchesTierPoints', () => {
  it('should return true when maxTierPoints is empty', () => {
    const runeword = createRuneword({
      tierPointTotals: [{ tier: 1, category: 'esrRunes', totalPoints: 100 }],
    });
    expect(matchesTierPoints(runeword, {})).toBe(true);
  });

  it('should return true when all tier limits are null', () => {
    const runeword = createRuneword({
      tierPointTotals: [{ tier: 1, category: 'esrRunes', totalPoints: 100 }],
    });
    expect(matchesTierPoints(runeword, { 'esrRunes:1': null })).toBe(true);
  });

  it('should return true when tier points are within limit', () => {
    const runeword = createRuneword({
      tierPointTotals: [{ tier: 1, category: 'esrRunes', totalPoints: 50 }],
    });
    expect(matchesTierPoints(runeword, { 'esrRunes:1': 64 })).toBe(true);
  });

  it('should return true when tier points equal limit', () => {
    const runeword = createRuneword({
      tierPointTotals: [{ tier: 1, category: 'esrRunes', totalPoints: 64 }],
    });
    expect(matchesTierPoints(runeword, { 'esrRunes:1': 64 })).toBe(true);
  });

  it('should return false when tier points exceed limit', () => {
    const runeword = createRuneword({
      tierPointTotals: [{ tier: 1, category: 'esrRunes', totalPoints: 100 }],
    });
    expect(matchesTierPoints(runeword, { 'esrRunes:1': 64 })).toBe(false);
  });

  it('should return true when runeword has no runes from the filtered tier', () => {
    const runeword = createRuneword({
      tierPointTotals: [{ tier: 1, category: 'esrRunes', totalPoints: 100 }],
    });
    expect(matchesTierPoints(runeword, { 'esrRunes:2': 10 })).toBe(true);
  });

  it('should handle multiple tier filters', () => {
    const runeword = createRuneword({
      tierPointTotals: [
        { tier: 1, category: 'esrRunes', totalPoints: 30 },
        { tier: 2, category: 'esrRunes', totalPoints: 50 },
      ],
    });
    // Both within limit
    expect(matchesTierPoints(runeword, { 'esrRunes:1': 64, 'esrRunes:2': 64 })).toBe(true);
    // One exceeds limit
    expect(matchesTierPoints(runeword, { 'esrRunes:1': 64, 'esrRunes:2': 40 })).toBe(false);
  });

  it('should handle LoD tier filters', () => {
    const runeword = createRuneword({
      tierPointTotals: [{ tier: 2, category: 'lodRunes', totalPoints: 128 }],
    });
    expect(matchesTierPoints(runeword, { 'lodRunes:2': 256 })).toBe(true);
    expect(matchesTierPoints(runeword, { 'lodRunes:2': 64 })).toBe(false);
  });
});

describe('expandRunewordsByColumn', () => {
  it('should not split runewords with a single category', () => {
    const runeword = createRuneword({ allowedItems: ['Melee Weapon'] });
    const result = expandRunewordsByColumn([runeword]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(runeword);
  });

  it('should not split runewords with identical column bonuses', () => {
    const sharedAffixes = [createAffix('+50 to Strength')];
    const runeword = createRuneword({
      allowedItems: ['Weapon', 'Charm'],
      columnAffixes: {
        weaponsGloves: sharedAffixes,
        helmsBoots: sharedAffixes,
        armorShieldsBelts: [],
      },
    });
    const result = expandRunewordsByColumn([runeword]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(runeword);
  });

  it('should split runewords with different column bonuses into separate entries', () => {
    const weaponAffixes = [createAffix('+100% Enhanced Damage')];
    const charmAffixes = [createAffix('+50 to Strength')];
    const runeword = createRuneword({
      name: 'Machine',
      allowedItems: ['Weapon', 'Charm'],
      affixes: weaponAffixes,
      columnAffixes: {
        weaponsGloves: weaponAffixes,
        helmsBoots: charmAffixes,
        armorShieldsBelts: [],
      },
    });

    const result = expandRunewordsByColumn([runeword]);
    expect(result).toHaveLength(2);

    // First entry: Weapon
    expect(result[0].name).toBe('Machine');
    expect(result[0].allowedItems).toEqual(['Weapon']);
    expect(result[0].affixes).toEqual(weaponAffixes);

    // Second entry: Charm
    expect(result[1].name).toBe('Machine');
    expect(result[1].allowedItems).toEqual(['Charm']);
    expect(result[1].affixes).toEqual(charmAffixes);
  });

  it('should preserve non-split runewords alongside split ones', () => {
    const simple = createRuneword({ name: 'Simple', allowedItems: ['Sword'] });
    const complex = createRuneword({
      name: 'Complex',
      allowedItems: ['Weapon', 'Charm'],
      columnAffixes: {
        weaponsGloves: [createAffix('Bonus A')],
        helmsBoots: [createAffix('Bonus B')],
        armorShieldsBelts: [],
      },
    });

    const result = expandRunewordsByColumn([simple, complex]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(simple);
    expect(result[1].allowedItems).toEqual(['Weapon']);
    expect(result[2].allowedItems).toEqual(['Charm']);
  });

  it('should handle split with excluded items', () => {
    const runeword = createRuneword({
      allowedItems: ['Staff', 'Weapon'],
      excludedItems: ['Orb'],
      columnAffixes: {
        weaponsGloves: [createAffix('Bonus A')],
        helmsBoots: [createAffix('Bonus B')],
        armorShieldsBelts: [],
      },
    });

    const result = expandRunewordsByColumn([runeword]);
    expect(result).toHaveLength(2);
    // Weapon entry has no excluded items (Orb is helmsBoots category)
    expect(result[0].allowedItems).toEqual(['Weapon']);
    expect(result[0].excludedItems).toEqual([]);
    // Staff entry gets the Orb exclusion (both are helmsBoots)
    expect(result[1].allowedItems).toEqual(['Staff']);
    expect(result[1].excludedItems).toEqual(['Orb']);
  });

  it('should keep shared fields unchanged in split entries', () => {
    const runeword = createRuneword({
      name: 'Machine',
      variant: 1,
      sockets: 3,
      runes: ['Ki Rune', 'Ka Rune', 'I Rune'],
      allowedItems: ['Weapon', 'Charm'],
      columnAffixes: {
        weaponsGloves: [createAffix('Bonus A')],
        helmsBoots: [createAffix('Bonus B')],
        armorShieldsBelts: [],
      },
    });

    const result = expandRunewordsByColumn([runeword]);
    for (const entry of result) {
      expect(entry.name).toBe('Machine');
      expect(entry.variant).toBe(1);
      expect(entry.sockets).toBe(3);
      expect(entry.runes).toEqual(['Ki Rune', 'Ka Rune', 'I Rune']);
    }
  });
});
