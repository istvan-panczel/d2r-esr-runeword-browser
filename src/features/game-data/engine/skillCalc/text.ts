/**
 * Text helpers of the skill tooltip lines: the game's bottom-up multi-line strings and a printf that marks where the
 * numbers went, so a line can be split into label and value parts after its lines were reordered.
 */

/**
 * The lines of a multi-line description-line string in reading order, joined with newlines. The game draws these
 * strings bottom-up, like item names (ESR: "cast rate to a minimum of 0.2 seconds\nTick rate goes down by 0.04 seconds
 * for every 25% faster"); `str long` is the exception and reads top-down (Rift Shot's sentence runs across its lines).
 */
export function bottomUp(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .reverse()
    .join('\n');
}

const OPEN = '\u0001';
const CLOSE = '\u0002';

/** A number written into a line: the shown text is wrapped in markers until `splitMarked` */
export function markNumber(value: number, signed: boolean): string {
  const text = String(Object.is(value, -0) ? 0 : value);
  return `${OPEN}${signed && value >= 0 ? '+' : ''}${text}${CLOSE}`;
}

export type PrintfArg = string | number;

const TOKEN = /%(\+d|d|i|s|%|[0-9])/g;

/** Placeholders of a format that take an argument (`%d`, `%+d`, `%i`, `%s`, positional `%0`–`%9`) */
export function placeholderCount(format: string): number {
  return [...format.matchAll(TOKEN)].filter((match) => match[1] !== '%').length;
}

/** printf of the game strings; numbers are marked (see `markNumber`); a missing argument prints nothing */
export function printfMarked(format: string, args: readonly PrintfArg[]): string {
  let next = 0;
  return format.replace(TOKEN, (_match, token: string) => {
    if (token === '%') return '%';
    const i = /^[0-9]$/.test(token) ? Number(token) : next++;
    if (i >= args.length) return '';
    const arg = args[i];
    if (typeof arg === 'string') return arg;
    return markNumber(arg, token === '+d');
  });
}

export interface MarkedParts {
  /** The text without markers */
  text: string;
  /** The shown numbers in reading order */
  values: number[];
  /** Text before the first number, from the first to the last number, after the last ('' / '' when no number) */
  before: string;
  span: string;
  after: string;
}

/** Removes the markers of a (reordered) marked text and locates its numbers */
export function splitMarked(marked: string): MarkedParts {
  const values: number[] = [];
  let text = '';
  let first = -1;
  let last = -1;
  const pattern = new RegExp(`${OPEN}([^${CLOSE}]*)${CLOSE}`, 'g');
  let pos = 0;
  for (const match of marked.matchAll(pattern)) {
    text += marked.slice(pos, match.index);
    if (first === -1) first = text.length;
    const shown = match[1];
    text += shown;
    last = text.length;
    values.push(Number(shown));
    pos = match.index + match[0].length;
  }
  text += marked.slice(pos);
  if (first === -1) return { text, values, before: text, span: '', after: '' };
  return { text, values, before: text.slice(0, first), span: text.slice(first, last), after: text.slice(last) };
}
