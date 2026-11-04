import { vi } from 'vitest';
import { JsoncSyntaxError } from './jsonc.ts';
import { findJsoncSyntaxProblem, jsoncErrorOffset } from './jsoncProblem.ts';

/** The problem's message and the text it marks. */
function marked(text: string): { readonly message: string; readonly at: string; readonly from: number } | undefined {
  const problem = findJsoncSyntaxProblem(text);
  return problem && { message: problem.message, at: text.slice(problem.from, problem.to), from: problem.from };
}

describe('findJsoncSyntaxProblem', () => {
  it('is undefined for text that parses, comments and a trailing comma included', () => {
    expect(findJsoncSyntaxProblem('// c\n{\n  "a": [1, 2,], /* b */\n}\n')).toBeUndefined();
  });

  it('marks the key after a missing comma, without the line and column in the message', () => {
    const text = '{\n  "a": 1\n  "b": 2\n}';
    expect(marked(text)).toEqual({ message: "Invalid JSON: Expected ',' or '}' after property value", at: '"', from: text.indexOf('"b"') });
  });

  it('marks the line break that ends an unclosed string', () => {
    expect(marked('{\n  "a": "abc\n}')).toMatchObject({ at: '\n', message: expect.stringMatching(/control character/) as unknown });
  });

  it('marks trailing garbage and an unclosed block comment', () => {
    expect(marked('{"a": 1} x')).toMatchObject({ at: 'x', from: 9 });
    expect(marked('{"a": 1} /* open')).toEqual({ message: 'Invalid JSON: a /* comment is never closed with */', at: '/', from: 9 });
  });

  it('counts a leading BOM, on line 1 and further down a CRLF file', () => {
    const line1 = '\uFEFF{"a": 1 "b": 2}';
    expect(marked(line1)).toMatchObject({ at: '"', from: line1.indexOf('"b"') });
    const crlf = '\uFEFF// c\r\n{\r\n  "a": 1\r\n  "b": 2\r\n}';
    expect(marked(crlf)).toMatchObject({ at: '"', from: crlf.indexOf('"b"') });
  });

  it('counts the column in UTF-16 code units', () => {
    const text = '{"ÿc1 😀": 1 x}';
    expect(marked(text)).toMatchObject({ at: 'x', from: text.indexOf('x') });
  });

  it('marks a point at the end for text that ends too early', () => {
    expect(findJsoncSyntaxProblem('{"a": ')).toEqual({ from: 6, to: 6, message: 'Invalid JSON: Unexpected end of JSON input' });
    expect(findJsoncSyntaxProblem('')).toMatchObject({ from: 0, to: 0 });
  });

  it('marks a mismatched bracket', () => {
    expect(marked('{"a": [1, 2}')).toMatchObject({ at: '}', from: 11 });
  });

  it('reports an error without a location at 0', () => {
    const parse = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw new SyntaxError('Something went wrong');
    });
    try {
      // Valid JSON, so the fallback search finds no position either.
      expect(findJsoncSyntaxProblem('[]')).toEqual({ from: 0, to: 0, message: 'Invalid JSON: Something went wrong' });
    } finally {
      parse.mockRestore();
    }
  });

  it('reports an error that is not a JsoncSyntaxError at 0 instead of throwing', async () => {
    vi.resetModules();
    vi.doMock('./jsonc.ts', async (importOriginal) => ({
      ...(await importOriginal<typeof import('./jsonc.ts')>()),
      parseJsonc: () => {
        throw new RangeError('Maximum call stack size exceeded');
      },
    }));
    try {
      const { findJsoncSyntaxProblem: find } = await import('./jsoncProblem.ts');
      expect(find('[]')).toEqual({ from: 0, to: 0, message: 'Maximum call stack size exceeded' });
    } finally {
      vi.doUnmock('./jsonc.ts');
      vi.resetModules();
    }
  });
});

describe('jsoncErrorOffset', () => {
  it('is the offset of the error line and column, a leading BOM counted', () => {
    const text = '\uFEFF{\n  "a": 1\n  "b": 2\n}';
    expect(jsoncErrorOffset(text, new JsoncSyntaxError('x', 3, 3))).toBe(text.indexOf('"b"'));
  });

  it('is undefined for an error without a location', () => {
    expect(jsoncErrorOffset('{', new JsoncSyntaxError('x'))).toBeUndefined();
  });
});
