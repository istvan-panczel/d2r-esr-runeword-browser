import { JsoncSyntaxError, parseJsonc } from './jsonc.ts';

/** The first syntax error of a filter file's text, for the JSON editor's lint marker. */
export interface JsoncSyntaxProblem {
  /** 0-based offsets into the text as given (a leading BOM counts); `from === to` marks a point (the end of the text). */
  readonly from: number;
  readonly to: number;
  /** The reason, without the "(line L, column C)" suffix: the editor shows the place. */
  readonly message: string;
}

/**
 * The 0-based offset of a 1-based line and column (UTF-16 code units, as {@link JsoncSyntaxError} counts them; a CR
 * before the line break is an ordinary character of its line). A column past the line's end stops at its line break.
 */
function offsetOf(text: string, line: number, column: number): number {
  let offset = 0;
  for (let current = 1; current < line; current++) {
    const next = text.indexOf('\n', offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  const lineEnd = text.indexOf('\n', offset);
  return Math.min(offset + Math.max(column, 1) - 1, lineEnd === -1 ? text.length : lineEnd);
}

/**
 * The 0-based offset in `text` (a leading BOM counts) of a {@link JsoncSyntaxError} thrown while parsing it, or
 * undefined when the error has no location.
 */
export function jsoncErrorOffset(text: string, error: JsoncSyntaxError): number | undefined {
  if (error.line === undefined || error.column === undefined) return undefined;
  // parseJsonc drops a leading BOM before it counts lines and columns.
  const bom = text.startsWith('\uFEFF') ? 1 : 0;
  return bom + offsetOf(text.slice(bom), error.line, error.column);
}

/**
 * Where `text` fails to parse as a filter file's JSONC ({@link parseJsonc}), or undefined when it parses. Marks the one
 * character at the error; an error without a location (or not a {@link JsoncSyntaxError}) is reported at offset 0.
 */
export function findJsoncSyntaxProblem(text: string): JsoncSyntaxProblem | undefined {
  try {
    parseJsonc(text);
    return undefined;
  } catch (error) {
    if (!(error instanceof JsoncSyntaxError)) {
      return { from: 0, to: 0, message: error instanceof Error ? error.message : String(error) };
    }
    const message = error.message.replace(/ \(line \d+, column \d+\)$/, '');
    const from = jsoncErrorOffset(text, error);
    if (from === undefined) return { from: 0, to: 0, message };
    return { from, to: Math.min(from + 1, text.length), message };
  }
}
