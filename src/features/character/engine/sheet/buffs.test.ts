import { describe, expect, it } from 'vitest';
import { listAvailableBuffs } from './buffs';
import { usableSelections } from '../sheetView';
import { computeCharacterSheet } from './sheet';
import { castOnSwap } from './otherSet';
import { charSheetBundle, charmAt, equipped, item, sheetData as data, testCharacter, unflaggedChanges } from './testSheet.mock';
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

  it('takes a given level of a skill the character has and reports a buff it cannot count', () => {
    const given = computeCharacterSheet(barbarian({ [BATTLE_ORDERS]: 1 }), data, { buffs: [{ skillId: BATTLE_ORDERS, level: 11 }] });
    expect(given.life.value).toBe(100 + 35 + 30);
    const missing = computeCharacterSheet(barbarian({}), data, { buffs: [{ skillId: BATTLE_ORDERS }] });
    expect(missing.life.value).toBe(100);
    expect(missing.warnings.some((warning) => warning.includes('does not have it'))).toBe(true);
  });

  it('refuses a skill the character cannot use, even with a level (a remembered selection of another character)', () => {
    const character = barbarian({});
    const sheet = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS, level: 11 }] });
    expect(sheet.life.value).toBe(100);
    expect(sheet.buffs).toEqual([]);
    expect(sheet.warnings.some((warning) => warning.includes(data.skillName(BATTLE_ORDERS)) && warning.includes('does not have it'))).toBe(
      true
    );
    // A proc of an active item is usable at its level without points
    const proc = barbarian({}, [item('cap', equipped('head'), [['item_skillonhit', (BATTLE_ORDERS << 6) | 11, 10]], { defense: 10 })]);
    expect(computeCharacterSheet(proc, data, { buffs: [{ skillId: BATTLE_ORDERS, level: 11 }] }).life.value).toBe(100 + 35 + 30);
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

  it('leaves out a skill whose sheet stats are 0 at its level (Maul’s run speed and leech need Shared Savagery)', () => {
    const druid = testCharacter({ classId: DRUID, skills: { 609: 3 } });
    expect(listAvailableBuffs(druid, data).some((buff) => buff.skillId === 609)).toBe(false);
    // Feral Rage gives run speed from its own level: listed, with only the stats that are not 0
    const feral = listAvailableBuffs(testCharacter({ classId: DRUID, skills: { 608: 3 } }), data).find((buff) => buff.skillId === 608);
    expect(feral?.stats).toEqual(['velocitypercent', 'lifedrainmindam']);
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
    const levels = computeCharacterSheet(barbarian({ [BATTLE_ORDERS]: 1 }), data, {
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
    expect(buffed.warnings.some((warning) => warning.includes('Call of the Wild') && warning.includes('Enhanced Defense'))).toBe(true);
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
      // Battle Command reaches the paladin through a proc of the main-hand axe
      items: [
        item('hax', equipped('rightHand', 1), [['item_skillonhit', (BATTLE_COMMAND << 6) | 5, 10]]),
        item('hax', equipped('leftHand', 1)),
      ],
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

describe('buffs cast on the other weapon set (swap, cast, swap back)', () => {
  const SORCERESS = 1;
  const SALVATION_AURA = SALVATION;
  const FRENZY = 574;
  const WHIRLWIND = 590;
  const SMITE = 525;
  const cap = item('cap', equipped('head'), [], { defense: 100 });
  /** A Call to Arms-like weapon: oskills of Battle Orders / Battle Command, +all skills */
  const swapWeapon = (set: 1 | 2, specs: [string, number, number][] | [string, number][]) => item('hax', equipped('rightHand', set), specs);
  const sorceress = (items = [cap, swapWeapon(2, [['item_nonclassskill', BATTLE_ORDERS, 5]])]) =>
    testCharacter({ classId: SORCERESS, attributes: { maxhp: 100 * L, maxmana: 50 * L }, items });
  const levelOf = (sheet: CharacterSheet, id: number) => sheet.buffs.find((buff) => buff.skillId === id);

  it('lists a cast skill only the other set gives, at that set’s level, and counts it there', () => {
    const character = sorceress();
    const listed = listAvailableBuffs(character, data).find((buff) => buff.skillId === BATTLE_ORDERS);
    expect(listed).toMatchObject({ kind: 'cast', level: 5, castSet: 2 });
    const sheet = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }] });
    // 35% + 3% × 4
    expect(sheet.life.value).toBe(147);
    expect(levelOf(sheet, BATTLE_ORDERS)).toMatchObject({ level: 5, castSet: 2 });
    expect(sheet.warnings.some((warning) => warning.includes('does not have it'))).toBe(false);
    expect(sheet.life.status).toBe('unverified');
  });

  it('lists a cast skill at the other set’s higher level; a tie or a better set in hand stays with the set in hand', () => {
    const allSkills = (set: 1 | 2, amount: number) => swapWeapon(set, [['item_allskills', amount]]);
    const higher = barbarian({ [BATTLE_ORDERS]: 1 }, [cap, allSkills(1, 1), allSkills(2, 3)]);
    expect(listAvailableBuffs(higher, data).find((buff) => buff.skillId === BATTLE_ORDERS)).toMatchObject({ level: 4, castSet: 2 });
    const sheet = computeCharacterSheet(higher, data, { buffs: [{ skillId: BATTLE_ORDERS }] });
    expect(levelOf(sheet, BATTLE_ORDERS)).toMatchObject({ level: 4, castSet: 2 });
    expect(sheet.life.value).toBe(100 + 35 + 9);
    // The rest of the sheet is the set in hand: its skill levels stay
    expect(sheet.skills.levels.find((skill) => skill.skillId === BATTLE_ORDERS)?.level).toBe(2);

    for (const [inHand, swapped] of [
      [2, 2],
      [3, 2],
    ]) {
      const character = barbarian({ [BATTLE_ORDERS]: 1 }, [cap, allSkills(1, inHand), allSkills(2, swapped)]);
      const buff = listAvailableBuffs(character, data).find((entry) => entry.skillId === BATTLE_ORDERS);
      expect(buff?.level).toBe(1 + inHand);
      expect(buff?.castSet).toBeUndefined();
      const applied = levelOf(computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }] }), BATTLE_ORDERS);
      expect(applied?.level).toBe(1 + inHand);
      expect(applied?.castSet).toBeUndefined();
    }
  });

  it('names the set from a save written on set II: the other set is I', () => {
    const character = testCharacter({
      classId: SORCERESS,
      attributes: { maxhp: 100 * L },
      activeWeapon: 1,
      items: [cap, swapWeapon(1, [['item_nonclassskill', BATTLE_ORDERS, 5]])],
    });
    expect(listAvailableBuffs(character, data).find((buff) => buff.skillId === BATTLE_ORDERS)?.castSet).toBe(1);
    expect(levelOf(computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }] }), BATTLE_ORDERS)?.castSet).toBe(1);
  });

  it('casts Battle Orders on the other set with Battle Command up there (the recast rule across the swap)', () => {
    const character = sorceress([
      cap,
      swapWeapon(2, [
        ['item_nonclassskill', BATTLE_ORDERS, 5],
        ['item_nonclassskill', BATTLE_COMMAND, 5],
      ]),
    ]);
    // A Sorceress with oskills only: Battle Command's +all skills does not raise an oskill of another class
    const sorc = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }, { skillId: BATTLE_COMMAND }] });
    expect(levelOf(sorc, BATTLE_ORDERS)).toMatchObject({ level: 5, castSet: 2 });
    expect(levelOf(sorc, BATTLE_COMMAND)).toMatchObject({ level: 5, castSet: 2 });
    expect(sorc.skills.all.value).toBeGreaterThan(0);

    // A Barbarian with points: on set II Battle Command raises itself and Battle Orders, and the set in hand gets both
    const barb = barbarian({ [BATTLE_ORDERS]: 1, [BATTLE_COMMAND]: 1 }, [cap, swapWeapon(2, [['item_allskills', 3]])]);
    const buffs = [{ skillId: BATTLE_ORDERS }, { skillId: BATTLE_COMMAND }];
    const sheet = computeCharacterSheet(barb, data, { buffs });
    // The same buffs computed with set II in hand give the levels the casts have there
    const onSetII = computeCharacterSheet({ ...barb, activeWeapon: 1 }, data, { buffs });
    const bc = levelOf(sheet, BATTLE_COMMAND);
    const bo = levelOf(sheet, BATTLE_ORDERS);
    expect(bc).toMatchObject({ level: levelOf(onSetII, BATTLE_COMMAND)?.level, castSet: 2 });
    expect(bo).toMatchObject({ level: levelOf(onSetII, BATTLE_ORDERS)?.level, castSet: 2 });
    expect(bo?.level).toBeGreaterThan(4);
    // Battle Command's +skills count on the set in hand at its set II level
    expect(sheet.skills.all.value).toBe(onSetII.skills.all.value - 3);
    expect(sheet.life.value).toBe(onSetII.life.value);
    // The source says where it was cast
    expect(sheet.skills.all.sources.find((source) => source.kind === 'buff')?.label).toBe(
      `${data.skillName(BATTLE_COMMAND)} (cast on weapon set II)`
    );
  });

  it('keeps a chosen level: it wins over the other set’s', () => {
    const sheet = computeCharacterSheet(sorceress(), data, { buffs: [{ skillId: BATTLE_ORDERS, level: 2 }] });
    expect(levelOf(sheet, BATTLE_ORDERS)).toEqual(expect.objectContaining({ level: 2 }));
    expect(levelOf(sheet, BATTLE_ORDERS)?.castSet).toBeUndefined();
    expect(sheet.life.value).toBe(100 + 38);
  });

  it('tells cast skills from attacks by skills.txt range (and weapsel, and weapon-bound hexes)', () => {
    const idOf = (name: string) => {
      const skill = charSheetBundle.skills.find((entry) => entry.row.id === name);
      if (skill === undefined) throw new Error(name);
      return skill.n;
    };
    const cast = [
      'Battle Orders',
      'Battle Command',
      'Shout',
      'Fade',
      'Venom',
      'Burst of Speed',
      'Energy Shield',
      'Enchant',
      'Cold Enchant',
      'Shiver Armor',
      'Holy Armor',
      'Bone Armor',
      'Shade Armor',
    ];
    const attacks = ['Frenzy', 'Zeal', 'Whirlwind', 'Smite', 'Feral Rage', 'Berserk', 'Lightning Fury', 'Hex Bane'];
    expect(cast.filter((name) => !castOnSwap(data, idOf(name)))).toEqual([]);
    expect(attacks.filter((name) => castOnSwap(data, idOf(name)))).toEqual([]);
    // Not an aura or a passive; a shape-shift is a cast skill like the others
    expect([SALVATION, 580].filter((id) => castOnSwap(data, id))).toEqual([]);
    expect([WEREWOLF, WEREBEAR].filter((id) => !castOnSwap(data, id))).toEqual([]);
  });

  it('offers Enchant from the other set (a classic pre-buff on a +skills swap)', () => {
    const ENCHANT = 471;
    const character = testCharacter({
      classId: SORCERESS,
      attributes: { maxhp: 100 * L },
      skills: { [ENCHANT]: 1 },
      items: [cap, swapWeapon(2, [['item_allskills', 3]])],
    });
    expect(listAvailableBuffs(character, data).find((buff) => buff.skillId === ENCHANT)).toMatchObject({
      kind: 'cast',
      level: 4,
      castSet: 2,
    });
    const plain = computeCharacterSheet(character, data);
    const sheet = computeCharacterSheet(character, data, { buffs: [{ skillId: ENCHANT }] });
    expect(levelOf(sheet, ENCHANT)).toMatchObject({ level: 4, castSet: 2 });
    expect(sheet.attackRating.percent.value).toBeGreaterThan(plain.attackRating.percent.value);
  });

  it('does not offer auras, procs or attacks of the other set, but a shape-shift an item there gives', () => {
    const paladin = testCharacter({
      classId: PALADIN,
      attributes: { maxhp: 100 * L },
      items: [
        cap,
        swapWeapon(2, [
          ['item_nonclassskill', SALVATION_AURA, 10],
          ['item_aura', RESIST_FIRE, 10],
          ['item_skillonhit', (FADE << 6) | 7, 10],
          ['item_nonclassskill', FRENZY, 10],
          ['item_nonclassskill', WHIRLWIND, 10],
          ['item_nonclassskill', WEREWOLF, 10],
          ['item_singleskill', ZEAL, 10],
          ['item_singleskill', SMITE, 10],
        ]),
      ],
    });
    const listed = listAvailableBuffs(paladin, data);
    for (const id of [SALVATION_AURA, RESIST_FIRE, FADE, FRENZY, WHIRLWIND, ZEAL, SMITE])
      expect(listed.some((buff) => buff.skillId === id)).toBe(false);
    // The form an item on the other set gives: taken there, kept after swapping back
    expect(listed.find((buff) => buff.skillId === WEREWOLF)).toMatchObject({ level: 10, castSet: 2, exclusiveGroup: 'shapeshift' });
    const shifted = computeCharacterSheet(paladin, data, { buffs: [{ skillId: WEREWOLF }] });
    expect(shifted.buffs).toMatchObject([{ skillId: WEREWOLF, level: 10, castSet: 2 }]);
    // With set II in hand these are offered (they change the sheet here), so the check above is not empty; Whirlwind and
    // Smite give this paladin no sheet number, the castOnSwap test above covers them
    const inHand = listAvailableBuffs({ ...paladin, activeWeapon: 1 }, data).map((buff) => buff.skillId);
    expect(inHand).toEqual(expect.arrayContaining([SALVATION_AURA, FADE, FRENZY, ZEAL, WEREWOLF]));
    const sheet = computeCharacterSheet(paladin, data, { buffs: [{ skillId: SALVATION_AURA }, { skillId: FRENZY }] });
    expect(sheet.buffs).toEqual([]);
    expect(sheet.warnings.filter((warning) => warning.includes('does not have it'))).toHaveLength(2);
  });

  it('changes nothing when the other set is empty or gives nothing better (the sheet equals the set-in-hand-only one)', () => {
    const empty = barbarian({ [BATTLE_ORDERS]: 1, [BATTLE_COMMAND]: 1, [SHOUT]: 1 });
    const buffs = [{ skillId: BATTLE_ORDERS }, { skillId: BATTLE_COMMAND }, { skillId: SHOUT }];
    expect(listAvailableBuffs(empty, data).some((buff) => buff.castSet !== undefined)).toBe(false);
    expect(computeCharacterSheet(empty, data, { buffs }).buffs.some((buff) => buff.castSet !== undefined)).toBe(false);

    const worse = barbarian({ [BATTLE_ORDERS]: 1, [BATTLE_COMMAND]: 1, [SHOUT]: 1 }, [
      cap,
      swapWeapon(1, [['item_allskills', 2]]),
      swapWeapon(2, [
        ['item_allskills', 1],
        ['fireresist', 50],
      ]),
    ]);
    // The same character with the set II weapon in the inventory (not counted, same item indices)
    const stowed = {
      ...worse,
      items: {
        ...worse.items,
        player: worse.items.player.map((entry, index) =>
          index === 2 ? { ...entry, location: { kind: 'inventory' as const, x: 0, y: 0 } } : entry
        ),
      },
    };
    expect(computeCharacterSheet(worse, data, { buffs })).toEqual(computeCharacterSheet(stowed, data, { buffs }));
    expect(listAvailableBuffs(worse, data)).toEqual(listAvailableBuffs(stowed, data));
  });

  it('keeps the structural unverified rule for buffs cast on the other set', () => {
    const character = barbarian({ [BATTLE_ORDERS]: 1, [BATTLE_COMMAND]: 1 }, [cap, swapWeapon(2, [['item_allskills', 3]])]);
    const plain = computeCharacterSheet(character, data);
    const buffs = listAvailableBuffs(character, data).map((buff) => ({ skillId: buff.skillId }));
    expect(unflaggedChanges(plain, computeCharacterSheet(character, data, { buffs }))).toEqual([]);
  });

  it('keeps a remembered selection of a skill only the other set gives (usableSelections)', () => {
    const available = listAvailableBuffs(sorceress(), data);
    expect(usableSelections([{ skillId: BATTLE_ORDERS }, { skillId: 9999 }], available)).toEqual([{ skillId: BATTLE_ORDERS }]);
  });
});

describe('shape-shifted forms (skills.txt restrict / State1-3)', () => {
  const FERAL_RAGE = 608;
  const PRIMAL_SAVAGERY = 610;
  const FRENZY = 574;
  const HOLY_ARMOR = 546;
  /** A druid with both forms, their skills, and Frenzy and Holy Armor from an item (skills for the unshifted character) */
  const druid = testCharacter({
    classId: DRUID,
    attributes: { dexterity: 50, maxhp: 100 * L },
    skills: { [WEREWOLF]: 5, [WEREBEAR]: 5, [FERAL_RAGE]: 5, [PRIMAL_SAVAGERY]: 5 },
    items: [
      item(
        'cap',
        equipped('head'),
        [
          ['item_nonclassskill', FRENZY, 10],
          ['item_nonclassskill', HOLY_ARMOR, 10],
        ],
        { defense: 100 }
      ),
    ],
    handSkills: { left: FERAL_RAGE, right: FRENZY },
  });
  const sheetWith = (...skillIds: number[]) => computeCharacterSheet(druid, data, { buffs: skillIds.map((skillId) => ({ skillId })) });
  const counted = (sheet: CharacterSheet) => sheet.buffs.map((buff) => buff.skillId);

  it('lists what each buff asks of the form', () => {
    const listed = new Map(listAvailableBuffs(druid, data).map((buff) => [buff.skillId, buff]));
    expect(listed.get(FERAL_RAGE)?.needsForm).toBe('Werewolf');
    expect(listed.get(PRIMAL_SAVAGERY)?.needsForm).toBe('Werewolf or Werebear');
    expect(listed.get(FRENZY)).toMatchObject({ unshiftedOnly: true });
    for (const id of [WEREWOLF, WEREBEAR, HOLY_ARMOR]) {
      expect(listed.get(id)?.needsForm).toBeUndefined();
      expect(listed.get(id)?.unshiftedOnly).toBeUndefined();
    }
  });

  it('counts a skill of a form only in that form', () => {
    const unshifted = sheetWith(FERAL_RAGE, PRIMAL_SAVAGERY);
    expect(counted(unshifted)).toEqual([]);
    expect(unshifted.blockedBuffs).toEqual([
      { skillId: FERAL_RAGE, reason: 'it needs Werewolf form' },
      { skillId: PRIMAL_SAVAGERY, reason: 'it needs Werewolf or Werebear form' },
    ]);
    expect(unshifted.warnings).toContain('Feral Rage is not counted: it needs Werewolf form');
    // Nothing counted: the numbers are the plain sheet's
    expect(unshifted.resists.physical.value).toBe(computeCharacterSheet(druid, data).resists.physical.value);

    const wolf = sheetWith(WEREWOLF, FERAL_RAGE, PRIMAL_SAVAGERY);
    expect(counted(wolf)).toEqual([WEREWOLF, FERAL_RAGE, PRIMAL_SAVAGERY]);
    expect(wolf.blockedBuffs).toBeUndefined();
    expect(wolf.resists.physical.value).toBeGreaterThan(unshifted.resists.physical.value);

    const bear = sheetWith(WEREBEAR, FERAL_RAGE, PRIMAL_SAVAGERY);
    expect(counted(bear)).toEqual([WEREBEAR, PRIMAL_SAVAGERY]);
    expect(bear.blockedBuffs).toEqual([{ skillId: FERAL_RAGE, reason: 'it needs Werewolf form' }]);
  });

  it('drops an attack for the unshifted character while a form is on, but keeps a cast one', () => {
    expect(counted(sheetWith(FRENZY, HOLY_ARMOR))).toEqual([FRENZY, HOLY_ARMOR]);
    const wolf = sheetWith(WEREWOLF, FRENZY, HOLY_ARMOR);
    expect(counted(wolf)).toEqual([WEREWOLF, HOLY_ARMOR]);
    expect(wolf.blockedBuffs).toEqual([{ skillId: FRENZY, reason: 'it cannot be used in Werewolf form' }]);
  });

  it('says on a mouse-button skill when the form does not allow it', () => {
    const problems = (sheet: CharacterSheet) => sheet.attackRating.hands.map((hand) => hand.formProblem);
    expect(problems(sheetWith())).toEqual(['it needs Werewolf form', undefined]);
    expect(problems(sheetWith(WEREWOLF))).toEqual([undefined, 'it cannot be used in Werewolf form']);
    expect(problems(sheetWith(WEREBEAR))).toEqual(['it needs Werewolf form', 'it cannot be used in Werebear form']);
  });

  it('takes the form from a what-if entry too, and leaves an item proc alone', () => {
    const whatIf = { skills: [{ skillId: WEREWOLF, level: 3 }] };
    const sheet = computeCharacterSheet(druid, data, { buffs: [{ skillId: FERAL_RAGE }, { skillId: FRENZY }], whatIf });
    expect(counted(sheet)).toEqual([FERAL_RAGE]);
    // A proc is the item's cast: Frenzy from a "chance to cast" counts in a form
    const procced = testCharacter({
      classId: DRUID,
      attributes: { maxhp: 100 * L },
      skills: { [WEREWOLF]: 5 },
      items: [item('cap', equipped('head'), [['item_skillonhit', (FRENZY << 6) | 7, 10]], { defense: 100 })],
    });
    const withProc = computeCharacterSheet(procced, data, { buffs: [{ skillId: WEREWOLF }, { skillId: FRENZY, level: 7 }] });
    expect(counted(withProc)).toEqual([WEREWOLF, FRENZY]);
  });
});
