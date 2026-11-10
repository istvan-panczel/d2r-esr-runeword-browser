import { describe, expect, it } from 'vitest';
import {
  addToSection,
  applySectionEdit,
  buildSectionRows,
  commentLinesText,
  enclosingHeadingKeys,
  headingKeyChanges,
  headingKeys,
  noteLines,
  readCommentLine,
  renameHeadingLine,
  type CommentAccess,
  type SectionEditResult,
  type SectionList,
} from './sections';

interface Item {
  readonly name: string;
  readonly commentsBefore?: readonly string[];
}
const access: CommentAccess<Item> = {
  get: (item) => item.commentsBefore,
  set: (item, comments) => (comments.length === 0 ? { name: item.name } : { ...item, commentsBefore: comments }),
};
const item = (name: string, ...commentsBefore: string[]): Item => (commentsBefore.length > 0 ? { name, commentsBefore } : { name });
/** The list as one stream: comment lines as they are, items as `[name]`. */
const stream = (list: SectionList<Item> | undefined) =>
  list === undefined ? undefined : [...list.items.flatMap((entry) => [...(entry.commentsBefore ?? []), `[${entry.name}]`]), ...list.end];

const entry = (index: number, ...comments: string[]) => ({ index, comments });
type Entry = ReturnType<typeof entry>;
const commentsOf = (value: Entry) => value.comments;
const shape = (rows: ReturnType<typeof buildSectionRows<Entry>>) =>
  rows.map((row) =>
    row.kind === 'item' ? row.entry.index : row.kind === 'heading' ? `${row.title} (${String(row.itemCount)})` : `note: ${row.text}`
  );

describe('readCommentLine', () => {
  it('reads parts, sections, notes and separators', () => {
    expect(readCommentLine('// ==== PART 1')).toEqual({ kind: 'heading', level: 1, title: 'PART 1' });
    expect(readCommentLine('// ---- 1.1 Gold ---------')).toEqual({ kind: 'heading', level: 2, title: '1.1 Gold' });
    expect(readCommentLine('// ---- Styles ---')).toEqual({ kind: 'heading', level: 2, title: 'Styles' });
    expect(readCommentLine('//---- Tight')).toEqual({ kind: 'heading', level: 2, title: 'Tight' });
    expect(readCommentLine('// ===========')).toEqual({ kind: 'separator' });
    expect(readCommentLine('// --- three dashes is a note')).toEqual({ kind: 'note', text: '--- three dashes is a note' });
    expect(readCommentLine('// plain')).toEqual({ kind: 'note', text: 'plain' });
  });
});

describe('writing lines', () => {
  it('keeps the file’s markers and decoration on a rename at the same level', () => {
    expect(renameHeadingLine('// ---- Styles ----------', 2, 'Looks')).toBe('// ---- Looks ----------');
    expect(renameHeadingLine('//==== A', 1, 'B')).toBe('//==== B');
    expect(renameHeadingLine('// ---- Styles ----------', 1, 'Looks')).toBe('// ==== Looks');
  });

  it('writes notes line by line and never as a heading', () => {
    expect(noteLines('\nfirst\n\nsecond  \n\n')).toEqual(['// first', '//', '// second']);
    expect(noteLines('---- not a heading')).toEqual(['// Note: ---- not a heading']);
    expect(readCommentLine(noteLines('---- x')[0]).kind).toBe('note');
    expect(readCommentLine(noteLines('==========')[0]).kind).toBe('note');
  });
});

describe('buildSectionRows', () => {
  const entries = [
    entry(0, '// ==== A', '// about A'),
    entry(1, '// ---- A.1'),
    entry(2),
    entry(3, '// loose', '// two'),
    entry(4, '// ==== B'),
    entry(5),
  ];

  it('counts each heading up to the next of the same or a higher level and joins note lines', () => {
    expect(shape(buildSectionRows(entries, commentsOf, []))).toEqual(['A (4)', 0, 'A.1 (3)', 1, 2, 'note: loose\ntwo', 3, 'B (2)', 4, 5]);
  });

  it('keeps the description under its heading, with addresses', () => {
    const [first, , second] = buildSectionRows(entries, commentsOf, []);
    expect(first).toMatchObject({ kind: 'heading', notes: ['about A'], address: { at: 0, line: 0 } });
    expect(second).toMatchObject({ kind: 'heading', address: { at: 1, line: 0 }, canMoveUp: false, canMoveDown: false });
  });

  it('knows which sections can move', () => {
    const rows = buildSectionRows(
      [entry(0, '// ---- X'), entry(1, '// ---- Y'), entry(2, '// ==== P'), entry(3, '// ---- Z')],
      commentsOf,
      []
    );
    expect(rows.filter((row) => row.kind === 'heading').map((row) => [row.title, row.canMoveUp, row.canMoveDown])).toEqual([
      ['X', false, true],
      ['Y', true, false],
      ['P', false, false],
      ['Z', false, false],
    ]);
  });

  it('folds nested sections with a part and stops at the next part', () => {
    expect(shape(buildSectionRows(entries, commentsOf, [], { open: new Set(['2:A.1', '1:B']) }))).toEqual(['A (4)', 'B (2)', 4, 5]);
    expect(shape(buildSectionRows(entries, commentsOf, [], { open: new Set(['1:A', '1:B']) }))).toEqual([
      'A (4)',
      0,
      'A.1 (3)',
      'B (2)',
      4,
      5,
    ]);
  });

  it('folds every heading not in the open set: fully folded shows the parts only', () => {
    expect(shape(buildSectionRows(entries, commentsOf, [], { open: new Set() }))).toEqual(['A (4)', 'B (2)']);
    expect(shape(buildSectionRows(entries, commentsOf, [], { open: new Set(['1:A']) }))).toEqual(['A (4)', 0, 'A.1 (3)', 'B (2)']);
    const rows = buildSectionRows(entries, commentsOf, [], { open: new Set(['1:A', 'unknown']) });
    expect(rows.filter((row) => row.kind === 'heading').map((row) => [row.key, row.collapsed])).toEqual([
      ['1:A', false],
      ['2:A.1', true],
      ['1:B', true],
    ]);
  });

  it('keeps items outside any heading and folds sections outside any part', () => {
    const loose = [entry(0), entry(1, '// ---- X'), entry(2, '// ==== P'), entry(3, '// ---- Y'), entry(4)];
    expect(shape(buildSectionRows(loose, commentsOf, [], { open: new Set() }))).toEqual([0, 'X (1)', 'P (3)']);
  });

  it('still lists the kept item of a folded section, under its own headings', () => {
    expect(shape(buildSectionRows(entries, commentsOf, [], { open: new Set(['1:B']), keep: 2 }))).toEqual([
      'A (4)',
      'A.1 (3)',
      2,
      'B (2)',
      4,
      5,
    ]);
    expect(shape(buildSectionRows(entries, commentsOf, [], { open: new Set(['1:A']), keep: 2 }))).toEqual([
      'A (4)',
      0,
      'A.1 (3)',
      2,
      'B (2)',
    ]);
    expect(shape(buildSectionRows(entries, commentsOf, [], { open: new Set(), keep: 5 }))).toEqual(['A (4)', 'B (2)', 5]);
    // A section listed only for the kept item inside a folded part reads as folded, though it is open itself.
    const kept = buildSectionRows(entries, commentsOf, [], { open: new Set(['2:A.1']), keep: 2 });
    expect(kept.filter((row) => row.kind === 'heading').map((row) => [row.key, row.collapsed, row.partKey])).toEqual([
      ['1:A', true, null],
      ['2:A.1', true, '1:A'],
      ['1:B', true, null],
    ]);
  });

  it('knows the headings an item sits in', () => {
    expect(enclosingHeadingKeys(entries, commentsOf, [], 2)).toEqual(['1:A', '2:A.1']);
    expect(enclosingHeadingKeys(entries, commentsOf, [], 0)).toEqual(['1:A']);
    expect(enclosingHeadingKeys(entries, commentsOf, [], 5)).toEqual(['1:B']);
    expect(enclosingHeadingKeys([entry(0), entry(1, '// ---- X')], commentsOf, [], 0)).toEqual([]);
    expect(enclosingHeadingKeys(entries, commentsOf, [], 9)).toEqual([]);
  });

  it('shows no comment rows for a list without headings', () => {
    expect(shape(buildSectionRows([entry(0, '// just a note'), entry(1)], commentsOf, ['// end']))).toEqual([0, 1]);
  });

  it('lists search matches under their headings, a matching title with its whole section, no notes', () => {
    const search = (matches: number[], title = '') => ({
      matches: (index: number) => matches.includes(index),
      headingMatches: (heading: string) => title !== '' && heading.includes(title),
    });
    expect(shape(buildSectionRows(entries, commentsOf, [], { search: search([2]) }))).toEqual(['A (4)', 'A.1 (3)', 2]);
    expect(shape(buildSectionRows(entries, commentsOf, [], { search: search([], 'A.1') }))).toEqual(['A (4)', 'A.1 (3)', 1, 2, 3]);
    expect(shape(buildSectionRows(entries, commentsOf, [], { search: search([5], ''), open: new Set() }))).toEqual(['B (2)', 5]);
    expect(shape(buildSectionRows([entry(0, '// note'), entry(1)], commentsOf, [], { search: search([1]) }))).toEqual([1]);
  });

  it('gives repeated headings their own keys and shows comments after the last item', () => {
    const repeated = [entry(0, '// ---- X'), entry(1, '// ---- X')];
    expect(headingKeys(repeated, commentsOf, ['// ---- Y'])).toEqual(['2:X', '2:X#1', '2:Y']);
    expect(shape(buildSectionRows(repeated, commentsOf, ['// ---- Y']))).toEqual(['X (1)', 0, 'X (1)', 1, 'Y (0)']);
  });
});

describe('applySectionEdit', () => {
  const list: SectionList<Item> = {
    items: [
      item('a', '// ==== P', '// about P'),
      item('b', '// ---- S1'),
      item('c'),
      item('d', '// ---- S2', '// about S2'),
      item('e', '// ==== Q'),
      item('f'),
    ],
    end: ['// the end'],
  };
  const run = (edit: Parameters<typeof applySectionEdit<Item>>[2]) => applySectionEdit(list, access, edit);

  it('inserts lines right above an item, or after the last one', () => {
    expect(stream(run({ kind: 'insert', at: 1, lines: ['// ---- New'] }))?.slice(2, 5)).toEqual(['[a]', '// ---- S1', '// ---- New']);
    // A note after a note: a blank line keeps it a note of its own.
    expect(stream(run({ kind: 'insert', at: 6, lines: ['// last'] }))?.slice(-3)).toEqual(['// the end', '', '// last']);
    expect(run({ kind: 'insert', at: 7, lines: ['// x'] })).toBeUndefined();
    expect(run({ kind: 'insert', at: 0, lines: [] })).toBeUndefined();
  });

  it('replaces or removes note lines, never an item', () => {
    expect(stream(run({ kind: 'replace', address: { at: 3, line: 1 }, count: 1, lines: ['// new'] }))?.slice(6, 9)).toEqual([
      '// ---- S2',
      '// new',
      '[d]',
    ]);
    expect(stream(run({ kind: 'replace', address: { at: 3, line: 1 }, count: 5, lines: [] }))?.slice(6, 8)).toEqual(['// ---- S2', '[d]']);
    expect(run({ kind: 'replace', address: { at: 3, line: 9 }, count: 1, lines: [] })).toBeUndefined();
  });

  it('sets a heading with its description, keeping the decoration', () => {
    const result = run({ kind: 'heading', address: { at: 0, line: 0 }, level: 1, title: 'Part one', description: 'new\ntext' });
    expect(stream(result)?.slice(0, 4)).toEqual(['// ==== Part one', '// new', '// text', '[a]']);
    expect(run({ kind: 'heading', address: { at: 0, line: 1 }, level: 1, title: 'x', description: '' })).toBeUndefined();
  });

  it('removes a heading with its description and keeps the items', () => {
    const result = run({ kind: 'removeHeading', address: { at: 3, line: 0 } });
    expect(stream(result)?.slice(4, 8)).toEqual(['[b]', '[c]', '[d]', '// ==== Q']);
    expect(result?.items.map((value) => value.name)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('moves a section with its items past the next one of its level, inside its part', () => {
    const down = run({ kind: 'move', address: { at: 1, line: 0 }, direction: 1 });
    expect(stream(down)?.slice(0, 9)).toEqual([
      '// ==== P',
      '// about P',
      '[a]',
      '// ---- S2',
      '// about S2',
      '[d]',
      '// ---- S1',
      '[b]',
      '[c]',
    ]);
    expect(down?.items.map((value) => value.name)).toEqual(['a', 'd', 'b', 'c', 'e', 'f']);
    expect(down?.from).toEqual([0, 3, 1, 2, 4, 5]);
    expect(stream(run({ kind: 'move', address: { at: 3, line: 0 }, direction: -1 }))).toEqual(stream(down));
    expect(run({ kind: 'move', address: { at: 1, line: 0 }, direction: -1 })).toBeUndefined();
    expect(run({ kind: 'move', address: { at: 3, line: 0 }, direction: 1 })).toBeUndefined();
  });

  it('moves a part with its sections and the comments after the last item', () => {
    const up = run({ kind: 'move', address: { at: 4, line: 0 }, direction: -1 });
    expect(stream(up)).toEqual([
      '// ==== Q',
      '[e]',
      '[f]',
      '// the end',
      '// ==== P',
      '// about P',
      '[a]',
      '// ---- S1',
      '[b]',
      '[c]',
      '// ---- S2',
      '// about S2',
      '[d]',
    ]);
    expect(up?.end).toEqual([]);
  });

  it('keeps unchanged items as they were', () => {
    const result = run({ kind: 'insert', at: 5, lines: ['// x'] }) as SectionEditResult<Item>;
    expect(result.items[0]).toBe(list.items[0]);
    expect(result.items[5]).toEqual(item('f', '// x'));
  });
});

describe('headingKeyChanges', () => {
  const list: SectionList<Item> = {
    items: [item('a', '// ==== P'), item('b', '// ---- Misc'), item('c', '// ---- S'), item('d', '// ==== Q', '// ---- Misc'), item('e')],
    end: [],
  };
  const changes = (edit: Parameters<typeof headingKeyChanges<Item>>[2]) => {
    const result = headingKeyChanges(list, access, edit);
    return result === undefined ? undefined : { kept: Object.fromEntries(result.kept), added: result.added };
  };

  it('follows a renamed heading and a level change', () => {
    expect(changes({ kind: 'heading', address: { at: 2, line: 0 }, level: 2, title: 'Gold', description: '' })?.kept).toMatchObject({
      '2:S': '2:Gold',
      '1:P': '1:P',
    });
    expect(changes({ kind: 'heading', address: { at: 2, line: 0 }, level: 1, title: 'S', description: '' })?.kept).toMatchObject({
      '2:S': '1:S',
    });
  });

  it('follows repeated titles renumbered by a move or an insert', () => {
    // Moving part Q above part P makes its Misc the first one.
    expect(changes({ kind: 'move', address: { at: 3, line: 0 }, direction: -1 })?.kept).toEqual({
      '1:P': '1:P',
      '2:Misc': '2:Misc#1',
      '2:S': '2:S',
      '1:Q': '1:Q',
      '2:Misc#1': '2:Misc',
    });
    expect(changes({ kind: 'insert', at: 0, lines: ['// ---- Misc'] })).toEqual({
      kept: { '1:P': '1:P', '2:Misc': '2:Misc#1', '2:S': '2:S', '1:Q': '1:Q', '2:Misc#1': '2:Misc#2' },
      added: ['2:Misc'],
    });
  });

  it('drops a removed heading, adds none for a note, and is undefined for an edit that changes nothing', () => {
    expect(changes({ kind: 'removeHeading', address: { at: 1, line: 0 } })?.kept).toEqual({
      '1:P': '1:P',
      '2:S': '2:S',
      '1:Q': '1:Q',
      '2:Misc#1': '2:Misc',
    });
    expect(changes({ kind: 'insert', at: 1, lines: ['// a note'] })?.added).toEqual([]);
    expect(changes({ kind: 'move', address: { at: 0, line: 0 }, direction: -1 })).toBeUndefined();
  });
});

describe('addToSection', () => {
  it('adds the item after the last item of the section, before the next heading', () => {
    const list: SectionList<Item> = { items: [item('a', '// ---- S1'), item('b', '// ---- S2')], end: [] };
    const result = addToSection(list, access, { at: 0, line: 0 }, { name: 'new' });
    expect(stream(result)).toEqual(['// ---- S1', '[a]', '[new]', '// ---- S2', '[b]']);
    expect(result?.index).toBe(1);
  });

  it('fills an empty section whose heading shares a block with the next one', () => {
    const list: SectionList<Item> = { items: [item('a', '// ---- Empty', '// ---- S2')], end: [] };
    const result = addToSection(list, access, { at: 0, line: 0 }, { name: 'new' });
    expect(stream(result)).toEqual(['// ---- Empty', '[new]', '// ---- S2', '[a]']);
    expect(result?.index).toBe(0);
  });

  it('adds to a section at the end of the list, before its trailing comments', () => {
    const list: SectionList<Item> = { items: [item('a')], end: ['// ---- Later'] };
    expect(stream(addToSection(list, access, { at: 1, line: 0 }, { name: 'new' }))).toEqual(['[a]', '// ---- Later', '[new]']);
  });
});

describe('blank lines between comments', () => {
  // Sully's layout: the description, a blank line (an empty string), the first rule's own comment.
  const list: SectionList<Item> = {
    items: [item('gold', '// ---- Gold', '// Small piles are hidden.', '', '// Piles of 500,000 or more.'), item('next', '// Next rule.')],
    end: [],
  };
  const commentsOfItem = (value: Item) => value.commentsBefore;

  it('reads a blank line as such', () => {
    expect(readCommentLine('')).toEqual({ kind: 'blank' });
  });

  it('ends a heading description and a note at a blank line', () => {
    const rows = buildSectionRows(list.items, commentsOfItem, ['// one', '', '// two']);
    expect(
      rows.map((row) => (row.kind === 'heading' ? `${row.title}: ${row.notes.join('|')}` : row.kind === 'note' ? row.text : row.entry.name))
    ).toEqual(['Gold: Small piles are hidden.', 'Piles of 500,000 or more.', 'gold', 'Next rule.', 'next', 'one', 'two']);
    const note = rows[1];
    expect(note).toMatchObject({ kind: 'note', address: { at: 0, line: 3 }, count: 1 });
  });

  it('edits a description without touching the rule comment below it', () => {
    const edited = applySectionEdit(list, access, {
      kind: 'heading',
      address: { at: 0, line: 0 },
      level: 2,
      title: 'Gold',
      description: 'New text\nsecond line',
    });
    expect(stream(edited)?.slice(0, 6)).toEqual([
      '// ---- Gold',
      '// New text',
      '// second line',
      '',
      '// Piles of 500,000 or more.',
      '[gold]',
    ]);
    const emptied = applySectionEdit(list, access, {
      kind: 'heading',
      address: { at: 0, line: 0 },
      level: 2,
      title: 'Gold',
      description: '',
    });
    expect(stream(emptied)?.slice(0, 4)).toEqual(['// ---- Gold', '', '// Piles of 500,000 or more.', '[gold]']);
  });

  it('removes a heading with its description only, without a blank line left at the start', () => {
    const removed = applySectionEdit(list, access, { kind: 'removeHeading', address: { at: 0, line: 0 } });
    expect(removed?.items[0].commentsBefore).toEqual(['// Piles of 500,000 or more.']);
  });

  it('removes a note and the blank line it leaves behind', () => {
    const removed = applySectionEdit(list, access, { kind: 'replace', address: { at: 0, line: 3 }, count: 1, lines: [] });
    expect(removed?.items[0].commentsBefore).toEqual(['// ---- Gold', '// Small piles are hidden.']);
  });

  it('keeps heading keys and their changes', () => {
    expect(headingKeys(list.items, commentsOfItem)).toEqual(['2:Gold']);
    const changes = headingKeyChanges(list, access, {
      kind: 'heading',
      address: { at: 0, line: 0 },
      level: 1,
      title: 'Gold',
      description: '',
    });
    expect(changes?.kept).toEqual(new Map([['2:Gold', '1:Gold']]));
  });

  it('adds a note above a rule as a note of its own, not as part of a description or another note', () => {
    const headed: SectionList<Item> = { items: [item('a', '// ---- A', '// desc'), item('b', '// one')], end: [] };
    const under = applySectionEdit(headed, access, { kind: 'insert', at: 0, lines: ['// a note'] });
    expect(under?.items[0].commentsBefore).toEqual(['// ---- A', '// desc', '', '// a note']);
    const rows = buildSectionRows(under?.items ?? [], commentsOfItem, []);
    expect(rows[0]).toMatchObject({ kind: 'heading', notes: ['desc'] });
    expect(rows[1]).toMatchObject({ kind: 'note', text: 'a note' });
    expect(applySectionEdit(headed, access, { kind: 'insert', at: 1, lines: ['// two'] })?.items[1].commentsBefore).toEqual([
      '// one',
      '',
      '// two',
    ]);
    // A heading needs no blank line, and neither does a note with nothing above it.
    expect(applySectionEdit(headed, access, { kind: 'insert', at: 1, lines: ['// ---- B'] })?.items[1].commentsBefore).toEqual([
      '// one',
      '// ---- B',
    ]);
    expect(applySectionEdit(list, access, { kind: 'insert', at: 1, lines: ['// x'] })?.items[1].commentsBefore).toEqual([
      '// Next rule.',
      '',
      '// x',
    ]);
    expect(
      applySectionEdit({ items: [item('a')], end: [] }, access, { kind: 'insert', at: 0, lines: ['// x'] })?.items[0].commentsBefore
    ).toEqual(['// x']);
  });

  it('keeps an edited note apart from the description above it', () => {
    const edited = applySectionEdit(list, access, {
      kind: 'replace',
      address: { at: 0, line: 3 },
      count: 1,
      lines: ['// changed', '// two lines'],
    });
    const rows = buildSectionRows(edited?.items ?? [], commentsOfItem, []);
    expect(rows[0]).toMatchObject({ kind: 'heading', notes: ['Small piles are hidden.'] });
    expect(rows[1]).toMatchObject({ kind: 'note', text: 'changed\ntwo lines' });
  });

  it('reads blank lines as paragraph breaks in the file notes', () => {
    expect(commentLinesText(['// About', '', '// More'])).toBe('About\n\nMore');
  });
});

describe('commentLinesText', () => {
  it('drops separators and markers', () => {
    expect(commentLinesText(['// =====', '//  Title', '// ---- Styles ---', '// =====', '// note'])).toBe('Title\nStyles\nnote');
  });
});
