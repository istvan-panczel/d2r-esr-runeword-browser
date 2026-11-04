import { StringStream, ensureSyntaxTree, foldable, getIndentation, matchBrackets, syntaxTree } from '@codemirror/language';
import { EditorState, Text } from '@codemirror/state';
import { BRACKET_SCAN_DISTANCE, findClosingBracket, jsonc, jsoncStreamParser, type JsoncState } from './jsoncLanguage';

/** [text, token] pairs per line, whitespace left out. */
function tokenize(lines: readonly string[]): [string, string | null][][] {
  const state: JsoncState = jsoncStreamParser.startState?.(2) ?? { depth: 0, inBlockComment: false };
  return lines.map((line) => {
    const stream = new StringStream(line, 4, 2);
    const tokens: [string, string | null][] = [];
    while (!stream.eol()) {
      stream.start = stream.pos;
      const token = jsoncStreamParser.token(stream, state);
      if (stream.pos === stream.start) throw new Error(`no progress at ${String(stream.pos)} in ${line}`);
      if (stream.current().trim() !== '') tokens.push([stream.current(), token]);
    }
    return tokens;
  });
}

/** A state with the whole document parsed (state creation alone parses only the first 3000 characters). */
function stateOf(doc: string): EditorState {
  const state = EditorState.create({ doc, extensions: [jsonc()] });
  ensureSyntaxTree(state, doc.length, 5000);
  // The next state takes over the finished tree.
  return state.update({}).state;
}

describe('jsonc tokenizer', () => {
  it('tells property names from string values', () => {
    expect(tokenize(['{ "name" : "ÿc1Shako", "a\\"b": "x:y" }'])).toEqual([
      [
        ['{', 'bracket'],
        ['"name"', 'propertyName'],
        [':', 'separator'],
        ['"ÿc1Shako"', 'string'],
        [',', 'separator'],
        ['"a\\"b"', 'propertyName'],
        [':', 'separator'],
        ['"x:y"', 'string'],
        ['}', 'bracket'],
      ],
    ]);
  });

  it('reads numbers, literals and invalid text', () => {
    expect(tokenize(['[1, -2.5e3, true, false, null, nul, tru e, 01]'])).toEqual([
      [
        ['[', 'bracket'],
        ['1', 'number'],
        [',', 'separator'],
        ['-2.5e3', 'number'],
        [',', 'separator'],
        ['true', 'bool'],
        [',', 'separator'],
        ['false', 'bool'],
        [',', 'separator'],
        ['null', 'null'],
        [',', 'separator'],
        ['nul', 'invalid'],
        [',', 'separator'],
        ['tru', 'invalid'],
        ['e', 'invalid'],
        [',', 'separator'],
        ['0', 'number'],
        ['1', 'number'],
        [']', 'bracket'],
      ],
    ]);
    expect(tokenize(['truex'])).toEqual([[['truex', 'invalid']]]);
  });

  it('reads line comments and block comments across lines', () => {
    expect(tokenize(['// header', '{ /* one', 'two "not a string"', 'three */ "a": 1 // tail', '}'])).toEqual([
      [['// header', 'lineComment']],
      [
        ['{', 'bracket'],
        ['/* one', 'blockComment'],
      ],
      [['two "not a string"', 'blockComment']],
      [
        ['three */', 'blockComment'],
        ['"a"', 'propertyName'],
        [':', 'separator'],
        ['1', 'number'],
        ['// tail', 'lineComment'],
      ],
      [['}', 'bracket']],
    ]);
    expect(tokenize(['/* a */ /* b */ 1'])).toEqual([
      [
        ['/* a */', 'blockComment'],
        ['/* b */', 'blockComment'],
        ['1', 'number'],
      ],
    ]);
  });

  it('keeps an unterminated string a string to the end of the line', () => {
    expect(tokenize(['"abc', '1'])).toEqual([[['"abc', 'string']], [['1', 'number']]]);
  });
});

describe('jsonc editor support', () => {
  it('indents by bracket depth and dedents a closing bracket', () => {
    const state = stateOf('{\n"a": [\n1,\n]\n}');
    const indentAt = (line: number) => getIndentation(state, state.doc.line(line).from);
    expect([2, 3, 4, 5].map(indentAt)).toEqual([2, 4, 2, 0]);
  });

  it('folds brackets that close on a later line, ignoring brackets in strings and comments', () => {
    const doc = ['{', '  "rules": [', '    { "a": "[{" }, // [', '    {', '      "b": [1]', '    }', '  ]', '}'].join('\n');
    const state = stateOf(doc);
    const foldOf = (line: number) => {
      const { from, to } = state.doc.line(line);
      const range = foldable(state, from, to);
      return range && state.sliceDoc(range.from - 1, range.to + 1).split('\n')[0];
    };
    expect(foldOf(1)).toBe('{');
    expect(foldOf(2)).toBe('[');
    // The single-line object and the bracket in the string/comment do not fold.
    expect(foldOf(3)).toBeNull();
    expect(foldOf(4)).toBe('{');
    expect(foldOf(5)).toBeNull();
    const rules = foldable(state, state.doc.line(2).from, state.doc.line(2).to);
    expect(rules && state.sliceDoc(rules.to, rules.to + 1)).toBe(']');
  });

  it('matches brackets across a document longer than the default scan distance', () => {
    const doc = `[\n${Array.from({ length: 2000 }, (_, i) => `  { "rule": ${String(i)} }`).join(',\n')}\n]`;
    const state = stateOf(doc);
    expect(doc.length).toBeGreaterThan(10_000);
    expect(matchBrackets(state, 0, 1, { maxScanDistance: BRACKET_SCAN_DISTANCE })?.end?.from).toBe(doc.length - 1);
  });

  it('folds a block whose closing bracket lies past the parsed tree', () => {
    // Like a large filter after an edit: the stream parser only covers the viewport (here: the first 3000 characters).
    const doc = `{\n  "rules": [\n${Array.from({ length: 500 }, (_, i) => `    { "rule": ${String(i)} }`).join(',\n')}\n  ]\n}`;
    const state = EditorState.create({ doc, extensions: [jsonc()] });
    expect(syntaxTree(state).length).toBeLessThan(doc.length / 2);
    const rules = foldable(state, state.doc.line(2).from, state.doc.line(2).to);
    expect(rules).toEqual({ from: doc.indexOf('[') + 1, to: doc.lastIndexOf(']') });
    expect(foldable(state, 0, 1)).toEqual({ from: 1, to: doc.length - 1 });
  });
});

describe('findClosingBracket', () => {
  const close = (text: string) => findClosingBracket(Text.of(text.split('\n')), 0);

  it('skips brackets in strings, escaped quotes and comments', () => {
    const text = '{ "a": "}]\\"}", // }\n /* } ] */ "b": [1, {}] }';
    expect(close(text)).toBe(text.length - 1);
    expect(close('[ /* ] */\n// ]\n]')).toBe(15);
  });

  it('returns null for unclosed or mismatched brackets', () => {
    expect(close('{ "a": [1, 2 }')).toBeNull();
    expect(close('{ "a": 1')).toBeNull();
    expect(close('[ "unterminated ]')).toBeNull();
  });

  it('ends an unterminated string at the line break', () => {
    expect(close('[ "abc\n]')).toBe(7);
  });
});
