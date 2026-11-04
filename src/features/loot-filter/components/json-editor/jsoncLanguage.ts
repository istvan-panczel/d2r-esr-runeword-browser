/**
 * A CodeMirror stream language for loot filter files: JSON with `//` line comments, block comments and a trailing comma
 * (see engine/jsonc.ts). @codemirror/lang-json is not used because its Lezer grammar has no comments.
 */
import { LanguageSupport, StreamLanguage, foldService, syntaxTree, type StreamParser, type StringStream } from '@codemirror/language';
import type { EditorState, Text } from '@codemirror/state';

/** Tokenizer state carried from line to line. */
export interface JsoncState {
  /** Open `{` / `[` before the current position, for indentation. */
  depth: number;
  /** Inside a block comment that started on an earlier line (or earlier on this one). */
  inBlockComment: boolean;
}

/**
 * Token names the tokenizer returns; each is a @lezer/highlight tag name, so the theme colours them without a token
 * table. All four brackets share one token type: plain bracket matching only pairs brackets of the same token type.
 */
export type JsoncToken =
  'propertyName' | 'string' | 'number' | 'bool' | 'null' | 'lineComment' | 'blockComment' | 'bracket' | 'separator' | 'invalid';

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const BOOL = /^(?:true|false)(?![\w$])/;
const NULL = /^null(?![\w$])/;
/** A run of characters that cannot start any token, marked invalid as one piece. */
const INVALID_RUN = /^[^\s{}[\],:"/]+/;

/** Consumes the rest of a block comment; clears `inBlockComment` when it ends on this line. */
function blockCommentRest(stream: StringStream, state: JsoncState): 'blockComment' {
  const rest = stream.string.slice(stream.pos);
  const end = rest.indexOf('*/');
  if (end === -1) {
    stream.skipToEnd();
  } else {
    stream.pos += end + 2;
    state.inBlockComment = false;
  }
  return 'blockComment';
}

/** The stream parser behind {@link jsoncLanguage}, exported for the tokenizer tests. */
export const jsoncStreamParser: StreamParser<JsoncState> = {
  name: 'jsonc',
  startState: () => ({ depth: 0, inBlockComment: false }),
  copyState: (state) => ({ ...state }),
  token(stream, state): JsoncToken | null {
    if (state.inBlockComment) return blockCommentRest(stream, state);
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }
    if (stream.match('/*')) {
      state.inBlockComment = true;
      return blockCommentRest(stream, state);
    }
    const ch = stream.peek();
    if (ch === '"') {
      stream.next();
      // An unterminated string runs to the end of the line (JSON strings cannot span lines); the linter reports it.
      while (!stream.eol()) {
        const next = stream.next();
        if (next === '\\') stream.next();
        else if (next === '"') break;
      }
      return stream.match(/^\s*:/, false) ? 'propertyName' : 'string';
    }
    if (ch === '{' || ch === '[') {
      stream.next();
      state.depth++;
      return 'bracket';
    }
    if (ch === '}' || ch === ']') {
      stream.next();
      state.depth = Math.max(0, state.depth - 1);
      return 'bracket';
    }
    if (ch === ',' || ch === ':') {
      stream.next();
      return 'separator';
    }
    if (stream.match(NUMBER)) return 'number';
    if (stream.match(BOOL)) return 'bool';
    if (stream.match(NULL)) return 'null';
    if (!stream.match(INVALID_RUN)) stream.next();
    return 'invalid';
  },
  indent(state, textAfter, context) {
    // Keep a block comment's own indentation.
    if (state.inBlockComment) return null;
    const closing = /^\s*[}\]]/.test(textAfter) ? 1 : 0;
    return Math.max(0, state.depth - closing) * context.unit;
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    // Re-indent a line when a closing bracket is typed at its start.
    indentOnInput: /^\s*[}\]]$/,
  },
};

/** The JSONC language (highlighting, indentation, comment tokens). */
export const jsoncLanguage = StreamLanguage.define(jsoncStreamParser);

/** Large enough for a filter file whose `rules` array spans the whole document (the default is 10 000). */
export const BRACKET_SCAN_DISTANCE = 1_000_000;

/**
 * The position of the bracket that closes the `{` or `[` at `open` (which must not be inside a string or comment), by a
 * forward text scan that skips strings and comments; null when it is not closed or closed by the other kind. A text
 * scan, not the syntax tree: a stream language only parses up to the viewport after an edit, so the tree may not reach
 * the closing bracket of a long block.
 */
export function findClosingBracket(doc: Text, open: number): number | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let star = false;
  let slash = false;
  let pos = open;
  for (const iter = doc.iterRange(open); !iter.next().done;) {
    const chunk = iter.value;
    for (let i = 0; i < chunk.length; i++, pos++) {
      const ch = chunk[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        // A line break ends an (invalid) unterminated string, as in the tokenizer.
        else if (ch === '"' || ch === '\n') inString = false;
        continue;
      }
      if (lineComment) {
        if (ch === '\n') lineComment = false;
        continue;
      }
      if (blockComment) {
        if (star && ch === '/') blockComment = false;
        star = ch === '*';
        continue;
      }
      if (slash) {
        slash = false;
        if (ch === '/') {
          lineComment = true;
          continue;
        }
        if (ch === '*') {
          blockComment = true;
          star = false;
          continue;
        }
      }
      if (ch === '/') slash = true;
      else if (ch === '"') inString = true;
      else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
      else if (ch === '}' || ch === ']') {
        if (stack.pop() !== ch) return null;
        if (stack.length === 0) return pos;
      }
    }
  }
  return null;
}

/**
 * The fold range for a line: from the first opening bracket token on it (not one inside a string or comment, which the
 * tree tells: the line is visible, so parsed) whose closing bracket is on a later line, to just before that bracket.
 */
export function jsoncFoldRange(state: EditorState, lineStart: number, lineEnd: number): { from: number; to: number } | null {
  const tree = syntaxTree(state);
  const text = state.sliceDoc(lineStart, lineEnd);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '{' && ch !== '[') continue;
    const pos = lineStart + i;
    if (tree.resolveInner(pos, 1).type.name !== 'bracket') continue;
    const close = findClosingBracket(state.doc, pos);
    if (close !== null && close > lineEnd) return { from: pos + 1, to: close };
  }
  return null;
}

/** JSONC language support: the language plus bracket folding. */
export function jsonc(): LanguageSupport {
  return new LanguageSupport(jsoncLanguage, [foldService.of(jsoncFoldRange)]);
}
