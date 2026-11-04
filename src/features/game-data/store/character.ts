import { isClassCode } from '../engine/schema';
import type { Character } from '../engine/bestBase';

export type { Character };

/** localStorage key of the persisted character (Best Base page). */
export const CHARACTER_STORAGE_KEY = 'gameData.character';

/** Character level 1–110: ESR raises the cap to 110 (skills.json `maxLevel`; runtimeConstants.test.ts pins it). */
export const CHARACTER_LEVEL_RANGE = { min: 1, max: 110 } as const;
export const CHARACTER_STAT_RANGE = { min: 0, max: 999 } as const;

export const DEFAULT_CHARACTER: Character = { cls: 'any', level: CHARACTER_LEVEL_RANGE.max, str: 100, dex: 100 };

function isIntIn(value: unknown, range: { readonly min: number; readonly max: number }): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max;
}

/** Validator for the persisted character (`readPersistentJson`). */
export function isCharacter(value: unknown): value is Character {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.cls === 'any' || (typeof record.cls === 'string' && isClassCode(record.cls))) &&
    isIntIn(record.level, CHARACTER_LEVEL_RANGE) &&
    isIntIn(record.str, CHARACTER_STAT_RANGE) &&
    isIntIn(record.dex, CHARACTER_STAT_RANGE)
  );
}

function clamp(value: number, range: { readonly min: number; readonly max: number }): number {
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/** Character with `patch` applied, numbers rounded and clamped to their ranges. */
export function patchCharacter(character: Character, patch: Partial<Character>): Character {
  return {
    cls: patch.cls ?? character.cls,
    level: clamp(patch.level ?? character.level, CHARACTER_LEVEL_RANGE),
    str: clamp(patch.str ?? character.str, CHARACTER_STAT_RANGE),
    dex: clamp(patch.dex ?? character.dex, CHARACTER_STAT_RANGE),
  };
}
