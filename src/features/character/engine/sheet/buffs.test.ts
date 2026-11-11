import { describe, expect, it } from 'vitest';
import { listAvailableBuffs } from './buffs';
import { computeCharacterSheet } from './sheet';
import { equipped, item, sheetData as data, testCharacter } from './testSheet.mock';

const L = 256;
const BATTLE_ORDERS = 570;
const BATTLE_COMMAND = 582;
const SHOUT = 563;
const FADE = 647;

const barbarian = (skills: Record<number, number>, items = [item('cap', equipped('head'), [], { defense: 100 })]) =>
  testCharacter({ attributes: { strength: 50, maxhp: 100 * L, maxmana: 50 * L }, skills, items });

describe('computeCharacterSheet with buffs', () => {
  it('counts a cast buff at its effective level: Battle Orders = 35% + 3% per level after the first', () => {
    const character = barbarian({ [BATTLE_ORDERS]: 1 });
    const sheet = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }] });
    expect(sheet.life.value).toBe(135);
    expect(sheet.mana.value).toBe(Math.floor(50 * 1.35));
    expect(sheet.buffs).toEqual([
      {
        skillId: BATTLE_ORDERS,
        name: data.skillName(BATTLE_ORDERS),
        level: 1,
        stats: { item_maxmana_percent: 35, item_maxhp_percent: 35, skill_staminapercent: 35 },
      },
    ]);
    expect(sheet.life.sources.find((source) => source.kind === 'percent')?.label).toContain('35%');
  });

  it('marks every number a buff changes unverified and leaves the others as they were', () => {
    const character = barbarian({ [BATTLE_ORDERS]: 1, [SHOUT]: 1 });
    const plain = computeCharacterSheet(character, data);
    const buffed = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }, { skillId: SHOUT }] });
    expect(plain.life.status).toBe('verified');
    expect(buffed.life.status).toBe('unverified');
    expect(buffed.defense.status).toBe('unverified');
    expect(buffed.defense.value).toBeGreaterThan(plain.defense.value);
    expect(buffed.attributes.strength).toEqual(plain.attributes.strength);
    expect(buffed.resists.fire.status).toBe('verified');
  });

  it('re-evaluates until stable: Battle Command’s +skills raise Battle Orders (and itself)', () => {
    const character = barbarian({ [BATTLE_ORDERS]: 1, [BATTLE_COMMAND]: 1 });
    const sheet = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }, { skillId: BATTLE_COMMAND }] });
    const levelOf = (id: number) => sheet.buffs.find((buff) => buff.skillId === id)?.level;
    expect(levelOf(BATTLE_ORDERS)).toBe(2);
    expect(levelOf(BATTLE_COMMAND)).toBe(2);
    expect(sheet.skills.all.value).toBe(1);
    expect(sheet.life.value).toBe(138);
  });

  it('takes a given level (a proc, an oskill the save does not show) and reports a buff it cannot count', () => {
    const character = barbarian({});
    const given = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS, level: 11 }] });
    expect(given.life.value).toBe(100 + 35 + 30);
    const missing = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }] });
    expect(missing.life.value).toBe(100);
    expect(missing.warnings.some((warning) => warning.includes('does not have it'))).toBe(true);
  });
});

describe('listAvailableBuffs', () => {
  it('lists own cast skills and auras whose stats reach the character and change the sheet', () => {
    const barb = listAvailableBuffs(barbarian({ [BATTLE_ORDERS]: 1, [SHOUT]: 3, 580: 5 }), data);
    expect(barb.map((buff) => [buff.skillId, buff.kind, buff.level])).toEqual(
      expect.arrayContaining([
        [BATTLE_ORDERS, 'cast', 1],
        [SHOUT, 'cast', 3],
      ])
    );
    // Iron Skin is a passive: already in the unbuffed sheet
    expect(barb.some((buff) => buff.skillId === 580)).toBe(false);
    expect(barb.find((buff) => buff.skillId === BATTLE_ORDERS)?.stats).toEqual([
      'item_maxmana_percent',
      'item_maxhp_percent',
      'skill_staminapercent',
    ]);

    const paladin = listAvailableBuffs(testCharacter({ classId: 3, skills: { 540: 1, 555: 1 } }), data);
    expect(paladin.find((buff) => buff.skillId === 540)).toBeUndefined(); // Might: damage only, not on the sheet
    expect(paladin.find((buff) => buff.skillId === 555)).toBeUndefined(); // Conviction: enemies only

    const necromancer = listAvailableBuffs(testCharacter({ classId: 2, skills: { 495: 5, 493: 5, 488: 5 } }), data);
    // Amplify Damage is a curse, Raise Skeleton a summon; Bone Armor reaches the caster
    expect(necromancer.map((buff) => buff.skillId)).toEqual([488]);
  });

  it('lists self-buff procs of active items with their level and chance', () => {
    const character = barbarian({}, [item('cap', equipped('head'), [['item_skillonhit', (FADE << 6) | 7, 10]], { defense: 10 })]);
    expect(listAvailableBuffs(character, data)).toContainEqual(
      expect.objectContaining({ skillId: FADE, kind: 'proc', level: 7, chance: 10, item: 0 })
    );
  });
});
