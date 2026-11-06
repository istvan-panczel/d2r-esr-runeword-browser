import { describe, expect, it } from 'vitest';
import type { SkillCalcBundle, SkillCalcLine, SkillCalcSkill } from '../schema.ts';
import {
  defaultContext,
  evaluateSkill,
  indexSkillCalc,
  itemTriggerInfo,
  maxSynergyPoints,
  oneDecimal,
  skillTable,
  synergyInputs,
  tooltipOrder,
} from './index.ts';
import { bottomUp, placeholderCount, printfMarked, splitMarked } from './text.ts';

const TEXTS = [
  'Mana Cost: %d', // 0
  'Radius: %d yard', // 1
  'Radius: %d yards', // 2
  'Fire Damage: %d-%d', // 3
  'Enemy Fire Resist: %+d%%', // 4
  '%s Receives Bonuses From:', // 5
  'Fire Ball', // 6
  '%s: %+d%% Fire Damage per Level', // 7
  'Fire Bolt', // 8
  'second line\nfirst line %d', // 9
  'Attack Rating: ', // 10
  'Cooldown: %d second', // 11
  'Cooldown: %d seconds', // 12
  'Skeleton Mastery', // 13
  ' percent', // 14
  ' to Vitality', // 15
];

const line = (key: string, type: number, rest: Partial<SkillCalcLine> = {}): SkillCalcLine => ({ key, type, ...rest });

const FIRE_BALL: SkillCalcSkill = {
  id: 'Fire Ball',
  maxHardPoints: 20,
  synergies: ['Fire Bolt'],
  itemEffect: 1,
  lines: [
    line('desc1', 36, { a: 0, ca: 'usmc', cb: '256' }),
    line('desc2', 75, { a: 3, ca: 'enma', cb: 'exma' }),
    line('desc3', 74, { a: 4, ca: '-10-lvl/2' }),
    line('desc4', 36, { a: 1, b: 2, ca: 'clc1*2', cb: '3' }),
    line('desc5', 74, { a: 9, ca: 'lvl', blvl: true }),
    line('desc6', 5, { a: 10, ca: 'ulvl*2', ulvl: true }),
    line('dsc2-1', 36, { a: 11, b: 12, ca: '25', cb: '25' }),
    line('dsc2-2', 74, { a: 9, ca: 'clc9' }),
    line('dsc3-1', 40, { a: 5, b: 6, ca: '2' }),
    line('dsc3-2', 76, { a: 7, b: 8, ca: 'par8' }),
    line('dsc3-3', 3, { a: 10, b: 14, ca: 'lvl>1?7:7' }),
    line('dsc3-4', 4, { a: 10, b: 14, ca: '-3' }),
    line('dsc3-5', 6, { a: 15, b: 14, ca: 'par8' }),
  ],
};
const BUNDLE: SkillCalcBundle = {
  skills: [FIRE_BALL, { id: 'Proc', maxHardPoints: 0, lines: [] }],
  rows: [
    {
      id: 'Fire Ball',
      calc1: '6+lvl/10',
      calc9: 'clc0',
      Param8: 6,
      HitShift: 8,
      EMin: 10,
      EMinLev1: 2,
      EMinLev2: 4,
      EMinLev3: 6,
      EMinLev4: 8,
      EMinLev5: 10,
      EMax: 20,
      EMaxLev1: 4,
      EMaxLev2: 6,
      EMaxLev3: 8,
      EMaxLev4: 10,
      EMaxLev5: 12,
      EDmgSymPerCalc: "(skill('Fire Bolt'.blvl)*par8*(100+skill('Attack'.clc3))/100)",
      mana: 10,
      lvlmana: 1,
      manashift: 7,
    },
    { id: 'Fire Bolt', maxlvl: 20 },
    { id: 'Attack' },
  ],
  missiles: [],
  texts: TEXTS,
};
const index = indexSkillCalc(BUNDLE);

describe('text helpers', () => {
  it('prints with marked numbers and splits them back', () => {
    const marked = printfMarked('Fire Damage: %d-%d (%+d%%) %s', [10, 20, 5, 'x']);
    expect(splitMarked(marked)).toEqual({
      text: 'Fire Damage: 10-20 (+5%) x',
      values: [10, 20, 5],
      before: 'Fire Damage: ',
      span: '10-20 (+5',
      after: '%) x',
    });
    expect(splitMarked(printfMarked('%+d', [-3])).text).toBe('-3');
    expect(splitMarked('plain')).toEqual({ text: 'plain', values: [], before: 'plain', span: '', after: '' });
    expect(placeholderCount('%s: %+d%% per %d')).toBe(3);
    expect(bottomUp('b\n a \n\n')).toBe('a\nb');
  });

  it('rounds to one decimal at most', () => {
    expect([oneDecimal(16 / 3), oneDecimal(14.5), oneDecimal(4), oneDecimal(68 / 3), oneDecimal(-0.01)]).toEqual([5.3, 14.5, 4, 22.7, 0]);
  });
});

describe('evaluateSkill', () => {
  it('formats the line functions at a level, in tooltip order (dsc2 and desc blocks bottom-up, dsc3 top-down)', () => {
    const lines = evaluateSkill(FIRE_BALL, index, defaultContext(FIRE_BALL, { level: 20, charLevel: 40 }));
    expect(lines.map((entry) => (entry.unavailable === true ? `${entry.key}: —` : `${entry.key}: ${entry.text}`))).toEqual([
      'dsc2-2: —',
      'dsc2-1: Cooldown: 1 second',
      'desc6: Attack Rating: 80',
      'desc5: first line 20\nsecond line',
      'desc4: Radius: 5.3 yards',
      'desc3: Enemy Fire Resist: -20%',
      'desc2: Fire Damage: 80-128',
      'desc1: Mana Cost: 14.5',
      'dsc3-1: Fire Ball Receives Bonuses From:',
      'dsc3-2: Fire Bolt: +6% Fire Damage per Level',
      // the game compiles lvl>1?7:7 as lvl > (1 ? 7 : 7)
      'dsc3-3: Attack Rating: 1 percent',
      // types 4 and 6 print "+%d" and no textb
      'dsc3-4: Attack Rating: +-3',
      'dsc3-5: +6 to Vitality',
    ]);
    const byKey = (key: string) => lines.find((entry) => entry.key === key);
    expect(byKey('desc1')).toMatchObject({ block: 'level', values: [14.5], before: 'Mana Cost: ', span: '14.5', after: '' });
    expect(byKey('desc4')).toMatchObject({ values: [5.3] });
    expect(byKey('desc5')).toMatchObject({ readsHardPoints: true, before: 'first line ', after: '\nsecond line' });
    expect(byKey('desc6')).toMatchObject({ readsCharLevel: true });
    expect(byKey('dsc2-1')).toMatchObject({ block: 'fixed' });
    expect(byKey('dsc3-1')).toMatchObject({ block: 'synergy', color: 2, values: [] });
    expect(byKey('dsc3-4')).toMatchObject({ values: [-3], before: 'Attack Rating: +', span: '-3' });
  });

  it('orders lines like the tooltip', () => {
    const keys = ['desc1', 'desc2', 'dsc2-1', 'dsc2-2', 'dsc3-1', 'dsc3-2', 'desc3'].map((key) => ({ key }));
    expect(tooltipOrder(keys).map(({ key }) => key)).toEqual(['dsc2-2', 'dsc2-1', 'desc3', 'desc2', 'desc1', 'dsc3-1', 'dsc3-2']);
  });

  it('applies synergy points and picks singular texts at exactly 1', () => {
    const at1 = evaluateSkill(FIRE_BALL, index, defaultContext(FIRE_BALL, { level: 1 }));
    expect(at1.find((entry) => entry.key === 'desc4')?.text).toBe('Radius: 4 yards');
    const withSynergy = evaluateSkill(FIRE_BALL, index, defaultContext(FIRE_BALL, { level: 1, synergyPoints: { 'Fire Bolt': 20 } }));
    // +120%
    expect(withSynergy.find((entry) => entry.key === 'desc2')?.text).toBe('Fire Damage: 22-44');
  });
});

describe('contexts and inputs', () => {
  it('derives hard points from the level for class skills and keeps item skills at 0', () => {
    expect(defaultContext(FIRE_BALL, { level: 30 })).toMatchObject({ level: 30, hardPoints: 20, charLevel: 110, stats: {} });
    expect(defaultContext(FIRE_BALL, { level: 5, hardPoints: 12 })).toMatchObject({ hardPoints: 5 });
    expect(defaultContext(FIRE_BALL, { level: 30, hardPoints: 1 })).toMatchObject({ hardPoints: 1 });
    const proc = index.record('Proc');
    expect(proc).toBeDefined();
    if (proc !== undefined) expect(defaultContext(proc, { level: 30 }).hardPoints).toBe(0);
  });

  it('lists the synergy inputs with their caps, the listed ones first', () => {
    expect(synergyInputs(FIRE_BALL, index)).toEqual([{ id: 'Fire Bolt', max: 20, listed: true }]);
    expect(maxSynergyPoints(FIRE_BALL, index)).toEqual({ 'Fire Bolt': 20 });
    const withUnlisted: SkillCalcSkill = { ...FIRE_BALL, unlistedSynergies: ['Attack', 'Nope'] };
    expect(synergyInputs(withUnlisted, index)).toEqual([
      { id: 'Fire Bolt', max: 20, listed: true },
      { id: 'Attack', max: 20, listed: false },
      { id: 'Nope', max: 20, listed: false },
    ]);
    expect(maxSynergyPoints(withUnlisted, index)).toEqual({ 'Fire Bolt': 20, Attack: 20, Nope: 20 });
    // one input per skill id: a repeated id (listed twice, or listed and unlisted) keeps its first place
    const repeated: SkillCalcSkill = {
      ...FIRE_BALL,
      synergies: ['Fire Bolt', 'Attack', 'Fire Bolt'],
      unlistedSynergies: ['Attack', 'Nope'],
    };
    expect(synergyInputs(repeated, index).map(({ id, listed }) => `${id}:${String(listed)}`)).toEqual([
      'Fire Bolt:true',
      'Attack:true',
      'Nope:false',
    ]);
  });

  it('tells whether item procs can cast the skill', () => {
    expect(itemTriggerInfo(FIRE_BALL).value).toBe('yes');
    expect(itemTriggerInfo({ id: 'x', maxHardPoints: 0, lines: [] }).value).toBe('unknown');
  });
});

describe('skillTable', () => {
  it('gives a cell per level, labels from the last column and drops rows unavailable everywhere', () => {
    const rows = skillTable(FIRE_BALL, index, [1, 20, 30, 50]);
    expect(rows.map((row) => row.key)).not.toContain('dsc2-2');
    expect(rows.slice(0, 3).map((row) => row.key)).toEqual(['dsc2-1', 'desc6', 'desc5']);
    const damage = rows.find((row) => row.key === 'desc2');
    expect(damage?.label).toBe('Fire Damage: …');
    expect(damage?.cells.map((cell) => cell.span)).toEqual(['10-20', '80-128', '160-228', '360-468']);
    expect(damage?.varies).toBe(true);
    expect(rows.find((row) => row.key === 'desc4')?.label).toBe('Radius: … yards');
    expect(rows.find((row) => row.key === 'dsc3-2')).toMatchObject({ varies: false, block: 'synergy' });
    expect(rows.find((row) => row.key === 'desc6')).toMatchObject({ readsCharLevel: true });
  });
});
