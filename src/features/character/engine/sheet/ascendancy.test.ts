import { describe, expect, it } from 'vitest';
import type { CharSheetAscendancies } from '@/features/game-data/engine/schema';
import { ascendancyStats, readAscendancy, tiersText } from './ascendancy';
import { computeCharacterSheet } from './sheet';
import { charmAt, charSheetBundle, inventoryAt, item, sheetData as data, statId, testCharacter } from './testSheet.mock';

const BARBARIAN = 4;
/** Tiers 1–4 (bits 0–3) + ascended once (bit 6): the owner's 3.3.04 SpinToWin save */
const TIERS_1_TO_4 = 0b1001111;
const LICH_KING = 1 << 5;

/** Synthetic plugin data: two ascendancies, the saved stats at the ids the save uses */
const SYNTHETIC: CharSheetAscendancies = {
  stats: { ascendancy: 1064, progress: 1065, soulstones: 1066, orb: 1067 },
  soulstoneCap: 10,
  soulstoneTier: 4,
  classSkills: [0, 1, 2, 3, 4, 5, 6, 7].map((cls) => [83, cls]),
  lichKing: [[826, 0, 1]],
  legacy: { item: 'ast', tierStats: [676, 677, 678, 680], soulstoneStat: 919, lichKingStat: 826 },
  list: [
    {
      index: 1,
      name: 'First',
      legacyUnique: 1100,
      tiers: [1, 2, 3, 4, 5].map((tier) => ({ classSkills: tier === 5 ? 3 : 0, stats: [[0, 0, tier]] })),
    },
    {
      index: 2,
      name: 'Second',
      legacyUnique: 1102,
      tiers: [1, 2, 3, 4, 5].map((tier) => ({ classSkills: tier <= 2 ? 1 : 0, stats: [[2, 0, tier * 10]] })),
    },
  ],
};

const saved = (attributes: Record<string, number>) => testCharacter({ classId: BARBARIAN, attributes });
const stone = (uniqueId: number, specs: Parameters<typeof item>[2] = [], location = charmAt(4, 6)) =>
  item('ast', location, specs, { uniqueId, quality: 'unique' });

describe('readAscendancy: the saved stats (ESR 3.3.04+)', () => {
  it('decodes the 1-based index, the tier bits, the Lich King and ascended bits, soulstones and the orb', () => {
    const character = saved({ ascendancy: 2, ascendancy_progress: TIERS_1_TO_4, ascendancy_soulstones: 10, ascendancy_orb: 1 });
    expect(readAscendancy(character, SYNTHETIC)).toEqual({
      source: 'save',
      index: 2,
      name: 'Second',
      tiers: [1, 2, 3, 4],
      lichKing: false,
      ascendedOnce: true,
      soulstones: 10,
      soulstoneCap: 10,
      soulstoneTier: 4,
      orbConsumed: true,
    });
    const all = readAscendancy(saved({ ascendancy: 1, ascendancy_progress: 0b1111111, ascendancy_orb: 1 }), SYNTHETIC);
    expect(all).toMatchObject({ name: 'First', tiers: [1, 2, 3, 4, 5], lichKing: true });
    // Tiers come in any order (tier 4 from soulstones without tier 3)
    expect(readAscendancy(saved({ ascendancy: 1, ascendancy_progress: 0b1011 }), SYNTHETIC)?.tiers).toEqual([1, 2, 4]);
  });

  it('keeps an index this data does not know (name null), the orb without a choice, and nothing at all as null', () => {
    expect(readAscendancy(saved({ ascendancy: 16, ascendancy_progress: 1 }), SYNTHETIC)).toMatchObject({
      index: 16,
      name: null,
      tiers: [1],
    });
    expect(readAscendancy(saved({ ascendancy_orb: 1 }), SYNTHETIC)).toMatchObject({ index: 0, name: null, tiers: [], orbConsumed: true });
    expect(readAscendancy(saved({}), SYNTHETIC)).toBeNull();
    expect(readAscendancy(saved({ ascendancy: 2 }), null)).toBeNull();
  });

  it('prefers the saved stats over a stone the character still holds', () => {
    const character = { ...saved({ ascendancy: 1, ascendancy_progress: 1 }), items: { ...saved({}).items, player: [stone(1102)] } };
    expect(readAscendancy(character, SYNTHETIC)).toMatchObject({ source: 'save', name: 'First' });
  });
});

describe('readAscendancy: an old Ascendancy Stone (the plugin converts it on login)', () => {
  const holding = (...stones: ReturnType<typeof stone>[]) => testCharacter({ classId: BARBARIAN, items: stones });

  it('reads the ascendancy from the stone’s uniqueitems row and the tiers from its tier stats (tier 1 always)', () => {
    const character = holding(
      stone(1102, [
        ['ascendancy_tier_2', 1],
        ['ascendancy_tier_3', 1],
      ])
    );
    expect(readAscendancy(character, SYNTHETIC)).toEqual({
      source: 'stone',
      index: 2,
      name: 'Second',
      tiers: [1, 2, 3],
      lichKing: false,
      ascendedOnce: true,
      soulstones: 0,
      soulstoneCap: 10,
      soulstoneTier: 4,
      orbConsumed: true,
      stoneItem: 0,
    });
  });

  it('takes tier 4 from 10 soulstones, tier 5 and the Lich King bonus from their stone stats', () => {
    const character = holding(
      stone(1100, [
        ['ascendancy_tier_4_count_new', 10],
        ['ascendancy_tier_5', 1],
        ['lichkingbonus', 1],
      ])
    );
    expect(readAscendancy(character, SYNTHETIC)).toMatchObject({ name: 'First', tiers: [1, 4, 5], soulstones: 10, lichKing: true });
  });

  it('prefers the stone in the Charm Inventory, else takes one anywhere; a stone of an unknown row is none', () => {
    const elsewhere = stone(1100, [], inventoryAt(0, 0));
    expect(readAscendancy(holding(elsewhere, stone(1102)), SYNTHETIC)).toMatchObject({ name: 'Second', stoneItem: 1 });
    expect(readAscendancy(holding(elsewhere), SYNTHETIC)).toMatchObject({ name: 'First', stoneItem: 0 });
    expect(readAscendancy(holding(stone(999)), SYNTHETIC)).toBeNull();
  });
});

describe('ascendancyStats', () => {
  it('adds up the unlocked tiers, the class skill value as the class’s own stat, and the Lich King bonus', () => {
    const second = readAscendancy(saved({ ascendancy: 2, ascendancy_progress: 0b1011 | LICH_KING }), SYNTHETIC);
    if (second === null) throw new Error('no ascendancy');
    expect(ascendancyStats(second, BARBARIAN, SYNTHETIC)).toEqual([
      { id: 2, param: 0, value: 10 },
      { id: 2, param: 0, value: 20 },
      { id: 2, param: 0, value: 40 },
      { id: 83, param: BARBARIAN, value: 2 },
      { id: 826, param: 0, value: 1 },
    ]);
    const unknown = readAscendancy(saved({ ascendancy: 16, ascendancy_progress: 1 }), SYNTHETIC);
    if (unknown === null) throw new Error('no ascendancy');
    expect(ascendancyStats(unknown, BARBARIAN, SYNTHETIC)).toEqual([]);
  });

  it('names the tiers', () => {
    expect([tiersText([]), tiersText([1]), tiersText([1, 2, 3, 4]), tiersText([1, 2, 4])]).toEqual([
      'no tier',
      'tier 1',
      'tiers 1–4',
      'tiers 1, 2 and 4',
    ]);
  });
});

describe('computeCharacterSheet: the ascendancy (committed charsheet.json)', () => {
  const blademaster = (progress: number) =>
    testCharacter({
      classId: BARBARIAN,
      attributes: { strength: 100, dexterity: 100, ascendancy: 2, ascendancy_progress: progress, ascendancy_orb: 1 },
    });

  it('applies the saved Blademaster tiers 1–4: attributes, class skills, physical resist and the tier 4 aura’s life leech', () => {
    const sheet = computeCharacterSheet(blademaster(TIERS_1_TO_4), data);
    // (100 + 60) × 125% = 200
    expect(sheet.attributes.strength.value).toBe(200);
    expect(sheet.attributes.dexterity.value).toBe(200);
    expect(sheet.attributes.strength.sources).toContainEqual({ kind: 'ascendancy', label: 'Blademaster ascendancy, tiers 1–4', value: 60 });
    expect(sheet.resists.physical.value).toBe(20);
    // Blademaster Ascendancy Tier 4 (skill 1510): life leech = physical resist
    expect(sheet.leech.life.value).toBe(20);
    expect(sheet.leech.life.sources).toContainEqual(expect.objectContaining({ kind: 'ascendancy', skill: 1510, value: 20 }));
    expect(sheet.skills.cls.value).toBe(2);
    expect(sheet.facts).toMatchObject({ ascendancyTier: 4, ascendancy: { name: 'Blademaster', tiers: [1, 2, 3, 4], source: 'save' } });
    expect(sheet.warnings).toEqual([]);
  });

  it('applies only the unlocked tiers (tier 1 alone: no aura, no physical resist)', () => {
    const sheet = computeCharacterSheet(blademaster(1), data);
    expect(sheet.attributes.strength.value).toBe(160);
    expect(sheet.resists.physical.value).toBe(0);
    expect(sheet.leech.life.value).toBe(0);
    expect(sheet.facts.ascendancyTier).toBe(1);
  });

  it('raises the tier 3 / 4 aura scaling by 10% with the Lich King bonus (skills.txt lichkingbonus × 10)', () => {
    const sheet = computeCharacterSheet(blademaster(TIERS_1_TO_4 | LICH_KING), data);
    expect(sheet.leech.life.value).toBe(22);
    expect(sheet.facts.ascendancy?.lichKing).toBe(true);
  });

  it('converts an old stone through the same data and leaves its own stats out (no double count)', () => {
    const blademasterStone = item(
      'ast',
      charmAt(4, 6),
      [
        ['strength', 60],
        ['dexterity', 60],
        ['damageresist', 20],
        ['item_aura', 789, 1],
        ['item_aura', 1510, 1],
        ['ascendancy_tier_2', 1],
        ['ascendancy_tier_3', 1],
        ['ascendancy_tier_4', 1],
      ],
      { uniqueId: 1102, quality: 'unique' }
    );
    const fromStone = computeCharacterSheet(
      testCharacter({ classId: BARBARIAN, attributes: { strength: 100, dexterity: 100 }, items: [blademasterStone] }),
      data
    );
    const fromSave = computeCharacterSheet(blademaster(TIERS_1_TO_4), data);
    expect(fromStone.attributes.strength.value).toBe(fromSave.attributes.strength.value);
    expect(fromStone.leech.life.value).toBe(fromSave.leech.life.value);
    expect(fromStone.attributes.strength.sources.filter((source) => source.kind === 'item')).toEqual([]);
    expect(fromStone.facts.ascendancy).toMatchObject({ source: 'stone', name: 'Blademaster', tiers: [1, 2, 3, 4], stoneItem: 0 });
    expect(fromStone.warnings).toEqual([]);
  });

  it('warns about a saved index this data does not know and counts nothing for it', () => {
    const sheet = computeCharacterSheet(
      testCharacter({ classId: BARBARIAN, attributes: { ascendancy: 99, ascendancy_progress: 1, ascendancy_orb: 1 } }),
      data
    );
    expect(sheet.warnings.some((warning) => warning.includes('ascendancy 99'))).toBe(true);
    expect(sheet.facts.ascendancy).toMatchObject({ index: 99, name: null });
  });

  it('uses the stat ids the committed bundle names', () => {
    expect(charSheetBundle.ascendancyRules?.stats).toEqual({
      ascendancy: statId('ascendancy'),
      progress: statId('ascendancy_progress'),
      soulstones: statId('ascendancy_soulstones'),
      orb: statId('ascendancy_orb'),
    });
  });
});
