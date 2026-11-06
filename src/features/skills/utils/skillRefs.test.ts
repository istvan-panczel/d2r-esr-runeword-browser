import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { SkillDetail, SkillDetailsBundle, SkillGrant, SkillsBundle } from '@/features/game-data/engine/schema';
import { DEFAULT_SKILL_LEVEL, MAX_LEVEL } from './skillLevels';
import { duplicateNames, SKILLS_ROUTE, SKILLS_URL_PARAMS } from './skills';
import {
  buildSkillRefIndex,
  CLASS_NAMES,
  findSkillRefs,
  LEVEL_CAP,
  LEVEL_PARAM,
  PAGE_DEFAULT_LEVEL,
  ROUTE,
  SKILL_PARAM,
  skillRefLevel,
  skillRefText,
  skillRefUrl,
  type SkillRefSegment,
} from './skillRefs';
import { decodeSkillRef, encodeSkillRef } from './skillRefData';

const committed = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../public/game-data/skilldetails.json'), 'utf-8')
) as SkillDetailsBundle;
const real = buildSkillRefIndex(committed);

/** "prefix [Name→id kind min-max] suffix" */
function show(segments: readonly SkillRefSegment[] | null): string | null {
  if (segments === null) return null;
  return segments
    .map((segment) =>
      segment.ref === undefined ? segment.text : `[${segment.text}→${segment.ref.id} ${segment.ref.kind} ${segment.ref.level.join('-')}]`
    )
    .join('');
}

const skill = (id: string, name: string, cls: SkillDetail['cls'], grantedBy?: SkillGrant[]): SkillDetail => ({
  id,
  name,
  cls,
  page: cls === null ? null : 1,
  reqLevel: 1,
  maxLevel: 20,
  description: [],
  ...(grantedBy === undefined ? {} : { grantedBy }),
});

// Two skills named "Amplify Damage" (the curse and ESR's aura), two named "Empowered Enchant"
const synthetic = buildSkillRefIndex({
  items: [
    { kind: 'unique', name: 'Curse Ring' },
    { kind: 'runeword', name: 'Aura Word' },
    { kind: 'unique', name: 'Both Enchants' },
    { kind: 'unique', name: 'Aura Word' },
  ],
  skills: [
    skill('Amplify Damage', 'Amplify Damage', 'nec', [
      { item: 0, how: 'hit-skill', level: 3, chance: 5 },
      { item: 0, how: 'oskill', level: 2 },
    ]),
    skill('Amplify Damage Aura', 'Amplify Damage', null, [{ item: 1, how: 'aura', level: [5, 10] }]),
    skill('Fire Ball', 'Fire Ball', 'sor'),
    skill('Empowered Enchant Cold', 'Empowered Enchant', null, [{ item: 2, how: 'oskill', level: [5, 15] }]),
    skill('Empowered Enchant Fire', 'Empowered Enchant', null, [{ item: 2, how: 'oskill', level: [5, 15] }]),
    skill('Teleport', 'Teleport', 'sor'),
  ],
});

describe('findSkillRefs: templates (committed skilldetails.json, lines from the HTM pages and game-data bundles)', () => {
  it.each([
    ['+3 to Fire Ball (Sorceress Only)', '+3 to [Fire Ball→Fire Ball plus 3-3] (Sorceress Only)'],
    ['+(3 to 5) To Magic Mastery', '+(3 to 5) To [Magic Mastery→Magic Mastery plus 3-5]'],
    ['+20 to Soul Shiver (All Classes)', '+20 to [Soul Shiver→Soul Shiver plus 20-20] (All Classes)'],
    ['+2 to Teleport', '+2 to [Teleport→Teleport plus 2-2]'],
    ['Level 15 Fanaticism Aura When Equipped', 'Level 15 [Fanaticism→Fanaticism aura 15-15] Aura When Equipped'],
    ['Level (10 to 20) Might Aura When Equipped', 'Level (10 to 20) [Might→Might aura 10-20] Aura When Equipped'],
    [
      '10% Chance to Cast Level 5 Static Field on Striking',
      '10% Chance to Cast Level 5 [Static Field→Static Field chance 5-5] on Striking',
    ],
    [
      '5% Chance to Cast Level 40 Fire Surge when you Kill an Enemy',
      '5% Chance to Cast Level 40 [Fire Surge→Fire Surge chance 40-40] when you Kill an Enemy',
    ],
    ['12% Chance to Cast Level 9 Stun on Melee Attack', '12% Chance to Cast Level 9 [Stun→Stun chance 9-9] on Melee Attack'],
    [
      '10% Chance to Cast Level 1 Time Stop on Casting a Skill',
      '10% Chance to Cast Level 1 [Time Stop→Time Stop chance 1-1] on Casting a Skill',
    ],
    ['Level 3 Teleport (20/20 Charges)', 'Level 3 [Teleport→Teleport charges 3-3] (20/20 Charges)'],
  ])('%s', (line, expected) => {
    expect(show(findSkillRefs(line, real))).toBe(expected);
  });

  it('carries the chance, the event and the charges', () => {
    const chance = findSkillRefs('10% Chance to Cast Level 5 Static Field on Striking', real)?.find((segment) => segment.ref)?.ref;
    expect(chance).toMatchObject({ chance: 10, event: 'on striking' });
    const charges = findSkillRefs('Level 3 Teleport (20/20 Charges)', real)?.find((segment) => segment.ref)?.ref;
    expect(charges).toMatchObject({ charges: 20 });
  });

  it.each([
    '+3 to All Skills',
    '+20 to Life',
    '+2 to Fire Skills (Sorceress Only)',
    '+2 to Offensive Auras (Paladin Only)',
    '+(1 to 2) to Non-Unique Summons Limit',
    '+20 To Random Class Skill (Class Specific Only)',
    '+1 to Random Class Skill',
    '10% Chance to Cast Level 60 Annihilation when Struck**',
    '% Chance to Cast Level Time Lapse when Struck',
    'Your Teleport now automatically casts Elemental Nova on use',
    'Sanctuary Aura now reduces elemental resists instead of magic',
    '+(2 to 4) to Fire Ball damage',
    'Level 15 Fanaticism Aura When Equipped (but only on Tuesdays)',
  ])('leaves %s alone', (line) => {
    expect(findSkillRefs(line, real)).toBeNull();
  });

  it('allows footnote marks after the line', () => {
    expect(show(findSkillRefs('25% Chance to Cast Level 40 Elemental Nova when Struck**', real))).toBe(
      '25% Chance to Cast Level 40 [Elemental Nova→Elemental Nova chance 40-40] when Struck**'
    );
  });

  it('refuses a class hint that names another class', () => {
    expect(findSkillRefs('+3 to Fire Ball (Necromancer Only)', real)).toBeNull();
  });
});

describe('findSkillRefs: same-name skills', () => {
  it('a class hint keeps that class’s skill', () => {
    expect(show(findSkillRefs('+3 to Amplify Damage (Necromancer Only)', synthetic))).toBe(
      '+3 to [Amplify Damage→Amplify Damage plus 3-3] (Necromancer Only)'
    );
  });

  it('the line’s item picks the skill it grants that way', () => {
    const line = 'Level (5 to 10) Amplify Damage Aura When Equipped';
    expect(findSkillRefs(line, synthetic, { kind: 'runeword', name: 'Aura Word' })?.find((s) => s.ref)?.ref?.id).toBe(
      'Amplify Damage Aura'
    );
    // Same name, other kind: not that item, but the level matches only the aura's grant
    expect(findSkillRefs(line, synthetic, { kind: 'unique', name: 'Aura Word' })?.find((s) => s.ref)?.ref?.id).toBe('Amplify Damage Aura');
  });

  it('without the item, the one skill any item grants that way at that level and chance', () => {
    expect(findSkillRefs('5% Chance to Cast Level 3 Amplify Damage on Striking', synthetic)?.find((s) => s.ref)?.ref?.id).toBe(
      'Amplify Damage'
    );
    expect(findSkillRefs('+2 to Amplify Damage', synthetic)?.find((s) => s.ref)?.ref?.id).toBe('Amplify Damage');
    // No grant at level 4 / 9% anywhere: no link
    expect(findSkillRefs('9% Chance to Cast Level 4 Amplify Damage on Striking', synthetic)).toBeNull();
  });

  it('stays unlinked when the item grants several of them', () => {
    expect(findSkillRefs('+(5 to 15) To Empowered Enchant', synthetic, { kind: 'unique', name: 'Both Enchants' })).toBeNull();
    expect(findSkillRefs('+(5 to 15) To Empowered Enchant', synthetic)).toBeNull();
  });

  it('resolves the committed data’s same-name procs by item', () => {
    const id = (line: string, item: { kind: 'unique' | 'runeword'; name: string }) =>
      findSkillRefs(line, real, item)?.find((segment) => segment.ref)?.ref?.id;
    expect(id('10% Chance to Cast Level 40 Conduit on Striking', { kind: 'unique', name: "Baezil's Vortex" })).toBe('Conduit Proc');
    expect(id('Level 20 Eagle Eye Aura When Equipped', { kind: 'runeword', name: 'Hawk' })).toBe('Eagle Eye Aura');
    expect(id('10% Chance to Cast Level 1 Holy Bolt on Melee Attack', { kind: 'unique', name: "El'druin, Excalibur of the Light" })).toBe(
      'Holy Bolt Weapon Damage'
    );
  });
});

describe('peek texts, levels and links', () => {
  it('copies the Skills page constants (kept apart so item pages do not load the calculator)', () => {
    expect([ROUTE, SKILL_PARAM, LEVEL_PARAM]).toEqual([SKILLS_ROUTE, SKILLS_URL_PARAMS.SKILL, SKILLS_URL_PARAMS.LEVEL]);
    expect([PAGE_DEFAULT_LEVEL, LEVEL_CAP]).toEqual([DEFAULT_SKILL_LEVEL, MAX_LEVEL]);
    expect(real.duplicates).toEqual(duplicateNames(committed.skills));
  });

  it('names the classes as skills.json (the Skills page) does', () => {
    const trees = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data/skills.json'), 'utf-8')) as SkillsBundle;
    expect(CLASS_NAMES).toEqual(Object.fromEntries(trees.classes.map((cls) => [cls.code, cls.name])));
  });

  const ref = (line: string) => {
    const found = findSkillRefs(line, real)?.find((segment) => segment.ref)?.ref;
    if (found === undefined) throw new Error(`no ref in ${line}`);
    return found;
  };

  it('describes the grant', () => {
    expect(skillRefText(ref('+3 to Fire Ball (Sorceress Only)'))).toBe('+3 skill levels');
    expect(skillRefText(ref('Level (10 to 20) Might Aura When Equipped'))).toBe('Level 10-20 aura when equipped');
    expect(skillRefText(ref('Level 3 Teleport (20/20 Charges)'))).toBe('Level 3, 20 charges');
    expect(skillRefText(ref('10% Chance to Cast Level 5 Static Field on Striking'))).toBe('10% chance to cast level 5 on striking');
  });

  it('evaluates at the item’s level, a range’s maximum, or level 20 for +levels to a class skill', () => {
    expect(skillRefLevel(ref('Level 15 Fanaticism Aura When Equipped'), { cls: 'pal' })).toMatchObject({ level: 15, urlLevel: 15 });
    expect(skillRefLevel(ref('Level (10 to 20) Might Aura When Equipped'), { cls: 'pal' })).toMatchObject({ level: 20, urlLevel: 20 });
    expect(skillRefLevel(ref('+3 to Fire Ball (Sorceress Only)'), { cls: 'sor' })).toMatchObject({ level: 20, urlLevel: null });
    expect(skillRefLevel(ref('+(3 to 5) To Magic Mastery'), { cls: null })).toMatchObject({ level: 5, urlLevel: 5 });
  });

  it('links the Skills page at that level', () => {
    expect(skillRefUrl({ id: 'Fire Ball' }, 15)).toBe('/skills?skill=Fire+Ball&lvl=15');
    expect(skillRefUrl({ id: 'Fire Ball' }, 20)).toBe('/skills?skill=Fire+Ball');
    expect(skillRefUrl({ id: 'Fire Ball' }, null)).toBe('/skills?skill=Fire+Ball');
  });

  it('round-trips the anchor attribute and refuses anything else', () => {
    const value = ref('10% Chance to Cast Level 5 Static Field on Striking');
    expect(decodeSkillRef(encodeSkillRef(value))).toEqual(value);
    expect(decodeSkillRef(undefined)).toBeNull();
    expect(decodeSkillRef('not json')).toBeNull();
    expect(decodeSkillRef('{"id":"x","kind":"other","level":[1,1]}')).toBeNull();
    expect(decodeSkillRef('{"id":"x","kind":"aura","level":[1]}')).toBeNull();
  });
});
