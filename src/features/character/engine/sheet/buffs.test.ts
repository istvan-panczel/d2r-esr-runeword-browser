import { describe, expect, it } from 'vitest';
import { listAvailableBuffs } from './buffs';
import { computeCharacterSheet } from './sheet';
import { charmAt, equipped, item, sheetData as data, testCharacter, unflaggedChanges } from './testSheet.mock';
import type { CharacterSheet } from './types';

const L = 256;
const BATTLE_ORDERS = 570;
const BATTLE_COMMAND = 582;
const SHOUT = 563;
const FADE = 647;
const ZEAL = 524;
const RESIST_FIRE = 527;
const SALVATION = 557;
const WEREWOLF = 595;
const WEREBEAR = 596;
const CALL_OF_THE_WILD = 625;
const PALADIN = 3;
const DRUID = 5;

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

describe('computeCharacterSheet with buffs: one instance, groups, dropped stats (review 2026-11-11)', () => {
  const paladin = (items = [item('cap', equipped('head'), [], { defense: 10 })], skills: Record<number, number> = {}) =>
    testCharacter({ classId: PALADIN, attributes: { maxhp: 100 * L }, skills, items });
  const fireAura = (level: number) => item('cm1', charmAt(0, 0), [['item_aura', RESIST_FIRE, level]]);

  it('counts an aura once: an item aura and the same skill selected, the higher level wins', () => {
    // Resist Fire: item_absorbfire_percent = 1 + lvl / 10
    const withAura = paladin([fireAura(10)]);
    expect(computeCharacterSheet(withAura, data).absorb.firePercent.value).toBe(2);
    const higher = computeCharacterSheet(withAura, data, { buffs: [{ skillId: RESIST_FIRE, level: 30 }] });
    expect(higher.absorb.firePercent.value).toBe(4);
    expect(higher.absorb.firePercent.sources.map((source) => source.kind)).toEqual(['buff']);
    const lower = computeCharacterSheet(withAura, data, { buffs: [{ skillId: RESIST_FIRE, level: 5 }] });
    expect(lower.absorb.firePercent.value).toBe(2);
    expect(lower.buffs).toEqual([]);
    expect(lower.warnings.some((warning) => warning.includes(data.skillName(RESIST_FIRE)) && warning.includes('item'))).toBe(true);
  });

  it('counts a skill selected twice once, at the highest level', () => {
    const character = barbarian({ [BATTLE_COMMAND]: 1 });
    const once = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_COMMAND }] });
    const twice = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_COMMAND }, { skillId: BATTLE_COMMAND }] });
    expect(twice.skills.all.value).toBe(once.skills.all.value);
    expect(twice.buffs).toHaveLength(1);
    const levels = computeCharacterSheet(barbarian({}), data, {
      buffs: [
        { skillId: BATTLE_ORDERS, level: 11 },
        { skillId: BATTLE_ORDERS, level: 1 },
      ],
    });
    expect(levels.life.value).toBe(100 + 35 + 30);
  });

  it('keeps the last selected buff of an exclusive group (own auras, shape-shifts), with a warning', () => {
    const both = computeCharacterSheet(paladin(undefined, { [RESIST_FIRE]: 10, [SALVATION]: 10 }), data, {
      buffs: [{ skillId: RESIST_FIRE }, { skillId: SALVATION }],
    });
    expect(both.buffs.map((buff) => buff.skillId)).toEqual([SALVATION]);
    expect(both.warnings.some((warning) => warning.includes(data.skillName(RESIST_FIRE)) && warning.includes('one'))).toBe(true);
    const druid = testCharacter({ classId: DRUID, attributes: { maxhp: 100 * L }, skills: { [WEREWOLF]: 5, [WEREBEAR]: 5 } });
    const forms = computeCharacterSheet(druid, data, { buffs: [{ skillId: WEREBEAR }, { skillId: WEREWOLF }] });
    expect(forms.buffs.map((buff) => buff.skillId)).toEqual([WEREWOLF]);
    // an item aura is apart from the own aura
    const itemAndOwn = computeCharacterSheet(paladin([fireAura(10)], { [SALVATION]: 10 }), data, { buffs: [{ skillId: SALVATION }] });
    expect(itemAndOwn.absorb.firePercent.value).toBe(2);
    expect(itemAndOwn.buffs.map((buff) => buff.skillId)).toEqual([SALVATION]);
  });

  it('warns about a buff stat no sheet value takes (Call of the Wild’s item_armor_percent) and does not list it', () => {
    const druid = testCharacter({
      classId: DRUID,
      skills: { [CALL_OF_THE_WILD]: 10 },
      items: [item('cap', equipped('head'), [], { defense: 100 })],
    });
    const plain = computeCharacterSheet(druid, data);
    const buffed = computeCharacterSheet(druid, data, { buffs: [{ skillId: CALL_OF_THE_WILD }] });
    expect(buffed.defense.value).toBe(plain.defense.value);
    expect(buffed.warnings.some((warning) => warning.includes('Call of the Wild') && warning.includes('item_armor_percent'))).toBe(true);
    const listed = listAvailableBuffs(druid, data).find((buff) => buff.skillId === CALL_OF_THE_WILD);
    expect(listed?.stats).toEqual(['velocitypercent', 'hpregen']);
  });
});

describe('computeCharacterSheet with buffs: the unverified flag is structural (review 2026-11-11)', () => {
  const check = (plain: CharacterSheet, buffed: CharacterSheet) => {
    expect(unflaggedChanges(plain, buffed)).toEqual([]);
  };

  it('flags skill levels Battle Command raises and the ones only it shows', () => {
    const character = barbarian({ [BATTLE_ORDERS]: 1, [BATTLE_COMMAND]: 1, [SHOUT]: 1 });
    const plain = computeCharacterSheet(character, data);
    const buffed = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_COMMAND }] });
    expect(buffed.skills.levels.find((skill) => skill.skillId === SHOUT)?.status).toBe('unverified');
    expect(plain.skills.levels.find((skill) => skill.skillId === SHOUT)?.status).toBe('verified');
    check(plain, buffed);
  });

  it('flags a resist whose cap a buff raises although the shown value stays (Salvation)', () => {
    const character = testCharacter({
      classId: PALADIN,
      skills: { [SALVATION]: 10 },
      items: [item('cap', equipped('head'), [['fireresist', 200]])],
    });
    const plain = computeCharacterSheet(character, data);
    const buffed = computeCharacterSheet(character, data, { buffs: [{ skillId: SALVATION }] });
    expect(buffed.resists.fire.cap).toBeGreaterThan(plain.resists.fire.cap);
    expect(buffed.resists.fire.status).toBe('unverified');
    expect(buffed.resists.poison.status).toBe('verified');
    check(plain, buffed);
  });

  it('flags hand lines by skill: a line whose skill level a buff raises', () => {
    const character = testCharacter({
      classId: PALADIN,
      skills: { [ZEAL]: 1 },
      items: [item('hax', equipped('rightHand', 1)), item('hax', equipped('leftHand', 1))],
      handSkills: { left: ZEAL, right: 0 },
    });
    const plain = computeCharacterSheet(character, data);
    const buffed = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_COMMAND, level: 5 }] });
    expect(buffed.attackRating.hands.find((hand) => hand.skillId === ZEAL)?.status).toBe('unverified');
    expect(buffed.attackRating.hands.find((hand) => hand.skillId === 0)?.status).toBe('verified');
    check(plain, buffed);
  });

  it('holds for every buff a rich character can select', () => {
    const character = barbarian({ [BATTLE_ORDERS]: 5, [BATTLE_COMMAND]: 3, [SHOUT]: 4, 580: 5 }, [
      item('cap', equipped('head'), [['fireresist', 30]], { defense: 100 }),
      item('hax', equipped('rightHand', 1), [['item_skillonhit', (FADE << 6) | 7, 10]]),
      item('hax', equipped('leftHand', 1), [['item_fasterattackrate', 20]]),
    ]);
    const plain = computeCharacterSheet(character, data);
    const buffs = listAvailableBuffs(character, data).map((buff) => ({ skillId: buff.skillId, level: buff.level }));
    expect(buffs.length).toBeGreaterThan(2);
    check(plain, computeCharacterSheet(character, data, { buffs }));
  });
});

describe('listAvailableBuffs: one entry per skill, exclusive groups (review 2026-11-11)', () => {
  it('lists a skill once: the own skill unless a proc gives a higher level, with every item that procs it', () => {
    const proc = (level: number, chance: number) => [['item_skillonhit', (ZEAL << 6) | level, chance]] as [string, number, number][];
    const character = testCharacter({
      classId: PALADIN,
      skills: { [ZEAL]: 20 },
      items: [item('cap', equipped('head'), proc(30, 5), { defense: 10 }), item('hax', equipped('rightHand', 1), proc(10, 7))],
    });
    const zeal = listAvailableBuffs(character, data).filter((buff) => buff.skillId === ZEAL);
    expect(zeal).toHaveLength(1);
    expect(zeal[0]).toMatchObject({ kind: 'proc', level: 30, item: 0, chance: 5, items: [0, 1] });
    const own = listAvailableBuffs({ ...character, skills: [{ skillId: ZEAL, points: 40 }] }, data).filter((buff) => buff.skillId === ZEAL);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ kind: 'cast', level: 40, items: [0, 1] });
  });

  it('marks own auras and shape-shifts as exclusive groups, read from the skill data', () => {
    const paladin = listAvailableBuffs(testCharacter({ classId: PALADIN, skills: { [RESIST_FIRE]: 1, [SALVATION]: 1, [ZEAL]: 1 } }), data);
    expect(paladin.find((buff) => buff.skillId === RESIST_FIRE)?.exclusiveGroup).toBe('aura');
    expect(paladin.find((buff) => buff.skillId === SALVATION)?.exclusiveGroup).toBe('aura');
    expect(paladin.find((buff) => buff.skillId === ZEAL)?.exclusiveGroup).toBeUndefined();
    const druid = listAvailableBuffs(
      testCharacter({ classId: DRUID, skills: { [WEREWOLF]: 1, [WEREBEAR]: 1, [CALL_OF_THE_WILD]: 1 } }),
      data
    );
    expect(druid.find((buff) => buff.skillId === WEREWOLF)?.exclusiveGroup).toBe('shapeshift');
    expect(druid.find((buff) => buff.skillId === WEREBEAR)?.exclusiveGroup).toBe('shapeshift');
    expect(druid.find((buff) => buff.skillId === CALL_OF_THE_WILD)?.exclusiveGroup).toBeUndefined();
  });
});
