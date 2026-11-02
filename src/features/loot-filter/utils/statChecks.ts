/** Helpers for the rule editor's stat check rows (`itemStats`, `itemStatsAnyOf`, `playerStats`, `playerStatsAnyOf`). */
import { statQuirk, type StatQuirk } from '../engine/statQuirks';
import type { LootFilterReference, LootFilterRule, RuleActions, StatCheck, StatOp } from '../engine/types';
import { mayHitQuirk } from '../engine/validate';
import type { LootFilterLookup } from './lookup';

export const DEFAULT_STAT_OP: StatOp = '>=';

/** A new row for the picked stat: `>= 1`. */
export function newStatCheck(stat: string | number): StatCheck {
  return { stat, op: DEFAULT_STAT_OP, value: 1 };
}

/** What the user typed as a stat: whole digits are an id (number), anything else a name. Empty → null. */
export function parseStatInput(text: string): string | number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/** Changes the op; `between` turns the value into `[v, v]`, leaving it takes the low end. */
export function setStatOp(check: StatCheck, op: StatOp): StatCheck {
  const { value } = check;
  if (op === 'between') return { ...check, op, value: typeof value === 'number' ? [value, value] : value };
  return { ...check, op, value: typeof value === 'number' ? value : value[0] };
}

/** Sets the value (`index` 0 is the value or the low end, 1 the high end of a `between`). */
export function setStatValue(check: StatCheck, index: 0 | 1, next: number): StatCheck {
  const { value } = check;
  if (typeof value === 'number') return index === 0 ? { ...check, value: next } : { ...check, value: [value, next] };
  return { ...check, value: index === 0 ? [next, value[1]] : [value[0], next] };
}

/** Sets or removes `param`. */
export function setStatParam(check: StatCheck, param: number | undefined): StatCheck {
  const { param: _old, ...rest } = check;
  return param === undefined ? rest : { ...rest, param };
}

/** Replaces the row at `index`. */
export function replaceStatCheck(list: readonly StatCheck[], index: number, check: StatCheck): readonly StatCheck[] {
  return list.map((current, position) => (position === index ? check : current));
}

/** Replaces the row at `index` with `checks` in its place ("Any known level": one check per level). */
export function replaceStatCheckWithMany(list: readonly StatCheck[], index: number, checks: readonly StatCheck[]): readonly StatCheck[] {
  return [...list.slice(0, index), ...checks, ...list.slice(index + 1)];
}

/**
 * Where "Any known level" (one check per level) means what the row means: a presence-like check (`>=`, `>`, `==`,
 * `between`) holds at any level only in an any-of list; a `<`, `<=` or `!=` check (an exception on a hide rule: none of
 * the levels) only in an all-of list.
 */
export function expandsAcrossLevels(check: StatCheck, anyOf: boolean): boolean {
  const negative = check.op === '<' || check.op === '<=' || check.op === '!=';
  return negative ? !anyOf : anyOf;
}

/** Removes the row at `index`; an emptied list is `undefined` (the key goes away). */
export function removeStatCheck(list: readonly StatCheck[], index: number): readonly StatCheck[] | undefined {
  const next = list.filter((_, position) => position !== index);
  return next.length === 0 ? undefined : next;
}

// --- Exceptions on hide rules ---

const INVERTED_OPS: Readonly<Record<Exclude<StatOp, 'between'>, StatOp>> = {
  '>=': '<',
  '>': '<=',
  '==': '!=',
  '!=': '==',
  '<': '>=',
  '<=': '>',
};

/**
 * The opposite check (`X >= 1` → `X < 1`, `>`↔`<=`, `==`↔`!=`); undefined for `between`, which has no single
 * opposite check (an item outside a range is below it or above it).
 */
export function invertStatCheck(check: StatCheck): StatCheck | undefined {
  const op = check.op ?? DEFAULT_STAT_OP;
  if (op === 'between' || typeof check.value !== 'number') return undefined;
  return { ...check, op: INVERTED_OPS[op] };
}

/**
 * Whether a rule's `<`, `<=` and `!=` item stat checks read as exceptions, from its effective actions (style
 * included): it hides, and not with `hideIfOtherConditionsFail`, which hides an item failing the check through the
 * gate anyway, so an exception there keeps nothing.
 */
export function readsExceptions(actions: Pick<RuleActions, 'hide' | 'hideIfOtherConditionsFail'>): boolean {
  return actions.hide === true && actions.hideIfOtherConditionsFail !== true;
}

/** The ops an exception is written with: the opposites of `>=`, `>` and `==`. */
const EXCEPTION_OPS: readonly StatOp[] = ['<', '<=', '!='];

/**
 * On a hide rule, the exception a stored check stands for (`X < 1` → "unless X ≥ 1"): the opposite of a `<`, `<=` or
 * `!=` check, the ops the "Except items with…" control writes. Other checks read as plain conditions (undefined).
 */
export function exceptionOf(check: StatCheck): StatCheck | undefined {
  return check.op !== undefined && EXCEPTION_OPS.includes(check.op) ? invertStatCheck(check) : undefined;
}

/** The stored check of a new exception "items with the stat ≥ 1": `{ stat, op: '<', value: 1 }`. */
export function newExceptionCheck(stat: string | number): StatCheck {
  return { stat, op: '<', value: 1 };
}

/** Where an exception goes: `any` keeps items with any exception (`itemStats`), `all` only those with all (`itemStatsAnyOf`). */
export type ExceptionMode = 'any' | 'all';

export const EXCEPTION_LIST: Readonly<Record<ExceptionMode, 'itemStats' | 'itemStatsAnyOf'>> = {
  any: 'itemStats',
  all: 'itemStatsAnyOf',
};

/**
 * What a hide rule's stat checks keep out of the hide, read back from the stored lists: `any` = the exceptions in
 * `itemStats` (one is enough to keep an item, since every check there must hold to hide it); `all` = the exceptions in
 * `itemStatsAnyOf` when every check there reads as one (an item is kept only when it has all of them), else empty;
 * `mixedAll` = `itemStatsAnyOf` also has plain checks, so exceptions added there are ORed with them.
 */
export interface RuleExceptions {
  readonly any: readonly StatCheck[];
  readonly all: readonly StatCheck[];
  readonly mixedAll: boolean;
}

function exceptionsIn(checks: readonly StatCheck[] | undefined): StatCheck[] {
  return (checks ?? []).flatMap((check) => {
    const exception = exceptionOf(check);
    return exception === undefined ? [] : [exception];
  });
}

export function ruleExceptions(rule: Pick<LootFilterRule, 'itemStats' | 'itemStatsAnyOf'>): RuleExceptions {
  const anyOf = rule.itemStatsAnyOf ?? [];
  const all = exceptionsIn(anyOf);
  const pure = all.length === anyOf.length;
  return { any: exceptionsIn(rule.itemStats), all: pure ? all : [], mixedAll: !pure && anyOf.length > 0 };
}

/** Whether a stored check reads as an exception on a hide rule (`<`, `<=` or `!=`, see `exceptionOf`). */
export function isExceptionCheck(check: StatCheck): boolean {
  return exceptionOf(check) !== undefined;
}

/** The ops an exception row offers, in its natural form: their opposites (`<`, `<=`, `!=`) are what the file stores. */
export const EXCEPTION_ROW_OPS: readonly StatOp[] = ['>=', '>', '=='];

/** The ops a hide rule's plain item stat rows offer: the others would turn the row into an exception. */
export const PLAIN_HIDE_ROW_OPS: readonly StatOp[] = ['>=', '>', '==', 'between'];

/** An exception row as edited (`Teleport ≥ 1`) → the check the file stores (`Teleport < 1`). */
export function storedException(shown: StatCheck): StatCheck {
  return invertStatCheck(shown) ?? shown;
}

/** A row of a list shown filtered: the check and its position in the full list (where its edits go). */
export interface StatCheckRowRef {
  readonly check: StatCheck;
  readonly index: number;
}

/** The rows of `list` that `shows` keeps, each with its index in the full list. */
export function statCheckRows(list: readonly StatCheck[] | undefined, shows: (check: StatCheck) => boolean): StatCheckRowRef[] {
  return (list ?? []).flatMap((check, index) => (shows(check) ? [{ check, index }] : []));
}

type ItemStatLists = Pick<LootFilterRule, 'itemStats' | 'itemStatsAnyOf'>;

/** A change to the item stat lists (a key set to `undefined` is removed). */
export type ItemStatListsPatch = Partial<Record<keyof ItemStatLists, readonly StatCheck[] | undefined>>;

/**
 * Where a hide rule's exceptions are: `any` (only in `itemStats`), `all` (only in `itemStatsAnyOf`), `both` (a
 * hand-written file with exceptions in both lists), or undefined (none yet).
 */
export function exceptionPlacement(rule: ItemStatLists): ExceptionMode | 'both' | undefined {
  const inAll = rule.itemStats?.some(isExceptionCheck) === true;
  const inAnyOf = rule.itemStatsAnyOf?.some(isExceptionCheck) === true;
  return inAll && inAnyOf ? 'both' : inAll ? 'any' : inAnyOf ? 'all' : undefined;
}

/** How many plain (non-exception) checks a list holds. */
export function plainCheckCount(list: readonly StatCheck[] | undefined): number {
  return (list ?? []).filter((check) => !isExceptionCheck(check)).length;
}

/**
 * Switching "Keep items with any / all of these": every exception of the other list moves to the end of the mode's
 * list (in order), the other list keeps its plain checks (an emptied list is removed). Empty when nothing moves.
 */
export function moveExceptions(rule: ItemStatLists, to: ExceptionMode): ItemStatListsPatch {
  const target = EXCEPTION_LIST[to];
  const source = EXCEPTION_LIST[to === 'any' ? 'all' : 'any'];
  const from = rule[source] ?? [];
  const moving = from.filter(isExceptionCheck);
  if (moving.length === 0) return {};
  const staying = from.filter((check) => !isExceptionCheck(check));
  return { [source]: staying.length === 0 ? undefined : staying, [target]: [...(rule[target] ?? []), ...moving] };
}

/**
 * The stat's plugin quirk (`STAT_QUIRKS`) when the rule's item codes and types can match an affected item (the
 * validator's `mayHitQuirk`; without item data, always).
 */
export function ruleStatQuirk(check: StatCheck, rule: LootFilterRule, reference: LootFilterReference | undefined): StatQuirk | undefined {
  const quirk = statQuirk(check.stat);
  return quirk !== undefined && mayHitQuirk(rule, quirk, reference) ? quirk : undefined;
}

/**
 * `item_numsockets ≥2`, `strength[1] 5–10` (between), `#96 >0` (an unknown id), `? ≥1` (no stat yet); a layered stat's
 * param by name when the data has it: `item_addskill_tab[Martial Arts (Assassin)] ≥1`.
 */
export function formatStatCheck(check: StatCheck, lookup: LootFilterLookup): string {
  const stat =
    typeof check.stat === 'number' ? (lookup.statName(check.stat) ?? `#${String(check.stat)}`) : check.stat === '' ? '?' : check.stat;
  const param = check.param === undefined ? '' : `[${lookup.statParamLabel(check.stat, check.param) ?? String(check.param)}]`;
  const op = check.op ?? DEFAULT_STAT_OP;
  const value = typeof check.value === 'number' ? String(check.value) : `${String(check.value[0])}–${String(check.value[1])}`;
  const shownOp = op === '>=' ? '≥' : op === '<=' ? '≤' : op === 'between' ? '' : op;
  return `${stat}${param} ${shownOp}${value}`.replace(/\s+/g, ' ');
}
