import { describe, expect, it } from 'vitest';
import { STAT_KEYS } from '../buildStats';
import {
  formatSavedDate,
  formatStatValue,
  STAT_GROUPS,
  statedGroups,
  statGroupTitle,
  statLabel,
  statsNote,
  statsProvenance,
} from './statLabels';

describe('stat labels', () => {
  it('labels every stored key exactly once, in stored order', () => {
    const labelled = STAT_GROUPS.flatMap((group) => group.stats.map((stat) => stat.key));
    expect(labelled).toEqual(STAT_KEYS);
    expect(new Set(STAT_GROUPS.map((group) => group.id)).size).toBe(STAT_GROUPS.length);
    expect(STAT_GROUPS.map((group) => group.title)).toEqual([
      'Attributes',
      'Life and mana',
      'Resistances',
      'Defense and mitigation',
      'Speeds',
      'Offence',
      'Find',
      'Skills',
    ]);
  });

  it('formats values with grouping, units and the + of bonuses', () => {
    expect(formatStatValue('def', 73276)).toBe('73,276');
    expect(formatStatValue('fr', 75)).toBe('75%');
    expect(formatStatValue('fr', -30)).toBe('-30%');
    expect(formatStatValue('sk', 10)).toBe('+10');
    expect(formatStatValue('sk', 0)).toBe('0');
    expect(formatStatValue('sk', -1)).toBe('-1');
    expect(statLabel('ias').label).toBe('Increased attack speed');
  });

  it('names the difficulty in the resistances heading only', () => {
    const [attributes, , resists] = STAT_GROUPS;
    expect(statGroupTitle(resists, 2)).toBe('Resistances (Hell)');
    expect(statGroupTitle(resists, 1)).toBe('Resistances (Nightmare)');
    expect(statGroupTitle(resists, 0)).toBe('Resistances (Normal)');
    expect(statGroupTitle(attributes, 2)).toBe('Attributes');
  });

  it('statedGroups keeps only stated values and groups that have any; a 0 bonus says nothing, a 0 resist does', () => {
    const groups = statedGroups({ sk: 10, str: 5, fr: 75, mf: 0, avo: 0, cr: 0, life: 0 });
    expect(groups.map(({ group }) => group.id)).toEqual(['attributes', 'pools', 'resists', 'skills']);
    expect(groups[2].stats.map(({ stat, text }) => [stat.key, text])).toEqual([
      ['fr', '75%'],
      ['cr', '0%'],
    ]);
    expect(statedGroups({})).toEqual([]);
  });

  it('folds a max resist into its resist row, and shows it alone only without the resist', () => {
    const [resists] = statedGroups({ fr: 79, frm: 79, cr: 75, lrm: 80, mr: 38, mrm: 82 }).map(({ stats }) => stats);
    expect(resists.map(({ stat, text }) => [stat.label, text])).toEqual([
      ['Fire', '79% · max 79'],
      ['Cold', '75%'],
      ['Magic', '38% · max 82'],
      ['Max lightning', '80%'],
    ]);
  });

  it('writes the note under the stats from the flags (never "without buffs" on a buffed block)', () => {
    expect(statsNote({ source: 'save' })).toContain('without buffs');
    expect(statsNote({ source: 'save', buffed: true })).not.toContain('without buffs');
    expect(statsNote({ source: 'save', buffed: true })).toContain('include buffs');
    expect(statsNote({ source: 'save', edited: true })).toContain('then changed by the author');
    expect(statsNote({ source: 'manual', buffed: true })).toBe(
      'The author’s numbers, entered by hand. The author says they include buffs.'
    );
  });

  it('writes the provenance line', () => {
    const save = { source: 'save', character: 'SpinToWin', savedAt: 1_794_387_009, esrVersion: '3.3.03' } as const;
    expect(formatSavedDate(1_794_387_009)).toBe('11 Nov 2026');
    expect(statsProvenance(save)).toBe("From SpinToWin's save of 11 Nov 2026, ESR 3.3.03, unbuffed");
    expect(statsProvenance({ ...save, edited: true })).toBe(
      "From SpinToWin's save of 11 Nov 2026, ESR 3.3.03, unbuffed, edited by the author"
    );
    expect(statsProvenance({ source: 'save' })).toBe('From a save, unbuffed');
    expect(statsProvenance({ source: 'save', buffed: true })).toBe('From a save, buffed');
    expect(statsProvenance({ source: 'manual' })).toBe('Entered by hand');
    expect(statsProvenance({ source: 'manual', buffed: true })).toBe('Entered by hand, buffed');
  });
});
