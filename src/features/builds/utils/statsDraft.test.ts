import { describe, expect, it } from 'vitest';
import type { BuildStats } from '../buildStats';
import {
  emptyStatsDraft,
  fromStatsDraft,
  invalidStatKeys,
  parseNumberText,
  parseStatText,
  statedCount,
  statRangeHint,
  statsDraftValid,
  toStatsDraft,
} from './statsDraft';

const STATS: BuildStats = {
  source: 'save',
  edited: true,
  difficulty: 1,
  buffed: true,
  character: 'Soso',
  savedAt: 1_794_387_009,
  esrVersion: '3.3.03',
  values: { str: 30, fr: -20, sk: 1 },
};

describe('stats drafts', () => {
  it('round-trips a stored block through the draft', () => {
    const draft = toStatsDraft(STATS);
    expect(draft?.values).toEqual({ str: '30', fr: '-20', sk: '1' });
    expect(fromStatsDraft(draft)).toEqual(STATS);
    expect(toStatsDraft(undefined)).toBeNull();
    expect(fromStatsDraft(null)).toBeUndefined();
  });

  it('parses blank as not stated and rejects fractions, words and out-of-range numbers', () => {
    expect(parseStatText('str', '')).toBeUndefined();
    expect(parseStatText('str', '   ')).toBeUndefined();
    expect(parseStatText('str', undefined)).toBeUndefined();
    expect(parseStatText('str', ' 42 ')).toBe(42);
    expect(parseStatText('fr', '-1000')).toBe(-1000);
    expect(parseStatText('fr', '-1001')).toBeNull();
    expect(parseStatText('str', '1.5')).toBeNull();
    expect(parseStatText('str', 'abc')).toBeNull();
    expect(parseStatText('str', '1e3')).toBeNull();
    expect(parseStatText('dod', '101')).toBeNull();
  });

  it('reads pasted numbers with thousands separators and a typographic minus, nothing else', () => {
    expect(parseNumberText('73,276')).toBe(73276);
    expect(parseNumberText('1 234')).toBe(1234);
    expect(parseNumberText("1'234")).toBe(1234);
    expect(parseNumberText('1\u00a0234\u202f567')).toBe(1234567);
    expect(parseNumberText('\u2212150')).toBe(-150);
    expect(parseNumberText('+10')).toBe(10);
    expect(parseNumberText('1.234')).toBeNull();
    expect(parseNumberText('12%')).toBeNull();
    expect(parseNumberText('')).toBeNull();
    expect(parseStatText('def', '73,276')).toBe(73276);
    expect(parseStatText('fr', '−20')).toBe(-20);
    expect(parseStatText('dod', '101')).toBeNull();
  });

  it('reports invalid keys, counts stated ones and drops nothing-stated blocks', () => {
    const draft = { ...emptyStatsDraft(), values: { str: '10', dex: 'x', vit: '', fr: '200' } };
    expect(invalidStatKeys(draft)).toEqual(['dex', 'fr']);
    expect(statsDraftValid(draft)).toBe(false);
    expect(statsDraftValid(null)).toBe(true);
    expect(statedCount(draft)).toBe(3);
    // Invalid numbers are never stored (the form refuses to save first)
    expect(fromStatsDraft(draft)).toEqual({ source: 'manual', difficulty: 2, values: { str: 10 } });
    expect(fromStatsDraft(emptyStatsDraft())).toBeUndefined();
  });

  it('leaves the character name out when the author turns it off, keeping everything else', () => {
    const draft = toStatsDraft({ ...STATS, arSkill: 'Frenzy' });
    if (draft === null) throw new Error('draft');
    expect(fromStatsDraft(draft)).toEqual({ ...STATS, arSkill: 'Frenzy' });
    const stored = fromStatsDraft({ ...draft, showCharacter: false });
    expect(stored?.character).toBeUndefined();
    expect(stored).toEqual({ ...STATS, character: undefined, arSkill: 'Frenzy' });
    expect(stored === undefined ? [] : Object.keys(stored)).not.toContain('character');
  });

  it('keeps provenance off hand-made blocks', () => {
    const draft = { ...emptyStatsDraft(), edited: true, character: 'Soso', savedAt: 1, values: { mf: '100' } };
    expect(fromStatsDraft(draft)).toEqual({ source: 'manual', difficulty: 2, values: { mf: 100 } });
  });

  it('describes the accepted range', () => {
    expect(statRangeHint('fr')).toBe('-1,000 to 100, whole numbers');
  });
});
