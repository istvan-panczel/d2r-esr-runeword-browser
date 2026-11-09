import { describe, expect, it } from 'vitest';
import { buildRuleListRows, commentLinesText, headingKeys, readCommentLine } from './ruleSections';

const entry = (index: number, commentsBefore?: readonly string[]) => ({ index, rule: commentsBefore ? { commentsBefore } : {} });
const shape = (rows: ReturnType<typeof buildRuleListRows<ReturnType<typeof entry>>>) =>
  rows.map((row) =>
    row.kind === 'rule' ? row.entry.index : row.kind === 'heading' ? `${row.title} (${String(row.ruleCount)})` : `note: ${row.text}`
  );

describe('readCommentLine', () => {
  it('reads parts, sections, notes and separators', () => {
    expect(readCommentLine('// ==== PART 1')).toEqual({ kind: 'heading', level: 1, title: 'PART 1' });
    expect(readCommentLine('// ---- 1.1 Gold ---------')).toEqual({ kind: 'heading', level: 2, title: '1.1 Gold' });
    expect(readCommentLine('//---- Tight')).toEqual({ kind: 'heading', level: 2, title: 'Tight' });
    expect(readCommentLine('// ===========')).toEqual({ kind: 'separator' });
    expect(readCommentLine('// --- three dashes is a note')).toEqual({ kind: 'note', text: '--- three dashes is a note' });
    expect(readCommentLine('// plain')).toEqual({ kind: 'note', text: 'plain' });
  });
});

describe('buildRuleListRows', () => {
  const entries = [
    entry(0, ['// ==== A', '// about A']),
    entry(1, ['// ---- A.1']),
    entry(2),
    entry(3, ['// loose']),
    entry(4, ['// ==== B']),
    entry(5),
  ];

  it('counts each heading up to the next of the same or a higher level', () => {
    expect(shape(buildRuleListRows(entries, [], new Set(), null))).toEqual(['A (4)', 0, 'A.1 (3)', 1, 2, 'note: loose', 3, 'B (2)', 4, 5]);
  });

  it('keeps notes under the heading right above them', () => {
    const [first] = buildRuleListRows(entries, [], new Set(), null);
    expect(first).toMatchObject({ kind: 'heading', notes: ['about A'] });
  });

  it('folds nested sections with a part and stops at the next part', () => {
    expect(shape(buildRuleListRows(entries, [], new Set(['1:A']), null))).toEqual(['A (4)', 'B (2)', 4, 5]);
  });

  it('folds a section only up to the next heading', () => {
    expect(shape(buildRuleListRows(entries, [], new Set(['2:A.1']), null))).toEqual(['A (4)', 0, 'A.1 (3)', 'B (2)', 4, 5]);
  });

  it('still lists the selected rule of a folded section', () => {
    expect(shape(buildRuleListRows(entries, [], new Set(['1:A']), 2))).toEqual(['A (4)', 2, 'B (2)', 4, 5]);
  });

  it('shows no comment rows for a file without headings', () => {
    expect(shape(buildRuleListRows([entry(0, ['// just a note']), entry(1)], ['// end'], new Set(), null))).toEqual([0, 1]);
  });

  it('gives repeated headings their own keys and shows comments after the last rule', () => {
    const repeated = [entry(0, ['// ---- X']), entry(1, ['// ---- X'])];
    expect(headingKeys(repeated, ['// ---- Y'])).toEqual(['2:X', '2:X#1', '2:Y']);
    expect(shape(buildRuleListRows(repeated, ['// ---- Y'], new Set(), null))).toEqual(['X (1)', 0, 'X (1)', 1, 'Y (0)']);
  });
});

describe('commentLinesText', () => {
  it('drops separators and markers', () => {
    expect(commentLinesText(['// =====', '//  Title', '// ---- Styles ---', '// =====', '// note'])).toBe('Title\nStyles\nnote');
  });
});
