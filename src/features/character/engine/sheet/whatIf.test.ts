import { describe, expect, it } from 'vitest';
import { asBuildStats } from '@/features/builds/buildStats';
import { buildStatsFromSnapshot, computeBuildStats } from '../buildDraftStats';
import { sheetText } from '../sheetView';
import { consumedStats } from './consumed';
import { computeCharacterSheet } from './sheet';
import { toStatsSnapshot } from './snapshot';
import { charmAt, equipped, item, sheetData as data, testCharacter, unflaggedChanges } from './testSheet.mock';
import type { CharacterSheet, WhatIfEntries } from './types';
import { expandWhatIfStat, hasWhatIf, listWhatIfSkills, listWhatIfStats, normalizeWhatIfSkills, whatIfKey, whatIfStatText } from './whatIf';

const L = 256;
const BARBARIAN = 4;
const PALADIN = 3;
const BATTLE_ORDERS = 570;
const BATTLE_COMMAND = 582;
const SALVATION = 557;
const RESIST_FIRE = 527;
const CONCENTRATION = 543;
const STRENGTH_OF_THE_ANCIENTS = 568;
const AMPLIFY_DAMAGE = 495;
const FIRE_BOLT = 453;
const WHIRLWIND = 590;

const hero = (fields: Parameters<typeof testCharacter>[0] = {}) =>
  testCharacter({
    classId: BARBARIAN,
    level: 80,
    attributes: { strength: 100, dexterity: 60, vitality: 200, energy: 25, maxhp: 600 * L, maxmana: 100 * L },
    items: [item('cap', equipped('head'), [['strengthpercent', 20]], { defense: 100 })],
    ...fields,
  });

const sheetOf = (whatIf: WhatIfEntries, character = hero()) => computeCharacterSheet(character, data, { whatIf });

describe('what-if stats', () => {
  it('count exactly as a charm carrying them would: percents, per-level stats and pools alike', () => {
    const specs = [
      ['strength', 50],
      ['vitality', 40],
      ['item_maxhp_percent', 20],
      ['maxhp', 30],
      ['item_hp_perlevel', 12],
      ['fireresist', -15],
      ['item_fasterattackrate', 40],
      ['item_allskills', 2],
    ] as const;
    const base = hero();
    const withCharm = computeCharacterSheet(
      {
        ...base,
        items: {
          ...base.items,
          player: [
            ...base.items.player,
            item(
              'cm1',
              charmAt(0, 0),
              specs.map(([stat, value]) => [stat, value])
            ),
          ],
        },
      },
      data
    );
    const whatIf = sheetOf({ stats: specs.map(([stat, value]) => ({ stat, value })) });
    const numbers = (sheet: CharacterSheet) => ({
      attributes: Object.values(sheet.attributes).map((entry) => entry.value),
      life: sheet.life.value,
      mana: sheet.mana.value,
      stamina: sheet.stamina.value,
      defense: sheet.defense.value,
      fire: sheet.resists.fire.raw,
      ias: sheet.speed.attack.value,
      all: sheet.skills.all.value,
    });
    expect(numbers(whatIf)).toEqual(numbers(withCharm));
    expect(whatIf.attributes.strength.value).toBe(Math.trunc(150 * 1.2));
  });

  it('name their source "What if" and are marked unverified; nothing else changes', () => {
    const plain = sheetOf({});
    const sheet = sheetOf({ stats: [{ stat: 'strength', value: 100 }] });
    expect(sheet.attributes.strength.sources).toContainEqual({ kind: 'what-if', label: 'What if', value: 100 });
    expect(sheet.attributes.strength.status).toBe('unverified');
    expect(sheet.life.status).toBe('verified');
    expect(sheet.resists.fire).toEqual(plain.resists.fire);
    expect(unflaggedChanges(plain, sheet)).toEqual([]);
    expect(sheet.whatIf?.stats).toEqual([{ stat: 'strength', value: 100, text: '+100 to Strength' }]);
  });

  it('may be negative and expand the groups: all resistances, all attributes', () => {
    const plain = sheetOf({});
    const sheet = sheetOf({
      stats: [
        { stat: 'all-resists', value: 20 },
        { stat: 'all-attributes', value: -10 },
      ],
    });
    for (const key of ['fire', 'cold', 'lightning', 'poison'] as const) expect(sheet.resists[key].raw).toBe(plain.resists[key].raw + 20);
    expect(sheet.resists.magic.raw).toBe(plain.resists.magic.raw);
    expect(sheet.attributes.energy.value).toBe(plain.attributes.energy.value - 10);
    expect(sheet.whatIf?.stats.map((entry) => entry.text)).toEqual(['All Resists +20', '-10 to All Attributes']);
  });

  it('leave out zero values and unknown stats (a prototype name included) with a note', () => {
    const zero = sheetOf({ stats: [{ stat: 'strength', value: 0 }] });
    expect(zero.whatIf).toBeUndefined();
    expect(zero.attributes.strength.status).toBe('verified');
    const unknown = sheetOf({
      stats: [
        { stat: 'constructor', value: 5 },
        { stat: 'no_such_stat', value: 5 },
      ],
    });
    expect(unknown.whatIf?.stats).toEqual([]);
    expect(unknown.warnings.filter((warning) => warning.startsWith('What if: the stat'))).toHaveLength(2);
    expect(unknown.life).toEqual(sheetOf({}).life);
  });

  it('take +class skills with the class as param', () => {
    const sheet = sheetOf({ stats: [{ stat: 'item_addclassskills', param: BARBARIAN, value: 3 }] });
    expect(sheet.skills.cls.value).toBe(3);
    expect(whatIfStatText(data, { stat: 'item_addclassskills', param: BARBARIAN, value: 3 })).toBe('+3 to Barbarian Skill Levels');
  });

  it('count a single-skill and a skill-tab bonus with their params, as the picker gives them', () => {
    const character = hero({ skills: { [WHIRLWIND]: 10, [BATTLE_ORDERS]: 1 } });
    const options = listWhatIfStats(data, BARBARIAN);
    const whirlwind = options.find((option) => option.label === '+N to Whirlwind (Barbarian Only)');
    const combat = options.find((option) => option.label === '+N to Combat Skills (Barbarian Only)');
    expect(whirlwind).toMatchObject({ stat: 'item_singleskill', param: WHIRLWIND, group: 'skills', initial: 1 });
    expect(combat).toMatchObject({ stat: 'item_addskill_tab', param: BARBARIAN * 8, group: 'skills', initial: 1 });
    const sheet = sheetOf(
      {
        stats: [
          { stat: 'item_singleskill', param: WHIRLWIND, value: 3 },
          { stat: 'item_addskill_tab', param: BARBARIAN * 8, value: 2 },
        ],
      },
      character
    );
    const level = (id: number) => sheet.skills.levels.find((skill) => skill.skillId === id);
    // Whirlwind is a Combat skill, Battle Orders a Warcry: only the first gets the tab bonus
    expect(level(WHIRLWIND)).toMatchObject({ level: 15, bonus: { single: 3, tab: 2 } });
    expect(level(BATTLE_ORDERS)).toMatchObject({ level: 1 });
    expect(whatIfStatText(data, { stat: 'item_singleskill', param: WHIRLWIND, value: 3 })).toBe('+3 to Whirlwind (Barbarian Only)');
  });

  it('offer the three skill tabs and every skill of the class, and no other class’s', () => {
    const options = listWhatIfStats(data, BARBARIAN);
    const tabs = options.filter((option) => option.stat === 'item_addskill_tab');
    expect(tabs.map((option) => option.label)).toEqual([
      '+N to Combat Skills (Barbarian Only)',
      '+N to Masteries (Barbarian Only)',
      '+N to Warcries (Barbarian Only)',
    ]);
    const singles = options.filter((option) => option.stat === 'item_singleskill');
    expect(singles.length).toBeGreaterThan(20);
    for (const option of singles) expect(option.label).toMatch(/^\+N to .+ \(Barbarian Only\)$/);
    expect(singles.map((option) => option.label)).toEqual([...singles.map((option) => option.label)].sort((a, b) => a.localeCompare(b)));
    const paladin = listWhatIfStats(data, PALADIN).filter((option) => option.stat === 'item_singleskill');
    expect(paladin.some((option) => option.param === WHIRLWIND)).toBe(false);
    for (const option of paladin) expect(option.label).toMatch(/\(Paladin Only\)$/);
  });
});

describe('what-if skills', () => {
  it('count like an item aura at the given level, whether or not the character has the skill', () => {
    const plain = sheetOf({});
    // Battle Orders level 20: 35% + 19 × 3% = 92% life and mana (a buff of a skill without points would be skipped)
    const sheet = sheetOf({ skills: [{ skillId: BATTLE_ORDERS, level: 20 }] });
    expect(sheet.life.value).toBe(Math.floor((plain.life.value * 192) / 100));
    expect(sheet.life.status).toBe('unverified');
    expect(sheet.life.sources.find((source) => source.kind === 'what-if')).toBeUndefined();
    expect(sheet.whatIf?.skills).toEqual([
      expect.objectContaining({ skillId: BATTLE_ORDERS, level: 20, stats: expect.objectContaining({ item_maxhp_percent: 92 }) }),
    ]);
    expect(unflaggedChanges(plain, sheet)).toEqual([]);
    expect(sheet.buffs).toEqual([]);
  });

  it('raise skill levels like any +skills (Battle Command), and the sources name the what-if aura', () => {
    const character = hero({ skills: { [WHIRLWIND]: 10 } });
    const sheet = sheetOf({ skills: [{ skillId: BATTLE_COMMAND, level: 10 }] }, character);
    expect(sheet.skills.all.value).toBe(2);
    expect(sheet.skills.all.sources).toContainEqual(expect.objectContaining({ kind: 'what-if', skill: BATTLE_COMMAND }));
    expect(sheet.skills.levels.find((skill) => skill.skillId === WHIRLWIND)).toMatchObject({ level: 12, status: 'unverified' });
  });

  it('keep one instance per skill: the highest level of the entries, an item aura and a buff', () => {
    expect(
      normalizeWhatIfSkills([
        { skillId: 1, level: 3 },
        { skillId: 1, level: 9 },
        { skillId: 2, level: 0 },
        { skillId: 3, level: 150 },
      ])
    ).toEqual([
      { skillId: 1, level: 9 },
      { skillId: 3, level: 99 },
    ]);
    const paladin = (level: number) =>
      hero({ classId: PALADIN, items: [item('cap', equipped('head'), [['item_aura', SALVATION, level]], { defense: 10 })] });
    const lower = computeCharacterSheet(paladin(10), data, { whatIf: { skills: [{ skillId: SALVATION, level: 5 }] } });
    expect(lower.resists.fire.cap).toBe(computeCharacterSheet(paladin(10), data).resists.fire.cap);
    expect(lower.warnings.some((warning) => warning.includes('already gives it at level 10'))).toBe(true);
    const higher = computeCharacterSheet(paladin(10), data, { whatIf: { skills: [{ skillId: SALVATION, level: 15 }] } });
    expect(higher.warnings.some((warning) => warning.includes('is counted instead of the item'))).toBe(true);
    expect(higher.absorb.fire.sources.filter((source) => source.skill === SALVATION).map((source) => source.kind)).toEqual(['what-if']);
    expect(higher.resists.fire.cap).toBe(computeCharacterSheet(paladin(15), data).resists.fire.cap);
    // A buff of the skill at a lower level than the what-if entry is not counted
    const buffed = computeCharacterSheet(hero({ skills: { [BATTLE_ORDERS]: 1 } }), data, {
      buffs: [{ skillId: BATTLE_ORDERS }],
      whatIf: { skills: [{ skillId: BATTLE_ORDERS, level: 20 }] },
    });
    expect(buffed.buffs).toEqual([]);
    expect(buffed.life.value).toBe(sheetOf({ skills: [{ skillId: BATTLE_ORDERS, level: 20 }] }).life.value);
  });

  it('stay apart from the own-aura group: an own aura buff and a what-if aura both count', () => {
    const character = hero({ classId: PALADIN, skills: { [RESIST_FIRE]: 10 } });
    const sheet = computeCharacterSheet(character, data, {
      buffs: [{ skillId: RESIST_FIRE }],
      whatIf: { skills: [{ skillId: SALVATION, level: 10 }] },
    });
    expect(sheet.buffs.map((buff) => buff.skillId)).toEqual([RESIST_FIRE]);
    expect(sheet.whatIf?.skills.map((skill) => skill.skillId)).toEqual([SALVATION]);
    expect(sheet.absorb.firePercent.sources.map((source) => source.kind)).toContain('buff');
    expect(sheet.absorb.fire.sources.map((source) => source.kind)).toContain('what-if');
  });

  it('refuse passives, curses and unknown skills with a note', () => {
    const sheet = sheetOf({
      skills: [
        { skillId: STRENGTH_OF_THE_ANCIENTS, level: 10 },
        { skillId: AMPLIFY_DAMAGE, level: 10 },
        { skillId: 99_999, level: 3 },
      ],
    });
    expect(sheet.whatIf?.skills).toEqual([]);
    const notes = sheet.warnings.filter((warning) => warning.startsWith('What if: '));
    expect(notes).toEqual([
      expect.stringContaining('it is a passive skill'),
      expect.stringContaining('its effects do not reach you'),
      expect.stringContaining('the game data has no stats'),
    ]);
    expect(sheet.attributes.strength).toEqual(sheetOf({}).attributes.strength);
  });

  it('name what the sheet has no number for: Concentration adds damage only', () => {
    const plain = sheetOf({});
    const sheet = sheetOf({ skills: [{ skillId: CONCENTRATION, level: 6 }] });
    expect(unflaggedChanges(plain, sheet)).toEqual([]);
    expect(sheet.life).toEqual(plain.life);
    const [applied] = sheet.whatIf?.skills ?? [];
    expect(applied?.unshown).toEqual([expect.stringMatching(/^\+\d+% Enhanced Damage$/)]);
    expect(sheet.warnings).toContainEqual(
      expect.stringMatching(/^What-if effects this sheet has no number for: Concentration \(level 6\)/)
    );
  });
});

describe('the build hand-off and the snapshot', () => {
  it('stay without what-if entries: the build stats are the plain sheet’s', () => {
    const character = hero();
    const plain = computeCharacterSheet(character, data);
    const whatIf = sheetOf({ stats: [{ stat: 'strength', value: 100 }], skills: [{ skillId: BATTLE_ORDERS, level: 20 }] }, character);
    const stats = computeBuildStats(character, data, null);
    expect(stats).toEqual(buildStatsFromSnapshot(toStatsSnapshot(plain, { savedAt: character.lastSavedAt }), character.name));
    expect(stats?.values.str).toBe(plain.attributes.strength.value);
    expect(stats?.values.str).not.toBe(whatIf.attributes.strength.value);
    expect(asBuildStats(stats)).toEqual(stats);
    // The snapshot of the plain sheet says nothing of buffs; a what-if sheet's would (never stored by the app)
    expect(toStatsSnapshot(plain, { savedAt: 0 }).buf).toBeUndefined();
  });
});

describe('what-if keys and checks', () => {
  it('hasWhatIf: only entries that change something', () => {
    expect(hasWhatIf(undefined)).toBe(false);
    expect(hasWhatIf({ stats: [{ stat: 'strength', value: 0 }], skills: [] })).toBe(false);
    expect(hasWhatIf({ stats: [{ stat: 'strength', value: -1 }] })).toBe(true);
    expect(hasWhatIf({ skills: [{ skillId: 1, level: 1 }] })).toBe(true);
  });

  it('whatIfKey does not depend on the order', () => {
    const a = whatIfKey({
      stats: [
        { stat: 'strength', value: 1 },
        { stat: 'item_addclassskills', param: 4, value: 2 },
      ],
      skills: [{ skillId: 5, level: 2 }],
    });
    const b = whatIfKey({
      stats: [
        { stat: 'item_addclassskills', param: 4, value: 2 },
        { stat: 'strength', value: 1 },
      ],
      skills: [{ skillId: 5, level: 2 }],
    });
    expect(a).toBe(b);
    expect(a).not.toBe(whatIfKey({ stats: [{ stat: 'strength', value: 2 }] }));
  });
});

describe('listWhatIfStats', () => {
  const options = listWhatIfStats(data, BARBARIAN);

  it('offers the sheet stats by group, labelled as an item tooltip words them', () => {
    expect([...new Set(options.map((option) => option.group))]).toEqual([
      'attributes',
      'pools',
      'defense',
      'resists',
      'speed',
      'attack',
      'skills',
      'other',
    ]);
    const label = (id: string) => options.find((option) => option.id === id)?.label;
    expect(label('strength')).toBe('+N to Strength');
    expect(label('all-resists')).toBe('All Resists +N');
    expect(label('item_maxhp_percent')).toBe('Increase Maximum Life +N%');
    expect(label(`item_addclassskills:${String(BARBARIAN)}`)).toBe('+N to Barbarian Skill Levels');
    expect(label('item_ignoretargetac')).toBe("Ignore Target's Defense");
    expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
    for (const option of options) expect(option.label).not.toMatch(/Unknown stat|98765/);
  });

  it('offers only stats the sheet applies', () => {
    const consumed = consumedStats(data);
    for (const option of options) {
      const stats = expandWhatIfStat(data, { stat: option.stat, value: 1 }) ?? [];
      expect(stats.length).toBeGreaterThan(0);
      for (const stat of stats) expect(consumed.has(stat.id) || stat.id === data.stat.item_ignoretargetac).toBe(true);
    }
  });
});

describe('listWhatIfSkills', () => {
  const skills = listWhatIfSkills(data);
  const find = (id: number) => skills.find((skill) => skill.skillId === id);

  it('lists every class’s skills that reach the owner, damage-only auras marked', () => {
    expect(find(BATTLE_ORDERS)).toEqual({
      skillId: BATTLE_ORDERS,
      name: 'Battle Orders',
      className: 'Barbarian',
      aura: false,
      changesSheet: true,
    });
    expect(find(CONCENTRATION)).toMatchObject({ className: 'Paladin', aura: true, changesSheet: false });
    expect(find(SALVATION)).toMatchObject({ aura: true, changesSheet: true });
    expect(find(STRENGTH_OF_THE_ANCIENTS)).toBeUndefined();
    expect(find(AMPLIFY_DAMAGE)).toBeUndefined();
    expect(find(FIRE_BOLT)).toBeUndefined();
    // Item-only auras: only those that change a sheet number
    for (const skill of skills.filter((entry) => entry.className === null)) expect(skill).toMatchObject({ aura: true, changesSheet: true });
    expect(listWhatIfSkills(data)).toBe(skills);
  });

  it('every listed skill counts without a note', () => {
    const character = hero();
    for (const skill of skills) {
      const sheet = computeCharacterSheet(character, data, { whatIf: { skills: [{ skillId: skill.skillId, level: 20 }] } });
      expect(sheet.warnings.filter((warning) => warning.startsWith('What if: '))).toEqual([]);
      expect(sheet.whatIf?.skills.map((entry) => entry.skillId)).toEqual([skill.skillId]);
    }
  });
});

describe('what-if entries with a buff cast on the other weapon set', () => {
  // A barbarian with Battle Orders 1; weapon set II holds +3 to all skills, so Battle Orders is cast there at level 4
  const swapper = () =>
    hero({
      skills: { [BATTLE_ORDERS]: 1 },
      attributes: { strength: 100, maxhp: 100 * L, maxmana: 50 * L },
      items: [item('cap', equipped('head'), [], { defense: 100 }), item('hax', equipped('rightHand', 2), [['item_allskills', 3]])],
    });
  const buffs = [{ skillId: BATTLE_ORDERS }];
  const castOf = (sheet: CharacterSheet) => sheet.buffs.find((buff) => buff.skillId === BATTLE_ORDERS);

  it('a stat that does not touch skill levels leaves the swap cast as it was', () => {
    const plain = computeCharacterSheet(swapper(), data, { buffs });
    expect(castOf(plain)).toMatchObject({ level: 4, castSet: 2 });
    expect(plain.life.value).toBe(100 + 35 + 9);
    const sheet = computeCharacterSheet(swapper(), data, { buffs, whatIf: { stats: [{ stat: 'strength', value: 50 }] } });
    expect(castOf(sheet)).toEqual(castOf(plain));
    expect(sheet.life.value).toBe(plain.life.value);
    expect(sheet.attributes.strength.value).toBe(plain.attributes.strength.value + 50);
  });

  it('+all skills as a what-if stat counts on both sets: the swap cast rises with it', () => {
    const sheet = computeCharacterSheet(swapper(), data, { buffs, whatIf: { stats: [{ stat: 'item_allskills', value: 2 }] } });
    // Set I: 1 + 2 = 3; set II: 1 + 3 + 2 = 6, still cast there
    expect(castOf(sheet)).toMatchObject({ level: 6, castSet: 2 });
    expect(sheet.life.value).toBe(100 + 35 + 15);
    expect(sheet.skills.levels.find((skill) => skill.skillId === BATTLE_ORDERS)?.level).toBe(3);
  });

  it('a what-if Battle Command aura counts on both sets too', () => {
    const sheet = computeCharacterSheet(swapper(), data, { buffs, whatIf: { skills: [{ skillId: BATTLE_COMMAND, level: 10 }] } });
    const bonus = sheet.skills.all.value;
    expect(bonus).toBeGreaterThan(0);
    expect(castOf(sheet)).toMatchObject({ level: 4 + bonus, castSet: 2 });
  });

  it('a save written on weapon set II: Battle Orders cast on set I, raised there by a what-if +all skills', () => {
    const onSetII = hero({
      activeWeapon: 1,
      skills: { [BATTLE_ORDERS]: 1 },
      attributes: { strength: 100, maxhp: 100 * L, maxmana: 50 * L },
      items: [item('cap', equipped('head'), [], { defense: 100 }), item('hax', equipped('rightHand', 1), [['item_allskills', 3]])],
    });
    const plain = computeCharacterSheet(onSetII, data, { buffs });
    expect(plain.weaponSet).toBe(2);
    expect(castOf(plain)).toMatchObject({ level: 4, castSet: 1 });
    expect(plain.life.value).toBe(100 + 35 + 9);
    const sheet = computeCharacterSheet(onSetII, data, { buffs, whatIf: { stats: [{ stat: 'item_allskills', value: 2 }] } });
    expect(castOf(sheet)).toMatchObject({ level: 6, castSet: 1 });
  });

  it('a what-if aura of the buffed skill: the note names the what-if entry, not an item', () => {
    const sheet = computeCharacterSheet(swapper(), data, { buffs, whatIf: { skills: [{ skillId: BATTLE_ORDERS, level: 20 }] } });
    expect(sheet.buffs).toEqual([]);
    expect(sheet.warnings).toContainEqual(expect.stringContaining('is not counted: a what-if entry already gives it at level 20'));
    expect(sheet.warnings.some((warning) => warning.includes('an item already gives it'))).toBe(false);
    const higher = computeCharacterSheet(swapper(), data, {
      buffs: [{ skillId: BATTLE_ORDERS, level: 30 }],
      whatIf: { skills: [{ skillId: BATTLE_ORDERS, level: 20 }] },
    });
    expect(higher.warnings).toContainEqual(expect.stringContaining("is counted instead of the what-if entry's (level 20)"));
  });
});

describe('review fixes', () => {
  it('a what-if skill a buff beats is not counted, with the reason', () => {
    const character = hero({ skills: { [BATTLE_ORDERS]: 1 } });
    const sheet = computeCharacterSheet(character, data, {
      buffs: [{ skillId: BATTLE_ORDERS, level: 30 }],
      whatIf: { skills: [{ skillId: BATTLE_ORDERS, level: 5 }] },
    });
    expect(sheet.buffs.map((buff) => [buff.skillId, buff.level])).toEqual([[BATTLE_ORDERS, 30]]);
    expect(sheet.whatIf?.skills).toEqual([]);
    expect(sheet.whatIf?.skipped).toEqual([
      { skillId: BATTLE_ORDERS, level: 5, reason: 'your buff counts at level 30, and only one counts' },
    ]);
    expect(sheetText(sheet, { className: 'Barbarian' }).split('\n').at(-1)).toBe(
      "What if: nothing counted (not the character's real numbers)"
    );
    // A refused skill and an item's higher aura are listed too
    const refused = sheetOf({ skills: [{ skillId: STRENGTH_OF_THE_ANCIENTS, level: 3 }] });
    expect(refused.whatIf?.skipped).toEqual([{ skillId: STRENGTH_OF_THE_ANCIENTS, level: 3, reason: 'it is a passive skill' }]);
  });

  it('words a taken-away yes / no stat as a removal', () => {
    expect(whatIfStatText(data, { stat: 'item_ignoretargetac', value: 1 })).toBe("Ignore Target's Defense");
    expect(whatIfStatText(data, { stat: 'item_ignoretargetac', value: -1 })).toBe("No Ignore Target's Defense (taken away)");
    const flag = listWhatIfStats(data, BARBARIAN).find((option) => option.stat === 'item_ignoretargetac');
    expect(flag).toMatchObject({ flag: true, initial: 1 });
    expect(
      listWhatIfStats(data, BARBARIAN)
        .filter((option) => option.flag)
        .map((option) => option.stat)
    ).toEqual(['item_ignoretargetac']);
  });

  it('whatIfKey cannot be made to collide by a stat name', () => {
    const forged = whatIfKey({ stats: [{ stat: 'strength:0=5,x', value: 1 }] });
    const real = whatIfKey({
      stats: [
        { stat: 'strength', value: 5 },
        { stat: 'x', value: 1 },
      ],
    });
    expect(forged).not.toBe(real);
    expect(whatIfKey({ stats: [{ stat: 'a', value: 1 }], skills: [] })).not.toBe(whatIfKey({ skills: [{ skillId: 1, level: 1 }] }));
  });
});
