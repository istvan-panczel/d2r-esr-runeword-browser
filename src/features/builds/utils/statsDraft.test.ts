import { describe, expect, it } from 'vitest';
import type { BuildStats } from '../buildStats';
import {
  emptyStatsDraft,
  fromStatsDraft,
  invalidStatKeys,
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
    expect(parseStatText('str', '1e3')).toBe(1000);
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

  it('keeps provenance off hand-made blocks', () => {
    const draft = { ...emptyStatsDraft(), edited: true, character: 'Soso', savedAt: 1, values: { mf: '100' } };
    expect(fromStatsDraft(draft)).toEqual({ source: 'manual', difficulty: 2, values: { mf: 100 } });
  });

  it('describes the accepted range', () => {
    expect(statRangeHint('fr')).toBe('-1,000 to 100, whole numbers');
  });
});
