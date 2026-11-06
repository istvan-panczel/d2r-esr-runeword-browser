import { describe, expect, it } from 'vitest';
import { bottomUp, buildSkillDetailsBundle, evalSimpleCalc, readGrantSources, type SkillDetailsInput } from './bundleSkillDetails.ts';
import { parseTsv } from './tsv.ts';

/** Rows as column → value records, so a test names only the cells it needs */
function table(columns: readonly string[], rows: readonly Record<string, string>[]) {
  return parseTsv([columns.join('\t'), ...rows.map((row) => columns.map((column) => row[column] ?? '').join('\t'))].join('\n'));
}

const SKILL_COLUMNS = [
  'skill',
  'charclass',
  'skilldesc',
  'reqlevel',
  'maxlvl',
  'reqskill1',
  'reqskill2',
  'reqskill3',
  'aura',
  'passive',
  'EType',
  'mana',
  'lvlmana',
  'manashift',
  'Param8',
];
const DESC_COLUMNS = [
  'skilldesc',
  'SkillPage',
  'SkillRow',
  'SkillColumn',
  'IconCel',
  'str name',
  'str long',
  ...[1, 2].flatMap((i) =>
    ['desc', 'dsc2'].flatMap((p) => [`${p}texta${String(i)}`, `${p}textb${String(i)}`, `${p}calca${String(i)}`, `${p}calcb${String(i)}`])
  ),
  ...[1, 2, 3, 4].flatMap((i) => [`dsc3texta${String(i)}`, `dsc3textb${String(i)}`, `dsc3calca${String(i)}`, `dsc3calcb${String(i)}`]),
];

function input(items: SkillDetailsInput['items'] = []): SkillDetailsInput {
  return {
    skills: table(SKILL_COLUMNS, [
      { skill: 'Attack', skilldesc: 'attack', reqlevel: '1', maxlvl: '1' },
      {
        skill: 'Fire Bolt',
        charclass: 'sor',
        skilldesc: 'fire bolt',
        reqlevel: '1',
        maxlvl: '20',
        EType: 'fire',
        mana: '8',
        lvlmana: '2',
        manashift: '6',
        Param8: '6',
      },
      { skill: 'Fire Ball', charclass: 'sor', skilldesc: 'fire ball', reqlevel: '12', maxlvl: '20', reqskill1: 'Fire Bolt' },
      { skill: 'Warmth', charclass: 'sor', skilldesc: 'warmth', reqlevel: '1', maxlvl: '20', passive: '1' },
      { skill: 'Fire Surge', skilldesc: 'fire surge', reqlevel: '1', maxlvl: '20' },
      { skill: 'Lonely Proc', skilldesc: 'lonely proc', reqlevel: '1', maxlvl: '20' },
      { skill: 'Hidden Proc', reqlevel: '1', maxlvl: '20' },
      { skill: 'Holy Fire', charclass: 'pal', skilldesc: 'holy fire', reqlevel: '6', maxlvl: '20', aura: '1', passive: '1' },
    ]),
    skilldesc: table(DESC_COLUMNS, [
      { skilldesc: 'attack', SkillPage: '0', IconCel: '2', 'str name': 'AttackName' },
      {
        skilldesc: 'fire bolt',
        SkillPage: '1',
        SkillRow: '1',
        SkillColumn: '3',
        IconCel: '0',
        'str name': 'FireBoltName',
        'str long': 'FireBoltLong',
        desctexta1: 'ManaCost',
        desccalca1: 'usmc',
        dsc2texta1: 'Stacks',
        dsc2calca1: '6',
        dsc2texta2: 'Cooldown1',
        dsc2textb2: 'Cooldowns',
        dsc2calca2: '2',
        dsc3texta1: 'Sksyn',
        dsc3textb1: 'FireBoltName',
        dsc3texta2: 'Firedplev',
        dsc3textb2: 'FireBallName',
        dsc3calca2: 'par8*2',
        dsc3texta3: 'Firedplev',
        dsc3textb3: 'WarmthName',
        dsc3calca3: 'clc1',
        dsc3texta4: 'BothNote',
      },
      {
        skilldesc: 'fire ball',
        SkillPage: '1',
        SkillRow: '2',
        SkillColumn: '3',
        IconCel: '22',
        'str name': 'FireBallName',
        desctexta1: 'FbRadius',
        desccalca1: '4',
        desctexta2: 'FbSplit',
        desccalca2: '3',
        dsc2texta1: 'FbPinned1',
        dsc2texta2: 'FbPinned2',
      },
      {
        skilldesc: 'warmth',
        SkillPage: '1',
        SkillRow: '1',
        SkillColumn: '1',
        IconCel: '4',
        'str name': 'WarmthName',
        'str long': 'NoSuchKey',
      },
      { skilldesc: 'fire surge', SkillPage: '0', IconCel: '70', 'str name': 'FireSurgeName', 'str long': 'FireSurgeName' },
      { skilldesc: 'lonely proc', SkillPage: '0', IconCel: '1', 'str name': 'LonelyName' },
      { skilldesc: 'holy fire', SkillPage: '2', SkillRow: '1', SkillColumn: '1', IconCel: '12', 'str name': 'HolyFireName' },
    ]),
    classes: [{ code: 'ama' }, { code: 'sor' }, { code: 'pal' }],
    strings: new Map([
      ['AttackName', 'Attack'],
      ['FireBoltName', 'Fire Bolt'],
      ['FireBoltLong', 'Create a flaming missile\nEvery cast grants a stack'],
      ['FireBallName', 'Fire Ball'],
      ['WarmthName', 'Warmth'],
      ['FireSurgeName', 'Fire Surge'],
      ['HolyFireName', 'Holy Fire'],
      ['LonelyName', 'Lonely Proc'],
      ['ManaCost', 'Mana Cost: %d'],
      ['FbRadius', 'Radius: %d yards'],
      ['FbSplit', 'Splits into %d'],
      ['FbPinned1', 'Pinned one'],
      ['FbPinned2', 'Pinned two'],
      ['Stacks', 'up to %d stacks\nFirestarter lasts'],
      ['Cooldown1', 'Cooldown: %d second'],
      ['Cooldowns', 'Cooldown: %d seconds'],
      ['Sksyn', '%s Receives Bonuses From:'],
      ['Firedplev', '%s: %+d%% Fire Damage per Level'],
      ['BothNote', 'Bolts split\nIf both Fire Bolt and Fire Ball have 20 levels:'],
    ]),
    items,
  };
}

describe('evalSimpleCalc', () => {
  const params = (n: number) => (n === 8 ? 6 : 0);
  it('evaluates integers, skill params and + - * / with parentheses', () => {
    expect(evalSimpleCalc('6', params)).toBe(6);
    expect(evalSimpleCalc('par8*2', params)).toBe(12);
    expect(evalSimpleCalc('(par8 + 4) / 3', params)).toBe(3);
    expect(evalSimpleCalc('-par8', params)).toBe(-6);
  });
  it('rejects formulas that need the skill level or other skills', () => {
    expect(evalSimpleCalc('clc6', params)).toBeNull();
    expect(evalSimpleCalc('usmc', params)).toBeNull();
    expect(evalSimpleCalc('ln12', params)).toBeNull();
    expect(evalSimpleCalc("skill('Fire Ball'.blvl)*par8", params)).toBeNull();
    expect(evalSimpleCalc('12/clc4', params)).toBeNull();
    expect(evalSimpleCalc('', params)).toBeNull();
  });
});

describe('bottomUp', () => {
  it('reads a multi-line description string from the bottom', () => {
    expect(bottomUp('cast rate to a minimum\nTick rate goes down')).toBe('Tick rate goes down\ncast rate to a minimum');
  });
});

describe('buildSkillDetailsBundle', () => {
  const items: SkillDetailsInput['items'] = [
    {
      kind: 'unique',
      name: 'Hellmouth',
      mods: [
        { code: 'hit-skill', param: 'Fire Bolt', min: 5, max: 60 },
        { code: 'oskill', param: 'fire surge', min: 1, max: 3 },
        { code: 'oskill-hidden', param: 'Fire Ball', min: 1, max: 1 },
        { code: 'skill-rand', param: '3', min: 36, max: 64 },
      ],
    },
    { kind: 'unique', name: 'Hellmouth', mods: [{ code: 'hit-skill', param: 'Fire Bolt', min: 5, max: 60 }] },
    {
      kind: 'set',
      name: 'Arcanna Head',
      mods: [{ code: 'charged', param: 'Fire Ball', min: 7, max: 12 }],
      partialMods: [{ code: 'aura', param: 'Holy Fire', min: 3, max: 3 }],
    },
    {
      kind: 'runeword',
      name: 'Ember',
      mods: [
        { code: 'skill', param: 'Fire Bolt', min: 2, max: 2 },
        { code: 'oskill', param: 'Hidden Proc', min: 1, max: 1 },
      ],
    },
    { kind: 'gemword', name: 'Glow', mods: [{ code: 'oskill', param: 'No Such Skill', min: 1, max: 1 }] },
  ];
  const { bundle, undescribedGrants, warnings } = buildSkillDetailsBundle(input(items));
  const byId = (id: string) => bundle.skills.find((skill) => skill.id === id);

  it('lists class skills in class / tab / row / column order, then granted item skills', () => {
    expect(bundle.skills.map((skill) => skill.id)).toEqual(['Warmth', 'Fire Bolt', 'Fire Ball', 'Holy Fire', 'Fire Surge']);
    // Attack (no grant), Lonely Proc (no grant) and Hidden Proc (no skilldesc) are left out
    expect(undescribedGrants).toBe(1);
  });

  it('reads the scalar fields, the long description and the icon key', () => {
    expect(byId('Fire Bolt')).toMatchObject({
      name: 'Fire Bolt',
      cls: 'sor',
      page: 1,
      reqLevel: 1,
      maxLevel: 20,
      element: 'Fire',
      mana: [2, 0.5],
      description: ['Create a flaming missile', 'Every cast grants a stack'],
      icon: 'so-0',
    });
    expect(byId('Fire Ball')).toMatchObject({ reqSkills: ['Fire Bolt'], icon: 'so-22' });
    expect(byId('Fire Ball')?.mana).toBeUndefined();
    expect(byId('Warmth')?.type).toBe('passive');
    expect(byId('Holy Fire')).toMatchObject({ type: 'aura', icon: 'pa-12', page: 2 });
    expect(byId('Fire Surge')).toMatchObject({ cls: null, page: null, icon: 'gen-70', description: [] });
  });

  it('keeps constant description lines (bottom-up) and drops formula, plural-pair and mana lines', () => {
    expect(byId('Fire Bolt')?.lines).toEqual(['Firestarter lasts\nup to 6 stacks']);
  });

  it('orders the lines as the tooltip (and the calculator) shows them: dsc2 bottom-up, then desc bottom-up', () => {
    expect(byId('Fire Ball')?.lines).toEqual(['Pinned two', 'Pinned one', 'Splits into 3', 'Radius: 4 yards']);
  });

  it('reads synergies with param values, "?" for formulas, and special rules as notes', () => {
    expect(byId('Fire Bolt')?.synergies).toEqual([
      { name: 'Fire Ball', text: '+12% Fire Damage per Level' },
      { name: 'Warmth', text: '+?% Fire Damage per Level' },
    ]);
    expect(byId('Fire Bolt')?.notes).toEqual(['If both Fire Bolt and Fire Ball have 20 levels:\nBolts split']);
  });

  it('collects visible grants per skill, deduplicated, with chance / charges / partial', () => {
    const name = (i: number) => bundle.items[i]?.name;
    expect(bundle.items).toEqual([
      { kind: 'unique', name: 'Hellmouth' },
      { kind: 'set', name: 'Arcanna Head' },
      { kind: 'runeword', name: 'Ember' },
    ]);
    expect(byId('Fire Bolt')?.grantedBy?.map((grant) => ({ ...grant, item: name(grant.item) }))).toEqual([
      { item: 'Hellmouth', how: 'hit-skill', level: 60, chance: 5 },
      { item: 'Ember', how: 'skill', level: 2 },
    ]);
    expect(byId('Fire Surge')?.grantedBy).toEqual([{ item: 0, how: 'oskill', level: [1, 3] }]);
    expect(byId('Fire Ball')?.grantedBy).toEqual([{ item: 1, how: 'charged', level: 12, charges: 7 }]);
    expect(byId('Holy Fire')?.grantedBy).toEqual([{ item: 1, how: 'aura', level: 3, partial: true }]);
  });

  it('warns about unknown skills and missing strings', () => {
    expect(warnings).toContain('skilldetails: unknown skill in oskill "No Such Skill" (Glow)');
    expect(warnings).toContain('skilldetails: skill "Warmth" description string "NoSuchKey" not in the strings');
  });
});

/** `<code>1 <param>1 <min>1 <max>1 … <code>n …` */
const propColumns = (n: number, ...parts: string[]) =>
  Array.from({ length: n }, (_, i) => parts.map((part) => `${part}${String(i + 1)}`)).flat();

describe('readGrantSources', () => {
  it('reads uniques (not disabled), set items with partial props and runes.txt recipes as runewords or gemwords', () => {
    const strings = new Map([
      ['Hellmouth', 'Hellmouth'],
      ['Arcanna Head', "Arcanna's Head"],
      ['Runeword1', 'Ember'],
      ['Gem1', 'Glow'],
    ]);
    const sources = readGrantSources({
      uniqueitems: table(
        ['index', 'disabled', ...propColumns(12, 'prop', 'par', 'min', 'max')],
        [
          { index: 'Hellmouth', prop1: 'hit-skill', par1: 'Fire Bolt', min1: '5', max1: '60' },
          { index: 'Old', disabled: '1', prop1: 'oskill', par1: 'Teleport', min1: '1', max1: '1' },
        ]
      ),
      setitems: table(
        [
          'index',
          ...propColumns(9, 'prop', 'par', 'min', 'max'),
          ...['a', 'b'].flatMap((side) => propColumns(5, 'aprop', 'apar', 'amin', 'amax').map((column) => `${column}${side}`)),
        ],
        [
          {
            index: 'Arcanna Head',
            prop1: 'charged',
            par1: 'Fire Ball',
            min1: '7',
            max1: '12',
            aprop1a: 'aura',
            apar1a: 'Holy Fire',
            amin1a: '3',
            amax1a: '3',
          },
        ]
      ),
      runes: [
        {
          key: 'Runeword1',
          itypes: [],
          etypes: [],
          codes: ['r01', 'jew'],
          mods: [{ code: 'oskill', param: 'Fire Surge', min: 1, max: 1 }],
        },
        { key: 'Gem1', itypes: [], etypes: [], codes: ['gsr'], mods: [{ code: 'aura', param: 'Holy Fire', min: 2, max: 2 }] },
        { key: 'NoName', itypes: [], etypes: [], codes: ['r01'], mods: [] },
      ],
      strings,
      isRune: (code) => code === 'r01',
    });
    expect(sources).toEqual([
      { kind: 'unique', name: 'Hellmouth', mods: [{ code: 'hit-skill', param: 'Fire Bolt', min: 5, max: 60 }] },
      {
        kind: 'set',
        name: "Arcanna's Head",
        mods: [{ code: 'charged', param: 'Fire Ball', min: 7, max: 12 }],
        partialMods: [{ code: 'aura', param: 'Holy Fire', min: 3, max: 3 }],
      },
      { kind: 'runeword', name: 'Ember', mods: [{ code: 'oskill', param: 'Fire Surge', min: 1, max: 1 }] },
      { kind: 'gemword', name: 'Glow', mods: [{ code: 'aura', param: 'Holy Fire', min: 2, max: 2 }] },
    ]);
  });
});
