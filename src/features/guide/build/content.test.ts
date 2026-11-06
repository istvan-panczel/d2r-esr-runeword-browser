import { describe, expect, it } from 'vitest';
import { parseGlossary, parseSourceRefs, parseSpine } from './content.ts';

describe('parseSpine', () => {
  it('reads steps and questions', () => {
    const errors: string[] = [];
    const spine = parseSpine(
      'steps:\n  - title: A\n    summary: S\n    notes: [a, b]\nquestions:\n  - label: Q\n    note: a\n',
      'spine.yml',
      errors
    );
    expect(spine).toEqual({ steps: [{ title: 'A', summary: 'S', notes: ['a', 'b'] }], questions: [{ label: 'Q', note: 'a' }] });
    expect(errors).toEqual([]);
  });

  it('reports unknown keys and malformed entries', () => {
    const errors: string[] = [];
    parseSpine('steps:\n  - oops\nquestions: []\nextra: 1\n', 'spine.yml', errors);
    expect(errors).toEqual([
      'spine.yml: extra: unknown field (allowed: steps, questions)',
      'spine.yml: steps[0]: must be a mapping with title, summary and notes',
    ]);
  });
});

describe('parseGlossary', () => {
  it('reports duplicate terms case-insensitively', () => {
    const errors: string[] = [];
    const entries = parseGlossary('- term: Stocker\n  definition: A\n- term: stocker\n  definition: B\n', '_glossary.yml', errors);
    expect(entries.map((entry) => entry.term)).toEqual(['Stocker', 'stocker']);
    expect(errors).toEqual(['_glossary.yml: duplicate term "stocker"']);
  });

  it('keeps the link target as written and leaves it out when absent', () => {
    const errors: string[] = [];
    const entries = parseGlossary(
      '- term: Leech\n  definition: A\n  link: page:/modifiers?kind=life-leech\n- term: Stocker\n  definition: B\n',
      '_glossary.yml',
      errors
    );
    expect(entries).toEqual([
      { term: 'Leech', definition: 'A', note: null, link: 'page:/modifiers?kind=life-leech' },
      { term: 'Stocker', definition: 'B', note: null },
    ]);
    expect(errors).toEqual([]);
  });

  it('treats an empty file as no entries and rejects a mapping', () => {
    const errors: string[] = [];
    expect(parseGlossary('', '_glossary.yml', errors)).toEqual([]);
    expect(parseGlossary('term: A\n', '_glossary.yml', errors)).toEqual([]);
    expect(errors).toEqual(['_glossary.yml: expected a list']);
  });
});

describe('parseSourceRefs', () => {
  it('reports duplicate ids and non-http URLs', () => {
    const errors: string[] = [];
    const refs = parseSourceRefs('- id: a\n  title: A\n  url: ftp://x\n- id: a\n  title: B\n', '_sources.yml', errors);
    expect(refs.map((ref) => ref.title)).toEqual(['A', 'B']);
    expect(errors).toEqual(['_sources.yml: [0]: url: must be an http(s) URL (got "ftp://x")', '_sources.yml: duplicate id "a"']);
  });
});
