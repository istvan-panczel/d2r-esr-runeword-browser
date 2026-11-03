/**
 * URL state helpers shared by the stash pages: each page reads its state from the search params (invalid values fall
 * back to the defaults, so an old or hand-edited link still opens) and writes back only what differs from the
 * defaults. The page hook is hooks/useUrlState.ts.
 */
import { MAX_PAGE } from './locations';

export type SortDir = 'asc' | 'desc';

export const isOneOf = <T extends string>(values: readonly T[], value: string | null): value is T =>
  values.some((entry) => entry === value);

/** `values` member or `fallback` */
export function readEnum<T extends string>(params: URLSearchParams, key: string, values: readonly T[], fallback: T): T {
  const value = params.get(key);
  return isOneOf(values, value) ? value : fallback;
}

/** A non-empty string or null */
export function readText(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value === null || value === '' ? null : value;
}

/** An in-game page (1–1000) or null */
export function readPage(params: URLSearchParams, key: string): number | null {
  const page = Number(params.get(key));
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : null;
}

/** `1` → true */
export function readFlag(params: URLSearchParams, key: string): boolean {
  return params.get(key) === '1';
}

export function readSortDir(params: URLSearchParams, key: string): SortDir {
  return params.get(key) === 'desc' ? 'desc' : 'asc';
}

/** Sets `key` when `value` is not null / empty / false; a flag is written as `1` */
export function setParam(params: URLSearchParams, key: string, value: string | number | boolean | null): void {
  if (value === null || value === false || value === '') return;
  params.set(key, value === true ? '1' : String(value));
}

/** Writes sort and direction together, and only when either differs from the default */
export function setSort<K extends string>(
  params: URLSearchParams,
  keys: { readonly sort: string; readonly dir: string },
  state: { readonly sort: K; readonly dir: SortDir },
  defaults: { readonly sort: K; readonly dir: SortDir }
): void {
  if (state.sort === defaults.sort && state.dir === defaults.dir) return;
  params.set(keys.sort, state.sort);
  params.set(keys.dir, state.dir);
}
