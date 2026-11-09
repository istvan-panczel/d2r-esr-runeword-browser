import { describe, expect, it } from 'vitest';
import type { GuideBundle, GuideNote } from '../../../src/features/guide/engine/schema.ts';
import { dataBlocks, dataBlocksCheck, patchNoteMentionsCheck, recipesBlocks, recipesCheck } from './guideChecks.ts';

type NoteInput = Pick<GuideNote, 'slug' | 'title'> & { body: unknown };

const recipes = (family: string, rows: number, caption = 'Rune upgrades') => ({
  type: 'data',
  block: {
    kind: 'recipes',
    caption,
    rows: Array.from({ length: rows }, (_, i) => ({ inputs: [`r${String(i)}`], output: 'x', note: null })),
    link: { label: 'All', href: `/cube-recipes?family=${family}` },
  },
});
const guide = (...notes: NoteInput[]) => ({ notes, glossary: [] }) as unknown as GuideBundle;
const note = (slug: string, ...blocks: unknown[]): NoteInput => ({ slug, title: slug, body: [{ type: 'paragraph', children: blocks }] });

describe('guide checks', () => {
  it('finds data blocks anywhere in a body', () => {
    expect(dataBlocks([{ type: 'list', children: [{ type: 'item', children: [recipes('socket', 1)] }] }])).toHaveLength(1);
  });

  it('reads the family and its cap from the cube link', () => {
    const [block] = recipesBlocks(guide(note('rune-families', recipes('rune-conversion', 12, 'Rune upgrades (… and 225 more)'))));
    expect(block).toMatchObject({ key: 'rune-families | rune-conversion', caption: 'Rune upgrades', rows: 12, cap: 12 });
    expect(recipesBlocks(guide(note('secret', recipes('secret', 89))))[0].cap).toBe(Number.POSITIVE_INFINITY);
  });

  it('flags a block that newly reaches its cap', () => {
    const before = guide(note('socketing', recipes('socket', 10)));
    expect(recipesCheck(before, before).status).toBe('ok');
    expect(recipesCheck(before, guide(note('socketing', recipes('socket', 11)))).status).toBe('info');
    const capped = recipesCheck(before, guide(note('socketing', recipes('socket', 12))));
    expect(capped.status).toBe('finding');
    expect(capped.details[0]).toBe('socketing | socket: 12 rows (cap 12)');
  });

  it('lists notes whose data blocks changed', () => {
    const before = guide(note('a', recipes('socket', 1)), note('b', recipes('unsocket', 1)));
    const after = guide(note('a', recipes('socket', 2)), note('b', recipes('unsocket', 1)));
    expect(dataBlocksCheck(before, before).status).toBe('ok');
    expect(dataBlocksCheck(before, after)).toMatchObject({ status: 'finding', details: ['a: Rune upgrades'] });
  });

  it('matches note titles and owned glossary terms against the patch notes', () => {
    const bundle = {
      notes: [note('kill-ledger'), { ...note('vessel'), title: 'Vessel of Souls' }],
      glossary: [{ term: 'Kill Ledger', definition: '', note: 'kill-ledger' }],
    } as unknown as GuideBundle;
    expect(patchNoteMentionsCheck(bundle, []).status).toBe('ok');
    const check = patchNoteMentionsCheck(bundle, [{ version: '3.2.25', text: 'The kill ledger now counts bosses.' }]);
    expect(check).toMatchObject({ status: 'info', details: ["kill-ledger: 'Kill Ledger' (3.2.25)"] });
  });
});
