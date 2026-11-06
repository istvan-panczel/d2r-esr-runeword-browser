import { describe, expect, it } from 'vitest';
import { buildModifiersBundle, DIFFICULTY_FACTS, generatedCategory, opFormula, type ModifiersInput } from './bundleModifiers.ts';
import { readProperties } from './stats/tables.ts';
import { parseTsv } from './tsv.ts';

const tsv = (rows: string[][], name = 'fixture.txt') => parseTsv(rows.map((row) => row.join('\t')).join('\n'), name);

const ISC_COLUMNS = [
  'Stat',
  'op',
  'op param',
  'op base',
  'op stat1',
  'op stat2',
  'op stat3',
  'itemevent1',
  'itemeventfunc1',
  'itemevent2',
  'itemeventfunc2',
  'damagerelated',
  'maxstat',
  'descfunc',
  'descval',
  'descstrpos',
  'descstrneg',
  'descstr2',
  'dgrpstrpos',
];
const isc = (cells: Record<string, string>) => ISC_COLUMNS.map((column) => cells[column] ?? '');
const shown = (key: string) => ({ descfunc: '19', descval: '1', descstrpos: key });
/** row index = stat id */
const ISC_ROWS = [
  ISC_COLUMNS,
  // 0: the vanilla stat at its vanilla id, same columns
  isc({ Stat: 'strength', ...shown('ModStr1'), descstrneg: 'ModStr1' }),
  // 1: not vanilla, on vanilla energy's row
  isc({ Stat: 'my_esr_stat', ...shown('EsrStr') }),
  // 2: vanilla stat at another id (vanilla 136), same events
  isc({
    Stat: 'item_crushingblow',
    itemevent1: 'domeleedamage',
    itemeventfunc1: '16',
    itemevent2: 'domissiledamage',
    itemeventfunc2: '16',
    damagerelated: '1',
    ...shown('CbStr'),
    descstrneg: 'CbStr',
  }),
  // 3: per level (vanilla 216, ESR changes nothing else)
  isc({
    Stat: 'item_hp_perlevel',
    op: '2',
    'op param': '3',
    'op base': 'level',
    'op stat1': 'maxhp',
    ...shown('LifeStr'),
    descstr2: 'PerLevel',
  }),
  // 4: a key-kind stat nothing carries
  isc({ Stat: 'item_deadlystrike', ...shown('DsStr') }),
  // 5: carried by nothing and in no key kind: left out
  isc({ Stat: 'unused_stat' }),
  // 6: same description as strength: shares its generated kind
  isc({ Stat: 'strength_twin', ...shown('ModStr1') }),
  // 7: an unknown event function
  isc({ Stat: 'odd_proc', itemevent1: 'kill', itemeventfunc1: '99' }),
];

const properties = readProperties(
  tsv([
    ['code', ...[1, 2, 3, 4, 5, 6, 7].flatMap((i) => [`func${String(i)}`, `stat${String(i)}`, `set${String(i)}`, `val${String(i)}`])],
    ...[
      ['str', '1', 'strength'],
      ['str2', '1', 'strength_twin'],
      ['crush', '1', 'item_crushingblow'],
      ['hp/lvl', '17', 'item_hp_perlevel'],
      ['esr', '1', 'my_esr_stat'],
      ['odd', '1', 'odd_proc'],
    ].map(([code, func, stat]) => [code, func, stat, ...Array<string>(26).fill('')]),
  ])
);
const groups = new Map([
  [
    'crush-group',
    { code: 'crush-group', pickMode: 0, entries: [{ prop: 'crush', parMin: '', parMax: '', modMin: 5, modMax: 5, chance: 100 }] },
  ],
]);

const strings = new Map([
  ['ModStr1', '%+d to Strength'],
  ['CbStr', '%d%% Chance of Crushing Blow'],
  ['LifeStr', '%+d to Life'],
  ['PerLevel', '(Based on Character Level)'],
  ['DsStr', '%d%% Deadly Strike'],
]);

const difficultylevels = tsv([
  ['Name', ...DIFFICULTY_FACTS.map((fact) => fact.column)],
  ['Normal', ...DIFFICULTY_FACTS.map(() => '1')],
  ['Nightmare', ...DIFFICULTY_FACTS.map((fact) => (fact.column === 'LifeStealDivisor' ? '25' : '2'))],
  ['Hell', ...DIFFICULTY_FACTS.map((fact) => (fact.column === 'LifeStealDivisor' ? '150' : '3'))],
]);

const CRUSHING_BLOW = `
config_version = 1
enabled = true

[targets]
# 50 -> 12.5 % of current life.
monster = 50
# 50 -> 12.5 % of current life.
champion = 50
# 50 -> 12.5 % of current life.
unique = 25
super_unique = 16
act_boss = 16
minion = 50
mercenary = 50
player = 50

[attack]
ranged = 100
`;

const ATTACK_RATING = `
[attack_rating]
enabled = true

[curve]
# The default curve:
#   r        1   5  104
#   chance   0  50  100

pivot_ratio = 5.0
steepness = 5.0
tail = 3.0
late_tail = 1.0
blend_start_ratio = 30.0
blend_end_ratio = 100.0
snap_to_100_at = 99.5

[chance]
min_chance = 0
max_chance = 100
level_scaling = false
`;

function input(overrides: Partial<ModifiersInput> = {}): ModifiersInput {
  return {
    itemstatcost: parseTsv(ISC_ROWS.map((row) => row.join('\t')).join('\n'), 'itemstatcost.txt', { keepExpansionRows: true }),
    properties,
    groups,
    strings,
    sources: [
      { kind: 'unique', name: 'Shako', mods: [{ code: 'str' }, { code: 'crush' }, { code: 'crush' }] },
      { kind: 'runeword', name: 'Beast', mods: [{ code: 'crush' }, { code: 'hp/lvl' }] },
      { kind: 'socketable', name: 'Ruby', mods: [{ code: 'crush-group' }] },
      { kind: 'prefix', name: 'Strong', mods: [{ code: 'str' }, { code: 'str2' }] },
      { kind: 'prefix', name: 'Strong', mods: [{ code: 'str' }] },
      { kind: 'cube', name: 'Odd recipe', mods: [{ code: 'esr' }, { code: 'odd' }, { code: 'missing-code' }] },
    ],
    difficultylevels,
    charstats: tsv([
      ['class', 'BlockFactor', 'ToHitFactor', 'WalkVelocity', 'RunVelocity', 'MinimumCastingDelay'],
      ['Amazon', '5', '20', '9', '13', '0'],
      ['Paladin', '6', '20', '9', '13', '0'],
    ]),
    monstats: tsv([
      ['Id', 'enabled', 'Drain', 'Drain(N)', 'Drain(H)'],
      ['zombie', '1', '100', '100', '100'],
      ['skeleton', '1', '', '', ''],
      ['zakarum', '1', '10', '10', '10'],
      ['disabled', '0', '', '', ''],
    ]),
    configs: { 'crushing-blow': CRUSHING_BLOW, 'attack-rating': ATTACK_RATING },
    patches: {
      'esr-resistance-floor-minus-1000': JSON.stringify({
        name: 'Resistance Floor -1000',
        description: '',
        patches: [{ expected: 'B9 9C FF FF FF', bytes: 'B9 18 FC FF FF' }],
      }),
    },
    ...overrides,
  };
}

describe('buildModifiersBundle', () => {
  const { bundle, warnings } = buildModifiersBundle(input());
  const stat = (name: string) => bundle.stats.find((entry) => entry.stat === name);
  const kind = (key: string) => bundle.kinds.find((entry) => entry.key === key);
  const fact = (key: string) => bundle.facts.find((entry) => entry.key === key);

  it('lists the carried stats and the key-kind stats, in id order', () => {
    expect(bundle.stats.map((entry) => entry.stat)).toEqual([
      'strength',
      'my_esr_stat',
      'item_crushingblow',
      'item_hp_perlevel',
      'item_deadlystrike',
      'strength_twin',
      'odd_proc',
    ]);
    expect(stat('item_deadlystrike')).toMatchObject({ id: 4, items: 0, usage: {}, examples: [], kind: 'deadly-strike' });
  });

  it('counts each item once per list and expands property groups', () => {
    expect(stat('item_crushingblow')).toMatchObject({
      usage: { runeword: 1, unique: 1, socketable: 1 },
      items: 3,
      examples: [
        ['runeword', 'Beast'],
        ['unique', 'Shako'],
        ['socketable', 'Ruby'],
      ],
      properties: ['crush'],
    });
    // the two "Strong" prefix rows are two items with one example name
    expect(stat('strength')).toMatchObject({
      usage: { unique: 1, prefix: 2 },
      items: 3,
      examples: [
        ['unique', 'Shako'],
        ['prefix', 'Strong'],
      ],
    });
  });

  it('resolves the display strings, the op formula and the item events', () => {
    expect(stat('item_hp_perlevel')).toMatchObject({
      text: '%+d to Life',
      text2: '(Based on Character Level)',
      descfunc: 19,
      descval: 1,
      op: { op: 2, param: 3, base: 'level', stats: ['maxhp'], formula: 'maxhp += value × character level / 8' },
    });
    expect(stat('item_crushingblow')?.textNeg).toBeUndefined();
    expect(stat('item_crushingblow')?.events).toEqual([
      { event: 'domeleedamage', trigger: 'on a melee hit', func: 16, action: 'Crushing Blow' },
      { event: 'domissiledamage', trigger: 'on a missile hit', func: 16, action: 'Crushing Blow' },
    ]);
    expect(warnings).toContain('modifiers: stat odd_proc has unknown item event function 99');
  });

  it('compares with vanilla D2R: same, moved, ESR-only on a reused id', () => {
    expect(stat('strength')?.vanilla).toBe('same');
    expect(stat('item_crushingblow')).toMatchObject({ vanilla: 'changed', changed: ['id'] });
    expect(stat('item_hp_perlevel')).toMatchObject({ vanilla: 'changed', changed: ['id'] });
    expect(stat('my_esr_stat')).toMatchObject({ vanilla: 'esr', reusesId: 'energy' });
  });

  it('groups stats into the key kinds, then generated kinds sharing a description', () => {
    expect(kind('crushing-blow')).toEqual({ key: 'crushing-blow', title: 'Crushing Blow', category: 'offense', stats: [2], items: 3 });
    expect(kind('open-wounds')).toEqual({ key: 'open-wounds', title: 'Open Wounds', category: 'offense', stats: [], items: 0 });
    expect(kind('stat-strength')).toEqual({
      key: 'stat-strength',
      title: 'Strength',
      category: 'attributes',
      stats: [0, 6],
      generated: true,
      items: 3,
    });
    expect(stat('strength_twin')?.kind).toBe('stat-strength');
    expect(kind('stat-odd-proc')?.title).toBe('odd_proc');
    expect(warnings.some((warning) => warning.includes('key kind deadly-strike names stat item_deadlystrike_perlevel'))).toBe(true);
  });

  it('reads difficultylevels.txt per difficulty next to the vanilla values', () => {
    expect(fact('difficulty.LifeStealDivisor')).toMatchObject({
      value: [1, 25, 150],
      vanilla: [1, 2, 3],
      unit: 'divisor',
      origin: 'game-files',
      source: { file: 'difficultylevels.txt', key: 'LifeStealDivisor' },
    });
    expect(fact('charstats.BlockFactor')?.value).toEqual({ Amazon: 5, Paladin: 6 });
    expect(fact('charstats.RunVelocity')).toMatchObject({ value: { Amazon: 13, Paladin: 13 }, vanilla: { Amazon: 9 } });
    expect(fact('charstats.MinimumCastingDelay')?.value).toEqual({ Amazon: 0, Paladin: 0 });
    expect(fact('monstats.drainZero')?.value).toEqual([1, 1, 1]);
    expect(fact('monstats.drainPartial')?.value).toEqual([1, 1, 1]);
  });

  it('reads the plugin configs and keeps a comment that disagrees with its value as a note and a warning', () => {
    expect(fact('crushingBlow.settings')?.value).toMatchObject({ monster: 50, unique: 25, super_unique: 16 });
    const share = fact('crushingBlow.share');
    expect(share?.value).toMatchObject({ monster: 12.5, unique: 6.25, super_unique: 2, act_boss: 2, mercenary: 5, player: 5 });
    expect(share?.source).toEqual({ file: 'd2rloader/config/celestialrayone.crushing-blow.toml', key: 'targets' });
    expect(share?.note).toContain('unique = 25 gives 6.25 % of current life, but its config comment says "50 -> 12.5 %"');
    expect(warnings).toContain(
      'modifiers: crushing-blow.toml unique = 25 gives 6.25 % of current life, but its config comment says "50 -> 12.5 %"'
    );
    expect(fact('crushingBlow.ranged')).toMatchObject({ value: 100, vanilla: 50 });
    expect(fact('attackRating.curve')?.value).toMatchObject({ pivotRatio: 5, steepness: 5, tail: 3, lateTail: 1, levelScaling: 0 });
    expect(fact('attackRating.table')?.value).toEqual({ '1': 0, '5': 50, '104': 100 });
    expect(warnings).toContain('modifiers: d2rloader/config/celestialrayone.dodge-avoid-evade-cap.toml is missing; its facts are left out');
  });

  it('decodes the resistance floor from the patch bytes and adds the engine constants', () => {
    expect(fact('resist.floor')).toMatchObject({ value: -1000, vanilla: -100, origin: 'esr-config' });
    expect(fact('magicFind.dim')).toMatchObject({ value: { unique: 250, set: 500, rare: 600 }, origin: 'vanilla-engine' });
  });
});

describe('opFormula', () => {
  it('writes the op codes as formulas', () => {
    expect(opFormula(2, 3, 'level', ['maxhp'])).toBe('maxhp += value × character level / 8');
    expect(opFormula(11, 0, '', ['strength'])).toBe('strength += strength × value / 100 (unit total)');
    expect(opFormula(13, 0, '', ['maxdamage', 'secondary_maxdamage'])).toBe(
      'maxdamage, secondary_maxdamage += base maxdamage, secondary_maxdamage of the item × value / 100'
    );
    expect(opFormula(42, 0, '', [])).toBe('op 42 on (no stat)');
  });
});

describe('generatedCategory', () => {
  it('sorts stat names into categories', () => {
    expect(generatedCategory('item_addskill_tab')).toBe('skills');
    expect(generatedCategory('armorclass')).toBe('defense');
    expect(generatedCategory('firemindam')).toBe('offense');
    expect(generatedCategory('manarecoverybonus')).toBe('resources');
    expect(generatedCategory('maxhp')).toBe('attributes');
    expect(generatedCategory('item_fastercastrate')).toBe('speed');
    expect(generatedCategory('item_numsockets')).toBe('other');
  });
});
