/**
 * A minimal JSON-with-comments reader for loot filter files, as lenient as the ESR loot filter plugin
 * (v1.5.3): `//` line comments and block comments anywhere outside strings, a single trailing comma
 * before `]` or `}`, an optional BOM and CRLF line ends. Everything else is strict JSON. Comments are
 * replaced by spaces (line breaks kept) and trailing commas by a space, so `JSON.parse` offsets are
 * those of the source. What was accepted beyond strict JSON is reported in `tolerated`; the serializer
 * always writes strict JSON ("accept on read, write strict").
 */

import { BLANK_COMMENT_LINE, blankLineBetween } from './commentLines.ts';
import { locateJsoncChildren, locateJsoncPath } from './jsoncLocate.ts';

export interface JsoncParseResult {
  readonly value: unknown;
  /**
   * The `//` comment lines before the opening value, verbatim (including `//`, without the line break), with an empty
   * string for blank lines between two of them (engine/commentLines.ts).
   */
  readonly leadingComments: string[];
  /** Trailing commas and block comments that were accepted, in file order. */
  readonly tolerated: readonly JsoncTolerance[];
  /** Where each comment (`//` or block) after the opening value starts that has no place in {@link PlacedComments}: the ones a re-serialized file loses. */
  readonly innerComments: readonly JsoncLocation[];
  /** The whole-line `//` comments the model keeps, by what they stand above. */
  readonly placedComments: PlacedComments;
}

/**
 * The whole-line `//` comments after the opening brace, verbatim (including `//`, without the indentation), by place;
 * an empty string stands for blank lines between two comments of the same place (engine/commentLines.ts).
 */
export interface PlacedComments {
  /** Above a top-level key. */
  readonly keys: Readonly<Record<string, readonly string[]>>;
  /** Above the entry of `rules` at that index. */
  readonly rules: Readonly<Record<number, readonly string[]>>;
  /** Above the entry of `disabledRules` at that index. */
  readonly disabledRules: Readonly<Record<number, readonly string[]>>;
  /** Above a named style in `styles`. */
  readonly styles: Readonly<Record<string, readonly string[]>>;
  /** After the last rule, before the closing bracket of `rules`. */
  readonly rulesEnd: readonly string[];
}

/**
 * Thrown for text that is not valid JSON once comments are removed. `line` and `column` are 1-based and only set
 * when the error could be located (some engines' messages carry no position).
 */
export class JsoncSyntaxError extends Error {
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, line?: number, column?: number) {
    super(line === undefined || column === undefined ? message : `${message} (line ${String(line)}, column ${String(column)})`);
    this.name = 'JsoncSyntaxError';
    if (line !== undefined && column !== undefined) {
      this.line = line;
      this.column = column;
    }
  }
}

/** Something the reader accepted that strict JSON does not. */
export interface JsoncTolerance {
  readonly kind: 'trailing-comma' | 'block-comment';
  /** 1-based, of the comma or the comment's opening slash. */
  readonly line: number;
  readonly column: number;
}

interface Blanked {
  readonly stripped: string;
  readonly leadingComments: string[];
  /** Start offsets of the block comments. */
  readonly blockComments: number[];
  /** Start offsets of the comments (line or block) after the opening value started. */
  readonly innerComments: number[];
  /** The `//` comments after the opening value that have nothing but indentation before them on their line. */
  readonly ownLineComments: readonly OwnLineComment[];
}

interface OwnLineComment {
  readonly offset: number;
  readonly text: string;
}

/** Spaces for every character of `text` except line breaks, so offsets and line numbers stay those of the source. */
function blank(text: string): string {
  return text.replace(/[^\r\n]/g, ' ');
}

/** Replaces every comment outside strings with spaces, so offsets stay those of the source. */
function blankComments(text: string): Blanked {
  const leadingComments: string[] = [];
  const blockComments: number[] = [];
  const innerComments: number[] = [];
  const ownLineComments: OwnLineComment[] = [];
  let out = '';
  let inString = false;
  let seenValue = false;
  let lastLeading: number | undefined;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      let end = text.indexOf('\n', i);
      if (end === -1) end = text.length;
      const comment = text.slice(i, end).replace(/\r$/, '');
      if (!seenValue) {
        if (lastLeading !== undefined && blankLineBetween(text, lastLeading, i)) leadingComments.push(BLANK_COMMENT_LINE);
        leadingComments.push(comment);
        lastLeading = i;
      } else {
        innerComments.push(i);
        if (text.slice(text.lastIndexOf('\n', i - 1) + 1, i).trim() === '') ownLineComments.push({ offset: i, text: comment.trimEnd() });
      }
      out += ' '.repeat(end - i);
      i = end;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      if (close === -1) {
        const { line, column } = lineAndColumn(text, i);
        throw new JsoncSyntaxError('Invalid JSON: a /* comment is never closed with */', line, column);
      }
      blockComments.push(i);
      if (seenValue) innerComments.push(i);
      out += blank(text.slice(i, close + 2));
      i = close + 2;
      continue;
    }
    if (ch === '"') inString = true;
    if (!isWhitespace(ch)) seenValue = true;
    out += ch;
    i++;
  }
  return { stripped: out, leadingComments, blockComments, innerComments, ownLineComments };
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

/**
 * Blanks each comma (outside strings) that directly follows a value and directly precedes `]` or `}` (only whitespace
 * between, comments are already blank). `[,]`, `{"a":,}` and `[1,,]` keep their commas, so they stay errors.
 */
function blankTrailingCommas(text: string): { readonly text: string; readonly commas: number[] } {
  const commas: number[] = [];
  let inString = false;
  let previous = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') {
        inString = false;
        previous = ch;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (isWhitespace(ch)) continue;
    if (ch === ',' && /["\]}0-9a-zA-Z.]/.test(previous)) {
      let next = i + 1;
      while (next < text.length && isWhitespace(text[next])) next++;
      if (text[next] === ']' || text[next] === '}') commas.push(i);
    }
    previous = ch;
  }
  if (commas.length === 0) return { text, commas };
  let out = '';
  let from = 0;
  for (const comma of commas) {
    out += `${text.slice(from, comma)} `;
    from = comma + 1;
  }
  return { text: out + text.slice(from), commas };
}

/** A 1-based line and column. */
export interface JsoncLocation {
  readonly line: number;
  readonly column: number;
}

type Location = JsoncLocation;

function lineAndColumn(text: string, offset: number): Location {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const lines = before.split('\n');
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

/**
 * Offset of the first syntax error in strict JSON `text`, or undefined when it is valid. Used when the engine's
 * message has no position (V8's `Unexpected token ']', "…" is not valid JSON`).
 */
export function findSyntaxErrorOffset(text: string): number | undefined {
  let i = 0;
  const skipWhitespace = () => {
    while (i < text.length && isWhitespace(text[i])) i++;
  };
  const literal = (word: string): boolean => {
    for (const ch of word) {
      if (text[i] !== ch) return false;
      i++;
    }
    return true;
  };
  const string = (): boolean => {
    i++; // the opening quote
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        i++;
        return true;
      }
      if (ch.charCodeAt(0) < 0x20) return false;
      if (ch === '\\') {
        const escape = text.charAt(i + 1);
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
            i += 2;
            return false;
          }
          i += 6;
          continue;
        }
        if (escape === '' || !'"\\/bfnrt'.includes(escape)) {
          i += 1;
          return false;
        }
        i += 2;
        continue;
      }
      i++;
    }
    return false;
  };
  const number = (): boolean => {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (!match) return false;
    i += match[0].length;
    return true;
  };
  const value = (): boolean => {
    skipWhitespace();
    const ch = text[i];
    if (ch === '{') {
      i++;
      skipWhitespace();
      if (text[i] === '}') {
        i++;
        return true;
      }
      for (;;) {
        skipWhitespace();
        if (text[i] !== '"' || !string()) return false;
        skipWhitespace();
        if (text[i] !== ':') return false;
        i++;
        if (!value()) return false;
        skipWhitespace();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] !== '}') return false;
        i++;
        return true;
      }
    }
    if (ch === '[') {
      i++;
      skipWhitespace();
      if (text[i] === ']') {
        i++;
        return true;
      }
      for (;;) {
        if (!value()) return false;
        skipWhitespace();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] !== ']') return false;
        i++;
        return true;
      }
    }
    if (ch === '"') return string();
    if (ch === 't') return literal('true');
    if (ch === 'f') return literal('false');
    if (ch === 'n') return literal('null');
    return number();
  };
  if (!value()) return Math.min(i, text.length);
  skipWhitespace();
  return i < text.length ? i : undefined;
}

/** Where `JSON.parse` failed: V8's `position N`, Firefox's `line L column C`, else found by {@link findSyntaxErrorOffset}. */
function errorLocation(message: string, text: string): Location | undefined {
  const position = /position (\d+)/.exec(message);
  if (position) return lineAndColumn(text, Number(position[1]));
  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
  const offset = findSyntaxErrorOffset(text);
  return offset === undefined ? undefined : lineAndColumn(text, offset);
}

/** The engine's message without its position and without V8's copy of the source snippet. */
function errorReason(message: string): string {
  return message
    .replace(/^JSON\.parse: /, '')
    .replace(/, .*is not valid JSON$/s, '')
    .replace(/\s*(in JSON )?at position \d+.*$/s, '')
    .replace(/\s*at line \d+ column \d+ of the JSON data$/, '');
}

const NO_PLACED_COMMENTS: PlacedComments = { keys: {}, rules: {}, disabledRules: {}, styles: {}, rulesEnd: [] };

/** A stretch of text between two neighbouring entries: a comment in it stands above the entry that follows. */
interface CommentGap {
  readonly from: number;
  readonly to: number;
  readonly add: (comment: string) => void;
}

function appendTo<K extends string | number>(record: Partial<Record<K, string[]>>, key: K, comment: string): void {
  (record[key] ??= []).push(comment);
}

/** Gaps before each child of the container at `path`, the first one starting at `start`; returns where the last child ends. */
function childGaps(
  text: string,
  path: string,
  start: number,
  gaps: CommentGap[],
  add: (key: string | number, comment: string) => void
): number {
  let from = start;
  for (const { key, range } of locateJsoncChildren(text, path) ?? []) {
    gaps.push({
      from,
      to: range.from,
      add: (comment) => {
        add(key, comment);
      },
    });
    from = range.to;
  }
  return from;
}

/**
 * Sorts the whole-line comments into the places the model keeps (above a top-level key, a rule, a disabled rule or a
 * style, or at the end of `rules`). `text` is the source; the walk runs only when there are comments to place.
 */
function placeComments(
  text: string,
  comments: readonly OwnLineComment[]
): { readonly placed: PlacedComments; readonly offsets: ReadonlySet<number> } {
  if (comments.length === 0) return { placed: NO_PLACED_COMMENTS, offsets: new Set() };
  const keys: Record<string, string[]> = {};
  const rules: Record<number, string[]> = {};
  const disabledRules: Record<number, string[]> = {};
  const styles: Record<string, string[]> = {};
  const rulesEnd: string[] = [];
  const gaps: CommentGap[] = [];
  childGaps(text, '', 0, gaps, (key, comment) => {
    appendTo(keys, String(key), comment);
  });
  const stringKey = (key: string | number) => String(key);
  const numberKey = (key: string | number) => Number(key);
  const styleRange = locateJsoncPath(text, 'styles');
  if (styleRange)
    childGaps(text, 'styles', styleRange.from, gaps, (key, comment) => {
      appendTo(styles, stringKey(key), comment);
    });
  const disabledRange = locateJsoncPath(text, 'disabledRules');
  if (disabledRange)
    childGaps(text, 'disabledRules', disabledRange.from, gaps, (key, comment) => {
      appendTo(disabledRules, numberKey(key), comment);
    });
  const rulesRange = locateJsoncPath(text, 'rules');
  if (rulesRange) {
    const end = childGaps(text, 'rules', rulesRange.from, gaps, (key, comment) => {
      appendTo(rules, numberKey(key), comment);
    });
    gaps.push({ from: end, to: rulesRange.to, add: (comment) => rulesEnd.push(comment) });
  }
  const offsets = new Set<number>();
  // The previous comment placed in each gap: a blank line between the two is kept as an empty line.
  const previous = new Map<CommentGap, number>();
  for (const { offset, text: comment } of comments) {
    const gap = gaps.find(({ from, to }) => from <= offset && offset < to);
    if (!gap) continue;
    const before = previous.get(gap);
    if (before !== undefined && blankLineBetween(text, before, offset)) gap.add(BLANK_COMMENT_LINE);
    gap.add(comment);
    previous.set(gap, offset);
    offsets.add(offset);
  }
  return { placed: { keys, rules, disabledRules, styles, rulesEnd }, offsets };
}

/**
 * Parses JSON with comments, as the ESR loot filter plugin reads it; throws {@link JsoncSyntaxError} on invalid JSON.
 * Block comments and trailing commas are accepted and listed in `tolerated`.
 */
export function parseJsonc(text: string): JsoncParseResult {
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const { stripped, leadingComments, blockComments, innerComments, ownLineComments } = blankComments(source);
  const { text: json, commas } = blankTrailingCommas(stripped);
  try {
    const value = JSON.parse(json) as unknown;
    const tolerated: JsoncTolerance[] = [
      ...commas.map((offset) => ({ kind: 'trailing-comma' as const, offset })),
      ...blockComments.map((offset) => ({ kind: 'block-comment' as const, offset })),
    ]
      .sort((a, b) => a.offset - b.offset)
      .map(({ kind, offset }) => ({ kind, ...lineAndColumn(source, offset) }));
    const { placed, offsets } = placeComments(source, ownLineComments);
    return {
      value,
      leadingComments,
      tolerated,
      innerComments: innerComments.filter((offset) => !offsets.has(offset)).map((offset) => lineAndColumn(source, offset)),
      placedComments: placed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const location = errorLocation(message, json);
    throw new JsoncSyntaxError(`Invalid JSON: ${errorReason(message) || 'unexpected end of input'}`, location?.line, location?.column);
  }
}
