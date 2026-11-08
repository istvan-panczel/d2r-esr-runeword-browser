import { describe, expect, it } from 'vitest';
import { buildCharacterSaveData } from './bundleCharacterSave.ts';
import { parseTsv } from './tsv.ts';

const tsv = (rows: string[][]) => parseTsv(rows.map((row) => row.join('\t')).join('\n'), 'test', { keepExpansionRows: true });

const charstats = tsv([
  ['class'],
  ['Amazon'],
  ['Sorceress'],
  ['Necromancer'],
  ['Paladin'],
  ['Barbarian'],
  ['Druid'],
  ['Assassin'],
  ['Warlock'],
]);

const classRows = (code: string, count: number) => Array.from({ length: count }, (_, i) => [`${code}${String(i)}`, code]);

describe('buildCharacterSaveData', () => {
  it('keeps only the stats with CSvBits, by row number, and the class skill ranges', () => {
    const { bundle, warnings } = buildCharacterSaveData({
      itemstatcost: tsv([
        ['Stat', 'CSvBits', 'ValShift'],
        ['strength', '24', ''],
        ['not_in_gf', '', '8'],
        ['hitpoints', '32', '8'],
      ]),
      skills: tsv([
        ['skill', 'charclass'],
        ['Attack', ''],
        ...['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass', 'war'].flatMap((code) => classRows(code, 3)),
      ]),
      charstats,
    });
    expect(warnings).toEqual([]);
    expect(bundle.characterStats).toEqual([
      [0, 24, 0],
      [2, 32, 8],
    ]);
    expect(bundle.characterClasses[0]).toEqual(['Amazon', 1, 3]);
    expect(bundle.characterClasses[7]).toEqual(['Warlock', 22, 3]);
  });

  it('warns about a class whose skills are not contiguous, or a class missing from charstats', () => {
    const { warnings } = buildCharacterSaveData({
      itemstatcost: tsv([
        ['Stat', 'CSvBits', 'ValShift'],
        ['strength', '24', ''],
      ]),
      skills: tsv([
        ['skill', 'charclass'],
        ['a', 'ama'],
        ['x', ''],
        ['b', 'ama'],
      ]),
      charstats: tsv([['class'], ['Amazon']]),
    });
    expect(warnings.some((warning) => warning.includes('class ama are not contiguous'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('row 1'))).toBe(true);
  });
});
