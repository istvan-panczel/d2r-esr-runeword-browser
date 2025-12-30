import { parseTsv, parseNumber, type TsvRow } from '@/core/utils';
import type { TxtSocketable, TxtSocketableMod } from '@/core/db';

/**
 * Parse gems.txt to extract socketable definitions
 *
 * @param content - Raw content from gems.txt
 * @returns Array of socketable items
 */
export function parseSocketablesTxt(content: string): TxtSocketable[] {
  const rows = parseTsv(content);

  return rows
    .filter((row) => row.name && row.code)
    .map((row) => ({
      name: row.name,
      code: row.code,
      letter: row.letter,
      weaponMods: parseModifiers(row, 'weapon'),
      helmMods: parseModifiers(row, 'helm'),
      shieldMods: parseModifiers(row, 'shield'),
    }));
}

/**
 * Parse modifier columns for a specific slot type (weapon/helm/shield)
 */
function parseModifiers(row: TsvRow, prefix: string): TxtSocketableMod[] {
  const mods: TxtSocketableMod[] = [];

  for (let i = 1; i <= 3; i++) {
    const idx = String(i);
    const code = row[`${prefix}Mod${idx}Code`];
    if (!code) continue;

    const param = row[`${prefix}Mod${idx}Param`] ?? '';
    mods.push({
      code,
      param,
      min: parseNumber(row[`${prefix}Mod${idx}Min`]),
      max: parseNumber(row[`${prefix}Mod${idx}Max`]),
    });
  }

  return mods;
}

/**
 * Build a lookup map from gem code to name
 * Used for resolving rune codes in runewords
 */
export function buildCodeToNameMap(socketables: readonly TxtSocketable[]): Map<string, string> {
  return new Map(socketables.map((s) => [s.code, s.name]));
}
