import { isClassCode } from '../engine/schema';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import { CHARACTER_LEVEL_RANGE, CHARACTER_STAT_RANGE, DEFAULT_CHARACTER, type Character } from './character';
import type { RunewordRef } from './gameDataSlice';

/** Every URL param the Best Base page reads. */
export const BEST_BASE_PARAM_KEYS: readonly string[] = [
  GAME_DATA_URL_PARAM_KEYS.RW,
  GAME_DATA_URL_PARAM_KEYS.VARIANT,
  GAME_DATA_URL_PARAM_KEYS.CLS,
  GAME_DATA_URL_PARAM_KEYS.LVL,
  GAME_DATA_URL_PARAM_KEYS.STR,
  GAME_DATA_URL_PARAM_KEYS.DEX,
];

export function hasBestBaseParams(params: URLSearchParams): boolean {
  return BEST_BASE_PARAM_KEYS.some((key) => params.has(key));
}

export interface BestBaseUrlState {
  /** Null when `rw` is absent */
  readonly selected: RunewordRef | null;
  /** Only the character fields present (and valid) in the URL */
  readonly character: Partial<Character>;
}

function parseIntIn(value: string | null, range: { readonly min: number; readonly max: number }): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= range.min && parsed <= range.max ? parsed : undefined;
}

/** Decodes `rw`, `v` (default 1), `cls` (`any` or a class code), `lvl` (1–110), `str` / `dex` (0–999); invalid values are ignored. */
export function decodeBestBaseParams(params: URLSearchParams): BestBaseUrlState {
  const name = params.get(GAME_DATA_URL_PARAM_KEYS.RW)?.trim() ?? '';
  const variant = parseIntIn(params.get(GAME_DATA_URL_PARAM_KEYS.VARIANT), { min: 1, max: 99 }) ?? 1;
  const cls = params.get(GAME_DATA_URL_PARAM_KEYS.CLS);

  const character: { -readonly [K in keyof Character]?: Character[K] } = {};
  if (cls !== null && (cls === 'any' || isClassCode(cls))) character.cls = cls;
  const level = parseIntIn(params.get(GAME_DATA_URL_PARAM_KEYS.LVL), CHARACTER_LEVEL_RANGE);
  if (level !== undefined) character.level = level;
  const str = parseIntIn(params.get(GAME_DATA_URL_PARAM_KEYS.STR), CHARACTER_STAT_RANGE);
  if (str !== undefined) character.str = str;
  const dex = parseIntIn(params.get(GAME_DATA_URL_PARAM_KEYS.DEX), CHARACTER_STAT_RANGE);
  if (dex !== undefined) character.dex = dex;

  return { selected: name === '' ? null : { name, variant }, character };
}

/** Share URL params: the selected runeword plus the character fields that differ from the defaults. */
export function encodeBestBaseParams(selected: RunewordRef | null, character: Character): URLSearchParams {
  const params = new URLSearchParams();
  if (selected !== null) {
    params.set(GAME_DATA_URL_PARAM_KEYS.RW, selected.name);
    params.set(GAME_DATA_URL_PARAM_KEYS.VARIANT, String(selected.variant));
  }
  if (character.cls !== DEFAULT_CHARACTER.cls) params.set(GAME_DATA_URL_PARAM_KEYS.CLS, character.cls);
  if (character.level !== DEFAULT_CHARACTER.level) params.set(GAME_DATA_URL_PARAM_KEYS.LVL, String(character.level));
  if (character.str !== DEFAULT_CHARACTER.str) params.set(GAME_DATA_URL_PARAM_KEYS.STR, String(character.str));
  if (character.dex !== DEFAULT_CHARACTER.dex) params.set(GAME_DATA_URL_PARAM_KEYS.DEX, String(character.dex));
  return params;
}
