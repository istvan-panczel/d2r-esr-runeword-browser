/**
 * Minimal printf for the game's description strings: `%d`, `%+d`, `%i`, `%s`, `%%`, positional `%0`–`%9` and `%.Nf`
 * (fixed decimals, as C printf writes them: ESR 3.3's bleed line "over %.2f seconds" reads "over 2.00 seconds").
 * Numeric arguments may be a `{ min, max }` range, written like the ESR docs pages (prefixes.htm / suffixes.htm):
 * `%+d` → `+(10 to 20)`, `%d` → `(10 to 20)`, negative ranges `-(10 to 20)`.
 */

export interface Range {
  min: number;
  max: number;
}

export type SprintfArg = number | string | Range;

const TOKEN = /%(\+d|d|i|s|%|[0-9]|\.[0-9]f)/g;

export function isRange(value: SprintfArg): value is Range {
  return typeof value === 'object';
}

/** Rounds away float noise (0.1 + 0.2) but keeps real fractions such as 0.625 per level. */
function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** A number or range without a forced sign: `(10 to 20)`; a range of two negatives reads `-(10 to 20)`. */
export function formatValue(value: Range | number): string {
  if (typeof value === 'number') return num(value);
  const lo = Math.min(value.min, value.max);
  const hi = Math.max(value.min, value.max);
  if (lo === hi) return num(lo);
  if (hi <= 0) return `-(${num(-hi)} to ${num(-lo)})`;
  return `(${num(lo)} to ${num(hi)})`;
}

/** Like `formatValue` with a `+` in front of non-negative values (`+10`, `+(10 to 20)`). */
export function formatSigned(value: Range | number): string {
  const text = formatValue(value);
  const lo = typeof value === 'number' ? value : Math.min(value.min, value.max);
  return lo >= 0 ? `+${text}` : text;
}

/** `%.2f`: a number or range with that many decimals ("2.00", "(1.50 to 2.00)") */
function fixed(value: Range | number, decimals: number): string {
  if (typeof value === 'number') return value.toFixed(decimals);
  const lo = Math.min(value.min, value.max);
  const hi = Math.max(value.min, value.max);
  return lo === hi ? lo.toFixed(decimals) : `(${lo.toFixed(decimals)} to ${hi.toFixed(decimals)})`;
}

function formatArg(arg: SprintfArg | undefined, signed: boolean): string {
  if (arg === undefined) return '';
  if (typeof arg === 'string') return arg;
  return signed ? formatSigned(arg) : formatValue(arg);
}

/** True when the string contains a printf token (as opposed to a bare label like "to Fire Skills"). */
export function hasFormat(format: string): boolean {
  return /%(\+d|d|i|s|[0-9]|\.[0-9]f)/.test(format);
}

export function sprintf(format: string, args: readonly SprintfArg[]): string {
  let next = 0;
  return format.replace(TOKEN, (_match, token: string) => {
    if (token === '%') return '%';
    if (/^[0-9]$/.test(token)) return formatArg(args[Number(token)], false);
    const arg = args.at(next++);
    if (token.endsWith('f') && arg !== undefined && typeof arg !== 'string') return fixed(arg, Number(token.slice(1, -1)));
    return formatArg(arg, token === '+d');
  });
}
