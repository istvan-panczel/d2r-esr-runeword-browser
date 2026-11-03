import { describe, expect, it } from 'vitest';
import { makeItem, makeSection, makeStash } from '../testing/stashMocks.mock';
import { walkStashItems } from './walk';

const rune = makeItem('r01', { compact: true, quality: null });
const jewel = makeItem('jew', { quality: 'magic' });
const STASH = makeStash([
  makeSection(0, [makeItem('cap', { x: 2, y: 3, socketed: [jewel, rune] }), makeItem('rin', { x: 0, y: 0 })]),
  makeSection(4, [makeItem('amu', { x: 5, y: 5 })]),
  makeSection(1000, [makeItem('r02', { compact: true, stackSize: 9 })], 'advanced'),
]);

describe('walkStashItems', () => {
  it('walks the pages only by default, without socketed items', () => {
    expect(walkStashItems(STASH).map(({ item }) => item.code)).toEqual(['cap', 'rin', 'amu']);
  });

  it('adds the materials tab with tabs: all', () => {
    const walked = walkStashItems(STASH, { tabs: 'all' });
    expect(walked.map(({ item }) => item.code)).toEqual(['cap', 'rin', 'amu', 'r02']);
    expect(walked.at(-1)?.location).toEqual({ section: 1000, tabType: 'advanced', x: 0, y: 0 });
  });

  it('yields socketed items after their parent, at the parent location', () => {
    const walked = walkStashItems(STASH, { socketed: true });
    expect(walked.map(({ item, socket }) => [item.code, socket])).toEqual([
      ['cap', null],
      ['jew', 0],
      ['r01', 1],
      ['rin', null],
      ['amu', null],
    ]);
    const child = walked[1];
    expect(child?.parent?.code).toBe('cap');
    expect(child?.location).toEqual({ section: 0, tabType: 'normal', x: 2, y: 3 });
  });
});
