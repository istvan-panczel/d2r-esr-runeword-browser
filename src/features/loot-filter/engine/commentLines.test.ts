import { describe, expect, it } from 'vitest';
import { blankLineBetween, joinCommentBlocks, tidyCommentBlock } from './commentLines';
import { parseJsonc } from './jsonc';
import { parseLootFilter } from './parse';
import { serializeLootFilter } from './serialize';

// Sully's layout: a heading, its description, a blank line, then the rule's own comment.
const FILE = `// My filter

// by me
{
  "formatVersion": 1,
  "rules": [
    // ---- Gold
    // Small gold piles are hidden.

    // Gold piles of 500,000 or more.
    {"itemCodes": ["gld"], "hide": true},

    // ---- Empty comment
    //
    // after an empty comment


    // after two blank lines
    {"itemCodes": ["a"], "hide": true}

    // the end

    // really the end
  ]
}
`;

describe('blank lines between comments', () => {
  it('reads a blank line between two comments of a block as an empty string, not at the ends of a block', () => {
    const { placedComments, leadingComments } = parseJsonc(FILE);
    expect(leadingComments).toEqual(['// My filter', '', '// by me']);
    expect(placedComments.rules).toEqual({
      0: ['// ---- Gold', '// Small gold piles are hidden.', '', '// Gold piles of 500,000 or more.'],
      1: ['// ---- Empty comment', '//', '// after an empty comment', '', '// after two blank lines'],
    });
    expect(placedComments.rulesEnd).toEqual(['// the end', '', '// really the end']);
  });

  it('reads CRLF files the same', () => {
    expect(parseJsonc(FILE.replace(/\n/g, '\r\n')).placedComments.rules).toEqual(parseJsonc(FILE).placedComments.rules);
  });

  it('writes a blank line back as an empty line, one for a run, and reads back the same', () => {
    const text = serializeLootFilter(parseLootFilter(FILE).filter);
    expect(text).toContain('// My filter\n\n// by me\n{');
    expect(text).toContain('    // Small gold piles are hidden.\n\n    // Gold piles of 500,000 or more.\n');
    expect(text).toContain('    //\n    // after an empty comment\n\n    // after two blank lines\n');
    expect(text).toContain('    // the end\n\n    // really the end\n  ]');
    expect(text).not.toMatch(/ +\n/);
    expect(text).not.toContain('\n\n\n');
    expect(parseLootFilter(text).filter).toEqual(parseLootFilter(FILE).filter);
    expect(serializeLootFilter(parseLootFilter(text).filter)).toBe(text);
  });

  it('drops blank lines at the start and end of a block and collapses runs', () => {
    expect(tidyCommentBlock(['', '// a', '', ' ', '// b', ''])).toEqual(['// a', '', '// b']);
    expect(tidyCommentBlock(['', ''])).toEqual([]);
    const filter = parseLootFilter('{"formatVersion": 1, "rules": [{"hide": true}]}').filter;
    const text = serializeLootFilter({ ...filter, rules: [{ ...filter.rules[0], commentsBefore: ['', '// a', '', '', '// b', ''] }] });
    expect(text).toContain('  "rules": [\n    // a\n\n    // b\n    {"hide": true}\n  ]');
  });

  it('joins two blocks a blank line apart', () => {
    expect(joinCommentBlocks(['// a'], ['// b'])).toEqual(['// a', '', '// b']);
    expect(joinCommentBlocks([], ['// b'])).toEqual(['// b']);
    expect(joinCommentBlocks(['// a', ''], [])).toEqual(['// a']);
  });

  it('finds blank lines only strictly between the two lines', () => {
    const source = '// a\n  \n// b\n// c';
    expect(blankLineBetween(source, 0, source.indexOf('// b'))).toBe(true);
    expect(blankLineBetween(source, source.indexOf('// b'), source.indexOf('// c'))).toBe(false);
  });
});
