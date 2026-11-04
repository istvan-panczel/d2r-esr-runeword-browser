import { describe, expect, it } from 'vitest';
import { BUNDLE_SPECS, bundleCheck, diffBundle, diffSection, fallbackSpec } from './bundles.ts';

describe('bundle entry diff', () => {
  it('compares list sections by key and labels the entries', () => {
    const spec = BUNDLE_SPECS['runewords.json']?.runewords;
    if (spec === undefined) throw new Error('no spec');
    const before = [
      { key: 'Runeword1', name: 'Ancient' },
      { key: 'Runeword2', name: 'Beast', rows: [1] },
      { key: 'Runeword3', name: 'Gone' },
    ];
    const after = [
      { key: 'Runeword2', name: 'Beast', rows: [2] },
      { key: 'Runeword1', name: 'Ancient' },
      { key: 'Runeword4', name: 'New' },
    ];
    expect(diffSection('runewords', before, after, spec)).toEqual({
      section: 'runewords',
      added: ['Runeword4 (New)'],
      removed: ['Runeword3 (Gone)'],
      changed: ['Runeword2 (Beast) [rows]'],
      before: 3,
      after: 3,
    });
  });

  it('pairs repeated keys by position', () => {
    const spec = fallbackSpec([{ name: 'a' }]);
    const diff = diffSection(
      's',
      [
        { name: 'a', v: 1 },
        { name: 'a', v: 2 },
      ],
      [{ name: 'a', v: 1 }],
      spec
    );
    expect(diff.removed).toEqual(['a #2']);
    expect(diff.changed).toEqual([]);
  });

  it('compares scalar arrays as multisets, maps by property and values whole', () => {
    expect(diffSection('names', ['a', 'b', 'b'], ['b', 'c'], { kind: 'values' })).toMatchObject({
      added: ['"c"'],
      removed: ['"a"', '"b"'],
    });
    expect(diffSection('codes', { hax: 'normal', axe: 'normal' }, { hax: 'elite', new: 'normal' }, { kind: 'map' })).toMatchObject({
      added: ['new'],
      removed: ['axe'],
      changed: ['hax'],
    });
    expect(diffSection('maxLevel', 110, 120, { kind: 'value' }).changed).toEqual(['maxLevel: 110 → 120']);
  });

  it('reads stash item rows (arrays) by their code', () => {
    const spec = BUNDLE_SPECS['stash.json']?.items;
    if (spec === undefined) throw new Error('no spec');
    expect(
      diffSection(
        'items',
        [['hax', 2, 1, 3]],
        [
          ['hax', 2, 1, 4],
          ['new', 0, 1, 1],
        ],
        spec
      )
    ).toMatchObject({ added: ['new'], changed: ['hax'] });
  });

  it('reports sections the spec does not know', () => {
    const diff = diffBundle('tiers.json', { codes: { a: 'normal' } }, { codes: { a: 'normal' }, extra: [{ id: 1 }] });
    expect(diff.unknownSections).toEqual(['extra']);
    expect(diff.sections.find((section) => section.section === 'extra')?.added).toEqual(['1']);
  });

  it('makes one check per bundle, ok when nothing changed, info capped otherwise', () => {
    expect(bundleCheck(diffBundle('tiers.json', { codes: { a: 'x' } }, { codes: { a: 'x' } })).status).toBe('ok');
    const many = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`c${String(i)}`, 'normal']));
    const check = bundleCheck(diffBundle('tiers.json', { codes: {} }, { codes: many }), 40);
    expect(check).toMatchObject({ id: 'bundle.tiers', status: 'info' });
    expect(check.details[0]).toBe('codes (0 → 50): +50 -0 ~0');
    expect(check.details.at(-1)).toBe('… +10 more');
  });
});
