/** Helpers for the rule editor's stat check rows (`itemStats`, `itemStatsAnyOf`, `playerStats`, `playerStatsAnyOf`). */
import type { LootFilterRule, RuleActions, StatCheck, StatOp } from '../engine/types';
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
