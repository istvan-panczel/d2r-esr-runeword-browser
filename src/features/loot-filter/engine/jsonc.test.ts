import { vi } from 'vitest';
import { findSyntaxErrorOffset, JsoncSyntaxError, parseJsonc } from './jsonc.ts';

function syntaxError(text: string): JsoncSyntaxError {
  try {
    parseJsonc(text);
  } catch (error) {
    if (error instanceof JsoncSyntaxError) return error;
    throw error;
  }
  throw new Error(`expected a syntax error for ${text}`);
}

describe('parseJsonc', () => {
  it('keeps // inside strings and strips comments elsewhere', () => {
    const text = '{\n  "url": "https://x.example/a//b", // trailing comment\n  // own line\n  "n": 1\n}\n// after';
    expect(parseJsonc(text)).toEqual({
      value: { url: 'https://x.example/a//b', n: 1 },
      leadingComments: [],
      tolerated: [],
      innerComments: [
        { line: 2, column: 36 },
        { line: 6, column: 1 },
      ],
      placedComments: { keys: { n: ['// own line'] }, rules: {}, disabledRules: {}, styles: {}, rulesEnd: [] },
    });
  });

  it('captures the comments before the opening brace verbatim', () => {
    const text = '// first\n  //second  \n\n{"a": [1, // one\n 2]}';
    expect(parseJsonc(text)).toMatchObject({ value: { a: [1, 2] }, leadingComments: ['// first', '//second  '] });
  });

  it('accepts CRLF and a BOM', () => {
    const text = '\uFEFF// hello\r\n{\r\n  "a": "b" // c\r\n}\r\n';
    expect(parseJsonc(text)).toMatchObject({ value: { a: 'b' }, leadingComments: ['// hello'], innerComments: [{ line: 3, column: 12 }] });
  });

  it('handles escaped quotes and backslashes in strings', () => {
    expect(parseJsonc('{"a": "q\\" // not a comment", "b": "\\\\"} // c').value).toEqual({ a: 'q" // not a comment', b: '\\' });
  });

  it('reads \\u00ff escapes and literal ÿ alike', () => {
    expect(parseJsonc('["\\u00ffc4", "ÿc4"]').value).toEqual(['ÿc4', 'ÿc4']);
  });

  it('throws a syntax error with the line and column', () => {
    let caught: unknown;
    try {
      parseJsonc('// c\n{\n  "a": 1\n  "b": 2\n}');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(JsoncSyntaxError);
    if (caught instanceof JsoncSyntaxError) {
      expect(caught.line).toBe(4);
      expect(caught.column).toBe(3);
      expect(caught.message).toMatch(/line 4, column 3/);
    }
  });

  it('locates a single-quoted value and does not repeat the source in the message', () => {
    let caught: unknown;
    try {
      parseJsonc('{\n  "a": 1,\n  "b": \'x\'\n}');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(JsoncSyntaxError);
    if (caught instanceof JsoncSyntaxError) {
      expect(caught.line).toBe(3);
      expect(caught.column).toBe(8);
      expect(caught.message).toMatch(/line 3, column 8/);
      expect(caught.message).not.toMatch(/is not valid JSON/);
      expect(caught.message.match(/"b"/g)).toBeNull();
    }
  });

  it('omits the location when the engine gives none and it cannot be found', () => {
    const parse = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw new SyntaxError('Unexpected token \'}\', "{"a": 1}" is not valid JSON');
    });
    try {
      let caught: unknown;
      try {
        parseJsonc('{"a": 1}');
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(JsoncSyntaxError);
      if (caught instanceof JsoncSyntaxError) {
        expect(caught.line).toBeUndefined();
        expect(caught.message).toBe("Invalid JSON: Unexpected token '}'");
      }
    } finally {
      parse.mockRestore();
    }
  });

  it("reads Firefox's line and column", () => {
    const parse = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw new SyntaxError('JSON.parse: unexpected character at line 2 column 5 of the JSON data');
    });
    try {
      expect(() => parseJsonc('{\n  x}')).toThrow('Invalid JSON: unexpected character (line 2, column 5)');
    } finally {
      parse.mockRestore();
    }
  });

  it('throws on an empty or unterminated document', () => {
    expect(() => parseJsonc('// only a comment')).toThrow(JsoncSyntaxError);
    expect(() => parseJsonc('{"a": "b')).toThrow(JsoncSyntaxError);
  });

  it('accepts block comments outside strings and reports them', () => {
    const text = '/* head */\n{\n  "a": /* inline */ 1,\n  /*\n   * several lines\n   */\n  "b": "x /* not a comment */"\n}';
    const result = parseJsonc(text);
    expect(result.value).toEqual({ a: 1, b: 'x /* not a comment */' });
    expect(result.leadingComments).toEqual([]);
    expect(result.tolerated).toEqual([
      { kind: 'block-comment', line: 1, column: 1 },
      { kind: 'block-comment', line: 3, column: 8 },
      { kind: 'block-comment', line: 4, column: 3 },
    ]);
    expect(result.innerComments).toEqual([
      { line: 3, column: 8 },
      { line: 4, column: 3 },
    ]);
  });

  it('keeps line numbers after a multi-line block comment', () => {
    const error = syntaxError('{\n  /* one\n  two */\n  "a": 1\n  "b": 2\n}');
    expect(error.line).toBe(5);
    expect(error.column).toBe(3);
  });

  it('throws with the position of a block comment that is never closed', () => {
    const error = syntaxError('{\n  "a": 1 /* open\n}');
    expect(error.message).toBe('Invalid JSON: a /* comment is never closed with */ (line 2, column 10)');
  });

  it('accepts a single trailing comma before ] and }, even with comments in between, and reports it', () => {
    const text = '{\n  "a": [1, 2,],\n  "b": {"c": true, // note\n  },\n}';
    const result = parseJsonc(text);
    expect(result.value).toEqual({ a: [1, 2], b: { c: true } });
    expect(result.tolerated).toEqual([
      { kind: 'trailing-comma', line: 2, column: 13 },
      { kind: 'trailing-comma', line: 3, column: 18 },
      { kind: 'trailing-comma', line: 4, column: 4 },
    ]);
  });

  it('leaves commas inside strings alone', () => {
    expect(parseJsonc('["a,]", "b,}"]')).toMatchObject({ value: ['a,]', 'b,}'], tolerated: [] });
  });

  it.each([
    ['[1,,2]', 1, 4],
    ['[1,,]', 1, 4],
    ['[,]', 1, 2],
    ['{,}', 1, 2],
    ['{"a":,}', 1, 6],
    ['{"a": 1,,}', 1, 9],
  ])('still rejects %s, with its position', (text, line, column) => {
    const error = syntaxError(text);
    expect(error.line).toBe(line);
    expect(error.column).toBe(column);
  });

  it('locates errors whose engine message has no position', () => {
    const error = syntaxError('{\n  "rules": [\n    {"a": 1}\n    {"b": 2}\n  ]\n}');
    expect(error.line).toBe(4);
    expect(error.column).toBe(5);
  });
});

describe('findSyntaxErrorOffset', () => {
  it.each(['{}', '[]', ' {"a": [1, -2.5e3, true, false, null, "\\u00ff\\n"]} ', '"x"', '0'])('finds nothing in %s', (text) => {
    expect(findSyntaxErrorOffset(text)).toBeUndefined();
  });

  it.each([
    ['', 0],
    ['{"a": 1', 7],
    ['{"a" 1}', 5],
    ['[01]', 2],
    ['["\\x"]', 3],
    ['[1] 2', 4],
    ["{'a': 1}", 1],
    ['[tru]', 4],
  ])('finds the error in %s at %i', (text, offset) => {
    expect(findSyntaxErrorOffset(text)).toBe(offset);
  });
});
