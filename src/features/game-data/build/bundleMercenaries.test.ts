import { describe, expect, it } from 'vitest';
import type { SkillDetail } from '../engine/schema.ts';
import { buildMercenariesBundle } from './bundleMercenaries.ts';
import type { MercenaryRow } from './skillInfoPage.ts';
import { parseTsv } from './tsv.ts';

const SLOT_COLUMNS = [1, 2, 3, 4, 5, 6].flatMap((slot) => [`Skill${String(slot)}`, `Level${String(slot)}`]);
const COLUMNS = [
  'Hireling',
  'Version',
  'Act',
  'Difficulty',
  'Level',
  'Gold',
  'HP',
  'Defense',
  'Str',
  'Dex',
  'AR',
  'Dmg-Min',
  'Dmg-Max',
  'ResistFire',
  'ResistCold',
  'ResistLightning',
  'ResistPoison',
  'HireDesc',
  ...SLOT_COLUMNS,
];

interface Row {
  hireling: string;
  desc: string;
  difficulty: number;
  level: number;
  gold?: number;
  version?: number;
  dex?: number;
  act?: number;
  skills: [string, number][];
}

function table(rows: readonly Row[]) {
  const lines = rows.map((row) => {
    const slots = [0, 1, 2, 3, 4, 5].flatMap((i) => {
      const skill = row.skills.at(i);
      return skill === undefined ? ['', ''] : [skill[0], String(skill[1])];
    });
    return [
      row.hireling,
      row.version ?? 100,
      row.act ?? 1,
      row.difficulty,
      row.level,
      row.gold ?? 25,
      row.level * 10,
      row.level * 20,
      40,
      row.dex ?? 50,
      row.level * 30,
      3,
      7,
      20,
      21,
      22,
      23,
      row.desc,
      ...slots,
    ].join('\t');
  });
  return parseTsv([COLUMNS.join('\t'), ...lines].join('\n'), 'hireling.txt');
}

const skill = (id: string, extra: Partial<SkillDetail> = {}): SkillDetail => ({
  id,
  name: id,
  cls: 'ama',
  page: 1,
  reqLevel: 1,
  maxLevel: 20,
  description: [],
  ...extra,
});

const SKILLS = [
  skill('Fend', { icon: 'am-48' }),
  skill('Might', { cls: 'pal', type: 'aura' }),
  skill('Pierce', { type: 'passive' }),
  skill('Conduit', { cls: 'sor' }),
  skill('Conduit Proc', { cls: null, page: null }),
];

const page = (hireling: string, subtype: string, skills: string[]): MercenaryRow => ({ hireling, subtype, skills });

describe('buildMercenariesBundle', () => {
  it('merges a type that covers all difficulties by level and keeps Gold per difficulty', () => {
    const rows: Row[] = [
      { hireling: 'Rogue Scout', desc: 'farw', difficulty: 1, level: 10, gold: 25, skills: [['Fend', 3]] },
      { hireling: 'Rogue Scout', desc: 'farw', difficulty: 1, level: 40, gold: 25, skills: [['Fend', 15]] },
      { hireling: 'Rogue Scout', desc: 'farw', difficulty: 2, level: 40, gold: 1500, skills: [['Fend', 15]] },
      { hireling: 'Rogue Scout', desc: 'farw', difficulty: 3, level: 85, gold: 3125, skills: [['Fend', 25]] },
      // The classic copy of the row
      { hireling: 'Rogue Scout', desc: 'farw', difficulty: 1, level: 10, version: 0, gold: 1, skills: [['Pierce', 1]] },
    ];
    const { bundle, warnings, counts } = buildMercenariesBundle({
      hireling: table(rows),
      page: [page('Rogue Scout', 'Elemental', ['Fend'])],
      skills: SKILLS,
    });
    expect(warnings).toEqual([]);
    expect(counts).toMatchObject({ mercenaryHirelings: 1, mercenaryVariants: 1, mercenaryBands: 3, mercenarySkills: 1 });
    const hireling = bundle.hirelings.at(0);
    expect(hireling).toMatchObject({ slug: 'rogue-scout', name: 'Rogue Scout', act: 1 });
    const variant = hireling?.types.at(0)?.variants.at(0);
    expect(hireling?.types.at(0)).toMatchObject({ slug: 'elemental', name: 'Elemental' });
    expect(variant?.difficulty).toBeNull();
    expect(variant?.offers).toEqual([
      { difficulty: 'normal', gold: 25, levels: [10, 40] },
      { difficulty: 'nightmare', gold: 1500, levels: [40] },
      { difficulty: 'hell', gold: 3125, levels: [85] },
    ]);
    expect(variant?.bands.map((band) => band.level)).toEqual([10, 40, 85]);
    expect(variant?.skills).toEqual([{ id: 'Fend', name: 'Fend', cls: 'ama', page: 1, icon: 'am-48', levels: [3, 15, 25] }]);
  });

  it('splits a type per difficulty when the page does, with the short labels spelled out', () => {
    const rows: Row[] = [
      { hireling: 'Desert Mercenary', act: 2, desc: 'comb', difficulty: 1, level: 20, skills: [['Might', 8]] },
      { hireling: 'Desert Mercenary', act: 2, desc: 'comb', difficulty: 2, level: 50, gold: 1800, skills: [['Fend', 4]] },
    ];
    const { bundle, warnings } = buildMercenariesBundle({
      hireling: table(rows),
      page: [page('Desert Mercenary', 'Comb - Normal', ['Might']), page('Desert Mercenary', 'Comb - Nightmare', ['Fend'])],
      skills: SKILLS,
    });
    expect(warnings).toEqual([]);
    const type = bundle.hirelings.at(0)?.types.at(0);
    expect(type).toMatchObject({ slug: 'combat', name: 'Combat' });
    expect(type?.variants.map((variant) => [variant.subtype, variant.difficulty, variant.skills.at(0)?.id])).toEqual([
      ['Comb - Normal', 'normal', 'Might'],
      ['Comb - Nightmare', 'nightmare', 'Fend'],
    ]);
    expect(type?.variants.at(0)?.skills.at(0)?.type).toBe('aura');
  });

  it('keeps the page name, reads the file by its own spelling and resolves the hireling skill copies', () => {
    const rows: Row[] = [
      { hireling: 'Eastern Sorceror', act: 3, desc: 'ltng', difficulty: 1, level: 25, skills: [['Conduit Hireling', 5]] },
    ];
    const { bundle, warnings } = buildMercenariesBundle({
      hireling: table(rows),
      page: [page('Eastern Sorcerer', 'Lightning', ['Conduit'])],
      skills: SKILLS,
    });
    expect(warnings).toEqual([]);
    expect(bundle.hirelings.at(0)).toMatchObject({ slug: 'eastern-sorcerer', name: 'Eastern Sorcerer', act: 3 });
    expect(bundle.hirelings.at(0)?.types.at(0)?.variants.at(0)?.skills.at(0)).toMatchObject({ id: 'Conduit', cls: 'sor' });
  });

  it('warns when the page and the file list different skills, in either direction', () => {
    const { warnings } = buildMercenariesBundle({
      hireling: table([{ hireling: 'Barbarian', desc: 'def', difficulty: 1, level: 30, skills: [['Fend', 1]] }]),
      page: [page('Barbarian', 'Defensive', ['Pierce'])],
      skills: SKILLS,
    });
    expect(warnings).toEqual(['mercenaries: Barbarian Defensive: only on the page: [Pierce], only in hireling.txt: [Fend]']);
  });

  it('warns about an unknown skill, an unknown type label, a page row without file rows and a file row without a page row', () => {
    const rows: Row[] = [
      { hireling: 'Barbarian', desc: 'def', difficulty: 1, level: 30, skills: [['Nope', 1]] },
      { hireling: 'Barbarian', desc: 'off', difficulty: 1, level: 30, skills: [['Fend', 1]] },
    ];
    const { warnings } = buildMercenariesBundle({
      hireling: table(rows),
      page: [page('Barbarian', 'Defensive', []), page('Barbarian', 'Mystery', []), page('Rogue Scout', 'Physical', [])],
      skills: SKILLS,
    });
    expect(warnings).toEqual([
      'mercenaries: Barbarian Defensive: hireling.txt skill "Nope" matches no skill',
      'mercenaries: Barbarian Mystery: unknown type label "Mystery" on the skill information page',
      'mercenaries: Rogue Scout Physical: no hireling.txt row (Hireling "Rogue Scout", HireDesc "carw")',
      'mercenaries: hireling.txt line 3 (Barbarian, off, difficulty 1) is on no row of the skill information page',
    ]);
  });

  it('flags the suspect dexterity and keeps the file value', () => {
    const rows: Row[] = [
      { hireling: 'Desert Mercenary', desc: 'off', difficulty: 2, level: 50, dex: 98, skills: [['Fend', 1]] },
      { hireling: 'Desert Mercenary', desc: 'off', difficulty: 2, level: 85, dex: 97, skills: [['Fend', 1]] },
    ];
    const { bundle, warnings } = buildMercenariesBundle({
      hireling: table(rows),
      page: [page('Desert Mercenary', 'Off - Nightmare', ['Fend'])],
      skills: SKILLS,
    });
    expect(warnings).toEqual([]);
    expect(
      bundle.hirelings
        .at(0)
        ?.types.at(0)
        ?.variants.at(0)
        ?.bands.map((band) => [band.dexterity, band.dexterityTypo])
    ).toEqual([
      [98, true],
      [97, true],
    ]);
  });

  it('warns once a suspect dexterity is gone from the file, without flagging the new value', () => {
    const rows: Row[] = [
      { hireling: 'Desert Mercenary', desc: 'off', difficulty: 2, level: 50, dex: 98, skills: [['Fend', 1]] },
      { hireling: 'Desert Mercenary', desc: 'off', difficulty: 2, level: 85, dex: 158, skills: [['Fend', 1]] },
    ];
    const { bundle, warnings } = buildMercenariesBundle({
      hireling: table(rows),
      page: [page('Desert Mercenary', 'Off - Nightmare', ['Fend'])],
      skills: SKILLS,
    });
    expect(warnings).toEqual([
      'mercenaries: Desert Mercenary Off - Nightmare level 85: the suspect dexterity 97 is gone from hireling.txt; drop it from SUSPECT_DEXTERITY',
    ]);
    expect(bundle.hirelings.at(0)?.types.at(0)?.variants.at(0)?.bands.at(1)?.dexterityTypo).toBeUndefined();
  });

  it('warns when one level differs between difficulties', () => {
    const rows: Row[] = [
      { hireling: 'Barbarian', desc: 'def', difficulty: 1, level: 65, skills: [['Fend', 1]] },
      { hireling: 'Barbarian', desc: 'def', difficulty: 2, level: 65, skills: [['Fend', 2]] },
    ];
    const { warnings } = buildMercenariesBundle({
      hireling: table(rows),
      page: [page('Barbarian', 'Defensive', ['Fend'])],
      skills: SKILLS,
    });
    expect(warnings).toContain('mercenaries: Barbarian Defensive: level 65 differs between difficulties; showing the first');
  });
});
