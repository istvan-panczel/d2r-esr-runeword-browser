import { describe, expect, it } from 'vitest';
import type { SkillLineResult, SkillTableRow } from '@/features/game-data/engine/skillCalc';
import {
  buildSkillLevel,
  cellText,
  clampLevel,
  formatSynergyParam,
  fullTableLevels,
  gearForLevel,
  grantLevel,
  headlineKeys,
  headlineTexts,
  parseLevelParam,
  parseSynergyParam,
  resolveSynergyPoints,
  rowLabel,
  synergyTexts,
  tableRow,
  varyingRows,
  withSynergyPoints,
} from './skillLevels';

/** A line result from its text, split at the first run of numbers like the calculator does */
function line(key: string, text: string, block: SkillLineResult['block'] = 'level'): SkillLineResult {
  const match = /[-+]?\d[\d.]*(?:-\d[\d.]*)?/.exec(text);
  const values = match === null ? [] : match[0].split(/(?<=\d)-/).map(Number);
  return {
    key,
    block,
    type: 74,
    text,
    values,
    before: match === null ? text : text.slice(0, match.index),
    span: match === null ? '' : match[0],
    after: match === null ? '' : text.slice(match.index + match[0].length),
    readsCharLevel: false,
    readsHardPoints: false,
  };
}

function row(key: string, texts: string[], block: SkillLineResult['block'] = 'level'): SkillTableRow {
  const cells = texts.map((text) => line(key, text, block));
  return {
    key,
    block,
    type: 74,
    label: texts.at(-1) ?? '',
    cells,
    varies: new Set(texts).size > 1,
    readsCharLevel: false,
    readsHardPoints: false,
  };
}

const FIRE_BALL_ROWS = [
  row('desc1', ['Mana Cost: 5', 'Mana Cost: 14.5']),
  row('desc2', ['Fire Damage: 10-20', 'Fire Damage: 80-128']),
  row('desc3', ['Enemy Fire Resist: -10%', 'Enemy Fire Resist: -20%']),
  row('desc4', ['Radius: 4 yards', 'Radius: 5.3 yards']),
  row('dsc2-1', ['Splits into 3', 'Splits into 3'], 'fixed'),
  row('dsc3-2', ['Fire Bolt: +6% Fire Damage per Level', 'Fire Bolt: +8% Fire Damage per Level'], 'synergy'),
];

describe('levels', () => {
  it('clamps levels and reads level params', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(250)).toBe(110);
    expect(clampLevel(30.7)).toBe(30);
    expect(clampLevel(Number.NaN)).toBe(20);
    expect(parseLevelParam(null, 20)).toBe(20);
    expect(parseLevelParam('45', 20)).toBe(45);
    expect(parseLevelParam('4.5', 20)).toBe(20);
    expect(parseLevelParam('111', 110)).toBe(110);
    for (const bad of ['0', '-5', '', '  ', 'abc', '1e1']) expect(parseLevelParam(bad, 20), bad).toBe(20);
  });

  it('lists 1..20, every 5th level to 110 and the selected level', () => {
    const levels = fullTableLevels(20);
    expect(levels.slice(0, 21)).toEqual([...Array.from({ length: 20 }, (_, i) => i + 1), 25]);
    expect(levels.at(-1)).toBe(110);
    expect(levels).toHaveLength(38);
    expect(fullTableLevels(33)).toContain(33);
    expect(fullTableLevels(33)).toHaveLength(39);
    expect(fullTableLevels(33).indexOf(33)).toBe(fullTableLevels(33).indexOf(30) + 1);
  });
});

describe('synergies', () => {
  const inputs = [
    { id: 'Fire Bolt', max: 20 },
    { id: 'Rain of Fire', max: 20 },
    { id: 'Molten Focus', max: 10 },
    // an unlisted synergy (a class skill the formulas read) comes after the listed ones
    { id: 'Warmth', max: 20, listed: false },
  ];

  it('parses and formats the syn param', () => {
    expect(parseSynergyParam(null)).toEqual([]);
    expect(parseSynergyParam('max')).toBe('max');
    expect(parseSynergyParam('5.0.20.0')).toEqual([5, 0, 20]);
    expect(parseSynergyParam('5.x')).toEqual([]);
    expect(parseSynergyParam('5.-1')).toEqual([]);
    expect(parseSynergyParam('100')).toEqual([]);
    expect(parseSynergyParam('5.100')).toEqual([]);
    expect(parseSynergyParam('MAX')).toEqual([]);
    // a long list (unlisted synergies after the listed ones) is kept up to 40 entries
    const long = Array.from({ length: 50 }, (_, i) => String(i % 7)).join('.');
    expect(parseSynergyParam(long)).toHaveLength(40);
    expect(parseSynergyParam(Array.from({ length: 21 }, () => '1').join('.'))).toHaveLength(21);
    expect(formatSynergyParam('max')).toBe('max');
    expect(formatSynergyParam([5, 0, 20, 0])).toBe('5.0.20');
    expect(formatSynergyParam([0, 0])).toBeNull();
    expect(formatSynergyParam([])).toBeNull();
  });

  it('resolves max, positional and by-id settings with the caps', () => {
    expect(resolveSynergyPoints(inputs, 'max')).toEqual({ 'Fire Bolt': 20, 'Rain of Fire': 20, 'Molten Focus': 10, Warmth: 20 });
    expect(resolveSynergyPoints(inputs, [5, 0, 99])).toEqual({ 'Fire Bolt': 5, 'Molten Focus': 10 });
    expect(resolveSynergyPoints(inputs, [0, 0, 0, 7])).toEqual({ Warmth: 7 });
    expect(resolveSynergyPoints(inputs, { 'Rain of Fire': 3, Teleport: 20, Warmth: 4 })).toEqual({ 'Rain of Fire': 3, Warmth: 4 });
    expect(resolveSynergyPoints(inputs, [])).toEqual({});
  });

  it('changes one synergy and keeps what the others showed', () => {
    expect(withSynergyPoints(inputs, 'max', 'Rain of Fire', 4)).toEqual([20, 4, 10, 20]);
    expect(withSynergyPoints(inputs, [], 'Warmth', 3)).toEqual([0, 0, 0, 3]);
    expect(withSynergyPoints(inputs, [], 'Fire Bolt', 30)).toEqual([20]);
    expect(withSynergyPoints(inputs, { 'Molten Focus': 2 }, 'Fire Bolt', 1)).toEqual([1, 0, 2]);
    expect(withSynergyPoints(inputs, [5], 'Fire Bolt', 0)).toEqual([]);
  });

  it('takes the calculated synergy texts by name, once each', () => {
    const results = [
      line('dsc3-1', 'Fire Ball Receives Bonuses From:', 'synergy'),
      line('dsc3-2', 'Fire Bolt: +6% Fire Damage per Level', 'synergy'),
      line('dsc3-3', 'Fire Bolt: +2% Radius per Level', 'synergy'),
    ];
    expect(synergyTexts([{ name: 'Fire Bolt' }, { name: 'Fire Bolt' }, { name: 'Golem Mastery' }], results)).toEqual([
      '+6% Fire Damage per Level',
      '+2% Radius per Level',
      undefined,
    ]);
  });
});

describe('table labels and headline values', () => {
  it('labels a row by the text around the number and keeps the unit in the cell', () => {
    const [mana, damage, resist, radius] = FIRE_BALL_ROWS;
    expect([mana, damage, resist, radius].map((entry) => (entry === undefined ? '' : rowLabel(entry)))).toEqual([
      'Mana Cost',
      'Fire Damage',
      'Enemy Fire Resist',
      'Radius',
    ]);
    expect(cellText(line('desc4', 'Radius: 5.3 yards'))).toBe('5.3 yards');
    expect(cellText(line('desc3', 'Enemy Fire Resist: -20%'))).toBe('-20%');
    const effect = row('dsc2-1', ['+3% Total Effect per Base Point', '+6% Total Effect per Base Point'], 'fixed');
    expect(rowLabel(effect)).toBe('Total Effect per Base Point');
    expect(cellText(line('dsc2-1', '+3% Total Effect per Base Point'))).toBe('+3%');
    expect(cellText({ ...line('x', 'Fire Damage: 1-2'), unavailable: true })).toBe('–');
  });

  it('keeps the rows that vary outside the synergy block', () => {
    expect(varyingRows(FIRE_BALL_ROWS).map((entry) => entry.key)).toEqual(['desc1', 'desc2', 'desc3', 'desc4']);
  });

  it('picks the first varying per-level lines without mana as headlines', () => {
    expect(headlineKeys(FIRE_BALL_ROWS)).toEqual(['desc2', 'desc3']);
    expect(headlineKeys(FIRE_BALL_ROWS, 1)).toEqual(['desc2']);
    const results = [line('desc2', 'Fire Damage: 80-128'), line('desc3', 'Bonuses:\nEnemy Fire Resist: -20%')];
    expect(headlineTexts(results, ['desc2', 'desc3', 'desc9'])).toEqual(['Fire Damage: 80-128', 'Bonuses: Enemy Fire Resist: -20%']);
  });

  it('gives a grant level except for class-only +levels', () => {
    expect(grantLevel({ how: 'aura', level: 12 })).toBe(12);
    expect(grantLevel({ how: 'oskill', level: [3, 5] })).toBe(5);
    expect(grantLevel({ how: 'hit-skill', level: 150 })).toBe(110);
    expect(grantLevel({ how: 'skill', level: 2 })).toBeNull();
    expect(grantLevel({ how: 'charged', level: 0 })).toBeNull();
  });
});

describe('builds', () => {
  it('adds the +skills from gear to the hard points', () => {
    expect(buildSkillLevel(20, 0)).toBe(20);
    expect(buildSkillLevel(20, 15)).toBe(35);
    expect(buildSkillLevel(99, 50)).toBe(110);
    expect(buildSkillLevel(0, 0)).toBe(1);
    expect(gearForLevel(20, 35)).toBe(15);
    expect(gearForLevel(20, 5)).toBe(0);
  });
});

describe('tableRow', () => {
  it('moves a shared word unit into the label and keeps % in the cells', () => {
    expect(tableRow(row('desc4', ['Radius: 4 yards', 'Radius: 5.3 yards']))).toEqual({ label: 'Radius (yards)', cells: ['4', '5.3'] });
    expect(tableRow(row('desc3', ['Enemy Fire Resist: -10%', 'Enemy Fire Resist: -20%']))).toEqual({
      label: 'Enemy Fire Resist',
      cells: ['-10%', '-20%'],
    });
    expect(tableRow(row('desc6', ['Duration: 1 second', 'Duration: 3 seconds']))).toEqual({
      label: 'Duration',
      cells: ['1 second', '3 seconds'],
    });
  });
});
