import { describe, expect, it } from 'vitest';
import type { ModifierFact } from '../../game-data/engine/schema.ts';
import { factNumber, formatFactNumber, resolveGlossaryEntries } from './glossaryEntries.ts';
import { fixtureContext } from './testContext.mock.ts';

const fact = (value: ModifierFact['value']): ModifierFact => ({
  key: 'k',
  label: 'K',
  value,
  origin: 'game-files',
  source: { file: 'f', key: 'c' },
});

describe('factNumber', () => {
  it('reads a number, a difficulty of a per-difficulty fact and a field of a record', () => {
    expect(factNumber(fact(500), null)).toBe(500);
    expect(factNumber(fact([1, 25, 150]), 'hell')).toBe(150);
    expect(factNumber(fact({ unique: 6.25 }), 'unique')).toBe(6.25);
  });

  it('rejects a missing or wrong field and non-numbers', () => {
    expect(factNumber(fact(500), 'hell')).toHaveProperty('error');
    expect(factNumber(fact([1, 25, 150]), null)).toEqual({ error: 'fact "k" is per difficulty; add :normal, :nightmare or :hell' });
    expect(factNumber(fact({ unique: 6.25, set: 1 }), 'rare')).toEqual({ error: 'fact "k" needs one of :unique, :set' });
    expect(factNumber(fact(true), null)).toEqual({ error: 'fact "k" is not a number' });
  });

  it('prints negative values with a typographic minus', () => {
    expect(formatFactNumber(-80)).toBe('−80');
    expect(formatFactNumber(12.5)).toBe('12.5');
  });
});

describe('resolveGlossaryEntries', () => {
  const ctx = fixtureContext();

  it('fills {fact:…} values and resolves the link to an app href', () => {
    const errors: string[] = [];
    const entries = resolveGlossaryEntries(
      [
        {
          term: 'Resistance penalty',
          definition: 'Hell subtracts {fact:difficulty.ResistPenalty:hell}; crushing blow {fact:crushingBlow.share:unique}%.',
          note: null,
          link: 'page:/modifiers?kind=deadly-strike',
        },
        { term: 'Plain', definition: 'No {braces} here.', note: 'x' },
      ],
      ctx,
      '_glossary.yml',
      errors
    );
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      {
        term: 'Resistance penalty',
        definition: 'Hell subtracts −150; crushing blow 6.25%.',
        note: null,
        link: '/modifiers?kind=deadly-strike',
      },
      { term: 'Plain', definition: 'No {braces} here.', note: 'x' },
    ]);
  });

  it('reports unknown facts, unknown modifier kinds and links that are not app pages', () => {
    const errors: string[] = [];
    const entries = resolveGlossaryEntries(
      [
        { term: 'A', definition: '{fact:nope}', note: null, link: 'page:/modifiers?kind=nope' },
        { term: 'B', definition: 'b', note: null, link: 'https://example.com' },
      ],
      ctx,
      '_glossary.yml',
      errors
    );
    expect(entries).toEqual([
      { term: 'A', definition: '{fact:nope}', note: null },
      { term: 'B', definition: 'b', note: null },
    ]);
    expect(errors).toEqual([
      '_glossary.yml: "A": {fact:nope}: unknown fact "nope" (a fact key of public/game-data/modifiers.json)',
      '_glossary.yml: "A": link: page: link "/modifiers?kind=nope": unknown modifier kind "nope" (a kind key of public/game-data/modifiers.json)',
      '_glossary.yml: "B": link: "https://example.com" must point at an app page (page:/modifiers?kind=…)',
    ]);
  });
});
