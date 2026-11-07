import { describe, expect, it } from 'vitest';
import { comboSegments, comboStatus } from './comboBonuses';

const javelin = {
  condition: 'If both Splintering Javelin and Eagle Eye have 20 levels',
  skills: [
    { name: 'Splintering Javelin', id: 'Splintering Javelin' },
    { name: 'Eagle Eye', id: 'Eagle Eye' },
  ],
  level: 20,
};

describe('comboSegments', () => {
  it('splits the condition around the skill names, in order', () => {
    expect(comboSegments(javelin)).toEqual([
      { text: 'If both ' },
      { text: 'Splintering Javelin', skill: javelin.skills[0] },
      { text: ' and ' },
      { text: 'Eagle Eye', skill: javelin.skills[1] },
      { text: ' have 20 levels' },
    ]);
  });

  it('keeps a group name as a segment and leaves out a name the condition does not hold', () => {
    const group = { name: 'All Elemental Armors' };
    expect(comboSegments({ condition: 'If All Elemental Armors have 20 levels', skills: [group, { name: 'Nova' }] })).toEqual([
      { text: 'If ' },
      { text: 'All Elemental Armors', skill: group },
      { text: ' have 20 levels' },
    ]);
  });
});

describe('comboStatus', () => {
  const points = (map: Record<string, number>) => (id: string) => map[id] ?? 0;

  it('is active when every skill has the level in hard points', () => {
    expect(comboStatus(javelin, points({ 'Splintering Javelin': 20, 'Eagle Eye': 20 }))).toEqual({
      state: 'active',
      skills: [
        { name: 'Splintering Javelin', points: 20 },
        { name: 'Eagle Eye', points: 20 },
      ],
    });
  });

  it('is inactive below the level, with the points per skill', () => {
    expect(comboStatus(javelin, points({ 'Splintering Javelin': 20, 'Eagle Eye': 12 }))).toEqual({
      state: 'inactive',
      skills: [
        { name: 'Splintering Javelin', points: 20 },
        { name: 'Eagle Eye', points: 12 },
      ],
    });
  });

  it('is not checked when a name is not one skill', () => {
    const status = comboStatus({ skills: [{ name: 'Blade Nova', id: 'Blade Nova' }, { name: 'Any Finishing Move' }], level: 20 }, () => 20);
    expect(status.state).toBe('unknown');
    expect(status.skills).toEqual([
      { name: 'Blade Nova', points: 20 },
      { name: 'Any Finishing Move', points: null },
    ]);
  });
});
