import { describe, expect, it } from 'vitest';
import { parseJsonc } from './jsonc';
import { parseLootFilter } from './parse';
import { serializeLootFilter } from './serialize';

const FILE = `// header
{
  "formatVersion": 1,

  // above styles
  "styles": {
    // above A
    "A": {"hide": true},
    "B": {"hide": true}
  },
  "rules": [
    // ==== PART
    // part note
    {"itemCodes": ["a"], "hide": true},

    // ---- Section
    {"itemCodes": ["b"], "hide": true}

    // the end
  ],
  "disabledRules": [
    // ---- Parked
    {"at": 1, "rule": {"itemCodes": ["c"], "hide": true}}
  ]
}
`;

describe('comments kept in the model', () => {
  it('places whole-line comments by what they stand above', () => {
    expect(parseJsonc(FILE).placedComments).toEqual({
      keys: { styles: ['// above styles'] },
      styles: { A: ['// above A'] },
      rules: { 0: ['// ==== PART', '// part note'], 1: ['// ---- Section'] },
      disabledRules: { 0: ['// ---- Parked'] },
      rulesEnd: ['// the end'],
    });
    expect(parseJsonc(FILE).innerComments).toEqual([]);
  });

  it('puts a disabled rule back with its comments in the full list', () => {
    const { filter, notes } = parseLootFilter(FILE);
    expect(filter.rules.map((rule) => rule.commentsBefore)).toEqual([
      ['// ==== PART', '// part note'],
      ['// ---- Parked'],
      ['// ---- Section'],
    ]);
    expect(notes).toEqual([]);
  });

  it('writes the comments back where they were, and that text reads the same', () => {
    const { filter } = parseLootFilter(FILE);
    const written = serializeLootFilter(filter);
    expect(written).toContain('  // above styles\n  "styles": {\n    // above A\n    "A": ');
    expect(written).toContain(
      '  "rules": [\n    // ==== PART\n    // part note\n    {"itemCodes": ["a"], "hide": true},\n\n    // ---- Section\n'
    );
    expect(written).toContain('\n\n    // the end\n  ],');
    expect(written).toContain('"disabledRules": [\n    // ---- Parked\n    {"at": 1,');
    expect(parseLootFilter(written).filter).toEqual(filter);
    expect(serializeLootFilter(parseLootFilter(written).filter)).toBe(written);
  });

  it('does not write the comments into a rule or style', () => {
    const { filter } = parseLootFilter(FILE);
    expect(serializeLootFilter(filter)).not.toContain('commentsBefore');
  });

  it('reports what it cannot place: same-line, inside a rule, block comments', () => {
    const text = `{
  "formatVersion": 1,
  "rules": [
    {"hide": true}, // same line
    {
      // inside a rule
      "hide": true
    }
    /* block */
  ]
}`;
    const result = parseJsonc(text);
    expect(result.placedComments.rules).toEqual({});
    expect(result.innerComments.map((entry) => entry.line)).toEqual([4, 6, 9]);
    expect(parseLootFilter(text).notes.at(-1)?.message).toMatch(/^3 comments are dropped on the first edit \(first at line 4\)/);
  });

  it('writes a file without comments as before', () => {
    const text = '{\n  "formatVersion": 1,\n  "rules": [\n    {"hide": true}\n  ]\n}\n';
    expect(serializeLootFilter(parseLootFilter(text).filter)).toBe(text);
  });
});
