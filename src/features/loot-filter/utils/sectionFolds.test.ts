import { describe, expect, it } from 'vitest';
import type { LootFilter } from '../engine/types';
import type { EditorTarget } from '../store/types';
import {
  MAX_OPEN_HEADINGS,
  MAX_REMEMBERED_FILTERS,
  foldsIdOf,
  foldsOf,
  openAfterEdit,
  parseStoredFolds,
  ruleHeadingKeys,
  styleHeadingKeys,
  toggleHeading,
  withFilterFolds,
  withOpened,
} from './sectionFolds';

const folds = (rules: string[], styles: string[] = []) => ({ rules: new Set(rules), styles: new Set(styles) });

describe('foldsIdOf', () => {
  const sandbox = { kind: 'sandbox', revision: null, ownerId: null, name: 'x', baseText: '' } as const;
  it('names a draft by its entry, a saved or shared filter by its id, a template sandbox by its template', () => {
    expect(foldsIdOf({ kind: 'draft', entryId: 'e1' })).toBe('draft:e1');
    const saved: EditorTarget = {
      kind: 'saved',
      savedId: 's1',
      revision: 1,
      ownerId: 'u',
      name: 'x',
      baseText: '',
      baseCanonical: null,
      draftId: 'd1',
      basedOn: null,
    };
    expect(foldsIdOf(saved)).toBe('saved:s1');
    expect(foldsIdOf({ ...sandbox, savedId: 's1', basedOn: null })).toBe('saved:s1');
    expect(foldsIdOf({ ...sandbox, savedId: null, basedOn: { label: 'Example', template: 'example' } })).toBe('template:example');
    expect(foldsIdOf({ ...sandbox, savedId: null, basedOn: null })).toBe('template:sullys-qol');
  });
});

describe('stored folds', () => {
  it('reads back what it writes, the newest filter first', () => {
    const once = parseStoredFolds(withFilterFolds([], 'draft:a', folds(['1:A'], ['2:S'])));
    const twice = parseStoredFolds(withFilterFolds(once, 'saved:b', folds(['1:B'])));
    expect(twice.map((entry) => entry.id)).toEqual(['saved:b', 'draft:a']);
    expect(foldsOf(twice, 'draft:a')).toEqual(folds(['1:A'], ['2:S']));
    // Writing a known filter again moves it to the front.
    expect(parseStoredFolds(withFilterFolds(twice, 'draft:a', folds([]))).map((entry) => entry.id)).toEqual(['draft:a', 'saved:b']);
  });

  it('starts an unknown filter with nothing open', () => {
    expect(foldsOf([], 'draft:x')).toEqual(folds([]));
  });

  it('keeps only the most recent filters and a bounded number of headings', () => {
    let stored = parseStoredFolds(null);
    for (let n = 0; n < MAX_REMEMBERED_FILTERS + 5; n++)
      stored = parseStoredFolds(withFilterFolds(stored, `draft:${String(n)}`, folds(['1:A'])));
    expect(stored).toHaveLength(MAX_REMEMBERED_FILTERS);
    expect(stored[0].id).toBe(`draft:${String(MAX_REMEMBERED_FILTERS + 4)}`);
    expect(foldsOf(stored, 'draft:0')).toEqual(folds([]));
    const many = Array.from({ length: MAX_OPEN_HEADINGS + 10 }, (_, n) => `2:S${String(n)}`);
    expect(parseStoredFolds(withFilterFolds([], 'draft:a', folds(many)))[0].rules).toHaveLength(MAX_OPEN_HEADINGS);
  });

  it('ignores what it cannot use', () => {
    expect(parseStoredFolds('not json')).toEqual([]);
    expect(parseStoredFolds('{"v":2,"filters":[]}')).toEqual([]);
    expect(parseStoredFolds('{"v":1,"filters":{}}')).toEqual([]);
    expect(
      parseStoredFolds(
        JSON.stringify({
          v: 1,
          filters: [null, { id: 3 }, { id: 'draft:a', rules: ['1:A', 7, '', '1:A'], styles: 'x' }, { id: 'draft:a', rules: ['1:B'] }],
        })
      )
    ).toEqual([{ id: 'draft:a', rules: ['1:A'], styles: [] }]);
  });
});

describe('open set changes', () => {
  it('toggles a heading and drops headings the list no longer has', () => {
    const section = { key: '2:S', partKey: '1:A', collapsed: true };
    expect([...toggleHeading(new Set(['1:A', '1:Gone']), section, ['1:A', '2:S'])]).toEqual(['1:A', '2:S']);
    expect([...toggleHeading(new Set(['1:A', '2:S']), { ...section, collapsed: false }, ['1:A', '2:S'])]).toEqual(['1:A']);
    expect([...toggleHeading(new Set(), { key: '1:A', partKey: null, collapsed: true }, ['1:A', '2:S'])]).toEqual(['1:A']);
  });

  it('opens a section shown folded inside a folded part with its part, even when the section itself is open', () => {
    const section = { key: '2:S', partKey: '1:A', collapsed: true };
    expect([...toggleHeading(new Set(['2:S']), section, ['1:A', '2:S'])].sort()).toEqual(['1:A', '2:S']);
  });

  it('opens headings around a selection, unchanged when they are open', () => {
    const open = new Set(['1:A']);
    expect(withOpened(open, ['1:A'])).toBe(open);
    expect([...withOpened(open, ['1:B', '2:S'])]).toEqual(['1:A', '1:B', '2:S']);
  });

  it('carries folds over a section edit and opens a new heading', () => {
    const changes = {
      kept: new Map([
        ['2:Old', '2:New'],
        ['1:P', '1:P'],
        ['2:Shut', '2:Shut'],
      ]),
      added: ['2:Added'],
    };
    expect([...openAfterEdit(new Set(['2:Old', '1:P', '2:Removed']), changes)].sort()).toEqual(['1:P', '2:Added', '2:New']);
  });
});

describe('headings of a rule or a style', () => {
  const filter: LootFilter = {
    formatVersion: 1,
    leadingComments: [],
    rules: [{ commentsBefore: ['// ==== Part'] }, { commentsBefore: ['// ---- Section'] }, {}],
    styles: { Plain: {}, Gold: { commentsBefore: ['// ---- Looks'] } },
  };
  it('lists the part and the section', () => {
    expect(ruleHeadingKeys(filter, 2)).toEqual(['1:Part', '2:Section']);
    expect(ruleHeadingKeys(filter, 0)).toEqual(['1:Part']);
    expect(styleHeadingKeys(filter, 'Gold')).toEqual(['2:Looks']);
    expect(styleHeadingKeys(filter, 'Plain')).toEqual([]);
    expect(styleHeadingKeys(filter, 'Missing')).toEqual([]);
  });
});
