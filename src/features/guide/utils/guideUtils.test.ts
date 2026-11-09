import { describe, expect, it } from 'vitest';
import type { GuideBlock, GuideInline, GuideNote } from '../engine/schema';
import { makeNote } from '../engine/testNote.mock';
import { collectAppLinks, inlineText, searchNotes, sourceCells } from './guideUtils';

const text = (value: string): GuideInline => ({ type: 'text', value });
const appLink = (href: string, label: string): GuideInline => ({ type: 'link', kind: 'app', href, children: [text(label)] });

function note(slug: string, title: string, summary = '', aliases: string[] = []): GuideNote {
  return makeNote({ slug, title, summary, aliases });
}

describe('inlineText', () => {
  it('flattens nested inline nodes', () => {
    expect(
      inlineText([
        text('a '),
        { type: 'strong', children: [{ type: 'term', term: 'X', children: [text('b')] }] },
        { type: 'break' },
        { type: 'code', value: 'c' },
      ])
    ).toBe('a b c');
  });
});

describe('collectAppLinks', () => {
  it('collects app links from every block kind in order, deduplicated by href, capped', () => {
    const body: GuideBlock[] = [
      {
        type: 'paragraph',
        children: [appLink('/runewords?name=Enigma', 'Enigma'), { type: 'link', kind: 'note', href: 'forging', children: [text('n')] }],
      },
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'paragraph', children: [{ type: 'emphasis', children: [appLink('/uniques', 'Uniques')] }] }]],
      },
      { type: 'blockquote', children: [{ type: 'paragraph', children: [appLink('/runewords?name=Enigma', 'again')] }] },
      { type: 'table', header: [[text('h')]], rows: [[[appLink('/bases', 'Bases')]]] },
      { type: 'heading', depth: 3, children: [appLink('/gemwords', 'Gemwords')] },
      {
        type: 'paragraph',
        children: [appLink('/socketables', 'Socketables'), { type: 'link', kind: 'external', href: 'https://x', children: [] }],
      },
    ];
    expect(collectAppLinks(body)).toEqual([
      { href: '/runewords?name=Enigma', label: 'Enigma' },
      { href: '/uniques', label: 'Uniques' },
      { href: '/bases', label: 'Bases' },
      { href: '/gemwords', label: 'Gemwords' },
    ]);
    expect(collectAppLinks(body, 10)).toHaveLength(5);
  });

  it('returns nothing for a body without app links', () => {
    expect(
      collectAppLinks([
        { type: 'paragraph', children: [text('plain')] },
        { type: 'codeBlock', value: '/x' },
      ])
    ).toEqual([]);
  });
});

describe('searchNotes', () => {
  const notes = [
    note('forging', 'Forging', 'Add one removable bonus to an item.', ['forge']),
    note('cube-basics', 'Cube basics', 'How the Horadric Cube works; forging needs it.'),
    note('stockers', 'Stockers', 'Containers that hold materials.', ['stocker box']),
  ];
  const slugs = (query: string) => searchNotes(notes, query).map((n) => n.slug);

  it('returns every note for an empty query', () => {
    expect(slugs('  ')).toEqual(['forging', 'cube-basics', 'stockers']);
  });

  it('matches title, aliases and summary case-insensitively, title hits first', () => {
    expect(slugs('FORGING')).toEqual(['forging', 'cube-basics']);
    expect(slugs('box')).toEqual(['stockers']);
    expect(slugs('materials')).toEqual(['stockers']);
  });

  it('requires all words to match and supports quoted phrases', () => {
    expect(slugs('cube horadric')).toEqual(['cube-basics']);
    expect(slugs('cube stockers')).toEqual([]);
    expect(slugs('"removable bonus"')).toEqual(['forging']);
    expect(slugs('"bonus removable"')).toEqual([]);
  });
});

describe('sourceCells', () => {
  it('always returns the four cells in order', () => {
    expect(sourceCells([]).map((c) => [c.key, c.title, c.labels])).toEqual([
      ['drop', 'Drop', []],
      ['cube', 'Cube', []],
      ['buy', 'Buy', []],
      ['gamble', 'Gamble', []],
    ]);
  });

  it('groups drop, boss, maps and plugin as Drop and ignores unknown', () => {
    const cells = sourceCells([
      { kind: 'cube', text: 'Cube: Ancient Coupon' },
      { kind: 'boss', text: 'Drops from Diablo Clone' },
      { kind: 'maps', text: 'Drops in Endgame Maps' },
      { kind: 'drop', text: 'Drops (random)' },
      { kind: 'plugin', text: 'Boss drop (launcher plugin)' },
      { kind: 'buy', text: 'Buy: Gheed' },
      { kind: 'buy', text: 'Buy: Gheed' },
      { kind: 'gamble', text: 'Gamble' },
      { kind: 'unknown', text: '?' },
    ]);
    expect(Object.fromEntries(cells.map((c) => [c.key, c.labels]))).toEqual({
      drop: ['Drops from Diablo Clone', 'Drops in Endgame Maps', 'Drops (random)', 'Boss drop (launcher plugin)'],
      cube: ['Cube: Ancient Coupon'],
      buy: ['Buy: Gheed'],
      gamble: ['Gamble'],
    });
  });
});
