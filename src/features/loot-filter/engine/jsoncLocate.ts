/**
 * Finds where a diagnostic's path (`rules/12/itemCodes/3`, `styles/Mythical/sound`) sits in the JSONC text of a
 * filter file, so the JSON editor can underline it. A small forgiving scanner, not a parser: it walks only into the
 * containers on the path and skips everything else by bracket depth, so it is linear in the text and works on text
 * the user is still typing (it stops at the first place it cannot make sense of and returns what it found so far).
 */

/** A 0-based `[from, to)` range of the text. */
export interface JsoncRange {
  readonly from: number;
  readonly to: number;
}

interface Skipped {
  /** Offset just after the value, or where the scan stopped when it is broken. */
  readonly end: number;
  /** False for an unclosed container or string, or when no value starts here. */
  readonly ok: boolean;
}

/** What may follow a bare scalar (`true`, `12`): where it ends. */
const SCALAR_END = new Set([' ', '\t', '\r', '\n', ',', ':', '[', ']', '{', '}', '"', '/']);

class Scanner {
  readonly text: string;
  /** The cursor: an offset into `text`. */
  i: number;

  constructor(text: string, start: number) {
    this.text = text;
    this.i = start;
  }

  /** The character at the cursor, or "" at the end. A method, not a getter, so TypeScript does not narrow it across moves. */
  peek(): string {
    return this.text.charAt(this.i);
  }

  /** Skips whitespace, `//` comments (to the line end) and block comments (to `*\/` or the end of the text). */
  skipTrivia(): void {
    const { text } = this;
    while (this.i < text.length) {
      const ch = text[this.i];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.i++;
      } else if (ch === '/' && text[this.i + 1] === '/') {
        const end = text.indexOf('\n', this.i);
        this.i = end === -1 ? text.length : end + 1;
      } else if (ch === '/' && text[this.i + 1] === '*') {
        const end = text.indexOf('*/', this.i + 2);
        this.i = end === -1 ? text.length : end + 2;
      } else {
        return;
      }
    }
  }

  /**
   * Skips the string whose opening quote is at the cursor. A raw line break ends it as unclosed (JSON strings cannot
   * hold one), so a missing closing quote does not swallow the rest of the file.
   */
  skipString(): boolean {
    const { text } = this;
    this.i++;
    while (this.i < text.length) {
      const ch = text[this.i];
      if (ch === '"') {
        this.i++;
        return true;
      }
      if (ch === '\n') return false;
      this.i += ch === '\\' && text[this.i + 1] !== '\n' ? 2 : 1;
    }
    this.i = text.length;
    return false;
  }

  /** Skips the value at the cursor: containers by bracket depth (strings and comments inside are skipped whole). */
  skipValue(): Skipped {
    const { text } = this;
    const ch = this.peek();
    if (ch === '"') {
      const ok = this.skipString();
      return { end: this.i, ok };
    }
    if (ch === '{' || ch === '[') {
      let depth = 0;
      while (this.i < text.length) {
        const c = text[this.i];
        if (c === '"') {
          this.skipString();
          continue;
        }
        if (c === '/' && (text[this.i + 1] === '/' || text[this.i + 1] === '*')) {
          this.skipTrivia();
          continue;
        }
        this.i++;
        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') {
          depth--;
          if (depth === 0) return { end: this.i, ok: true };
        }
      }
      return { end: this.i, ok: false };
    }
    const start = this.i;
    while (this.i < text.length && !SCALAR_END.has(text[this.i])) this.i++;
    return { end: this.i, ok: this.i > start };
  }
}

/** The key's text with JSON escapes decoded (`\u00ff` → `ÿ`); the raw text when the escapes are broken. */
function decodeKey(raw: string): string {
  if (!raw.includes('\\')) return raw;
  try {
    const decoded: unknown = JSON.parse(`"${raw}"`);
    return typeof decoded === 'string' ? decoded : raw;
  } catch {
    return raw;
  }
}

interface RawMember {
  readonly key: string;
  readonly keyStart: number;
  readonly keyEnd: number;
  /** Where the value starts and ends; undefined when the key is broken or has no colon or no value. */
  readonly value?: { readonly start: number; readonly end: number };
}

/**
 * The members of the object at the cursor, in file order, until it ends or breaks (a missing comma, a broken key or
 * value: that member is the last one). A trailing comma before `}` is fine.
 */
function* members(scanner: Scanner): Generator<RawMember> {
  const { text } = scanner;
  scanner.i++; // the opening brace
  for (;;) {
    scanner.skipTrivia();
    if (scanner.peek() !== '"') return; // `}`, the end of the text, or something broken
    const keyStart = scanner.i;
    const closed = scanner.skipString();
    const keyEnd = scanner.i;
    const key = decodeKey(text.slice(keyStart + 1, closed ? keyEnd - 1 : keyEnd));
    if (closed) scanner.skipTrivia();
    if (!closed || scanner.peek() !== ':') {
      yield { key, keyStart, keyEnd };
      return;
    }
    scanner.i++;
    scanner.skipTrivia();
    const start = scanner.i;
    const value = scanner.skipValue();
    if (value.end === start) {
      yield { key, keyStart, keyEnd };
      return;
    }
    // Copy the offsets now: the caller may move the cursor before asking for the next member.
    const end = value.end;
    yield { key, keyStart, keyEnd, value: { start, end } };
    scanner.i = end;
    if (!value.ok) return;
    scanner.skipTrivia();
    if (scanner.peek() !== ',') return; // `}` or a missing comma: either way no more members to read
    scanner.i++;
  }
}

/**
 * The elements of the array at the cursor, until it ends or breaks. A trailing comma before `]` is fine; `[1,,2]` and
 * a missing comma end the list.
 */
function* elements(scanner: Scanner): Generator<JsoncRange> {
  scanner.i++; // the opening bracket
  for (;;) {
    scanner.skipTrivia();
    const start = scanner.i;
    if (scanner.peek() === ']' || start >= scanner.text.length) return;
    const value = scanner.skipValue();
    if (value.end === start) return; // no value here (`,` or garbage)
    const end = value.end;
    yield { from: start, to: end };
    scanner.i = end;
    if (!value.ok) return;
    scanner.skipTrivia();
    if (scanner.peek() !== ',') return;
    scanner.i++;
  }
}

/** A member's range: from the key's opening quote to the end of its value, or just the key when it has no value. */
function memberRange(member: RawMember): JsoncRange {
  return { from: member.keyStart, to: member.value?.end ?? member.keyEnd };
}

interface Step {
  readonly range: JsoncRange;
  /** Where the value to go into next starts; undefined when the walk cannot go further (no value). */
  readonly valueStart?: number;
  /** How many path segments the step covers. */
  readonly segments: number;
}

/**
 * The member of the object at the cursor that the path `rest` goes into: the longest key that is `rest` or a prefix
 * of it ending at a '/', since style names may contain '/'. Of equal keys the last one wins, as in `JSON.parse`.
 */
function findMember(scanner: Scanner, rest: string): Step | undefined {
  let best: Step | undefined;
  let bestLength = -1;
  for (const member of members(scanner)) {
    const { key } = member;
    if (key.length < bestLength || (rest !== key && !rest.startsWith(`${key}/`))) continue;
    best = { range: memberRange(member), valueStart: member.value?.start, segments: key.split('/').length };
    bestLength = key.length;
  }
  return best;
}

/** The element `index` of the array at the cursor; undefined when the array is shorter or breaks before it. */
function findElement(scanner: Scanner, index: number): Step | undefined {
  let current = 0;
  for (const element of elements(scanner)) {
    if (current++ === index) return { range: element, valueStart: element.from, segments: 1 };
  }
  return undefined;
}

interface Walk {
  /** The deepest range found. */
  readonly found?: JsoncRange;
  /** Where the value at the whole path starts, when every segment was found. */
  readonly valueStart?: number;
}

/** Follows `segments` from the root value as far as the text allows. */
function walk(text: string, segments: readonly string[]): Walk {
  const scanner = new Scanner(text, text.startsWith('\uFEFF') ? 1 : 0);
  scanner.skipTrivia();
  let found: JsoncRange | undefined;
  let k = 0;
  // Every pass either descends at least one segment or returns, so the walk ends.
  while (k < segments.length) {
    const ch = scanner.peek();
    let step: Step | undefined;
    if (ch === '{') step = findMember(scanner, segments.slice(k).join('/'));
    else if (ch === '[' && /^\d+$/.test(segments[k])) step = findElement(scanner, Number(segments[k]));
    // Otherwise a scalar, broken text or the end: nothing to go into.
    if (!step) return { found };
    found = step.range;
    if (step.valueStart === undefined) return { found };
    k += step.segments;
    scanner.i = step.valueStart;
  }
  return { found, valueStart: scanner.i };
}

/**
 * The range of the value at a diagnostic path in JSONC `text`: for an object member from the key's opening quote to
 * the end of its value (`"sound": "x"`), for an array element the element. Offsets are 0-based into `text` as given
 * (a leading BOM counts). When the path goes further than the text (a missing key, an index out of range, a value of
 * another type, broken text), the deepest part found is returned; undefined when not even the first segment is found,
 * and for the '' path (the whole file).
 */
export function locateJsoncPath(text: string, path: string): JsoncRange | undefined {
  if (path === '') return undefined;
  return walk(text, path.split('/')).found;
}

/** A member (decoded key) or an element (index) of a container, with its range as {@link locateJsoncPath} gives it. */
export interface JsoncChild {
  readonly key: string | number;
  readonly range: JsoncRange;
}

/**
 * Every member or element of the object or array at `path` ('' for the root) in one walk, in file order (equal keys
 * repeat), up to where the text breaks. For callers that need many siblings: one {@link locateJsoncPath} per child
 * would walk the file once per child. Undefined when the path is not found or does not hold an object or array.
 */
export function locateJsoncChildren(text: string, path: string): readonly JsoncChild[] | undefined {
  const { valueStart } = walk(text, path === '' ? [] : path.split('/'));
  if (valueStart === undefined) return undefined;
  const scanner = new Scanner(text, valueStart);
  if (scanner.peek() === '{') return Array.from(members(scanner), (member) => ({ key: member.key, range: memberRange(member) }));
  if (scanner.peek() === '[') return Array.from(elements(scanner), (range, index) => ({ key: index, range }));
  return undefined;
}
