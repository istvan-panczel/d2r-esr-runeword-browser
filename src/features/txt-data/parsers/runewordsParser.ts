import { parseTsv, parseNumber, parseBoolean, collectColumnValues, type TsvRow } from '@/core/utils';
import type { TxtRuneword, TxtRuneRef, TxtProperty } from '@/core/db';

/**
 * Parse runes.txt to extract runeword definitions
 *
 * @param content - Raw content from runes.txt
 * @param codeToNameMap - Map from gem code to display name (for resolving rune codes)
 * @returns Array of runeword definitions
 */
export function parseRunewordsTxt(content: string, codeToNameMap: Map<string, string>): TxtRuneword[] {
  const rows = parseTsv(content);

  return rows
    .filter((row) => row.Name && parseBoolean(row.complete))
    .map((row) => ({
      id: row.Name,
      displayName: row['*Rune Name'] || row.Name,
      complete: true,
      itemTypes: collectItemTypes(row),
      excludeTypes: collectExcludeTypes(row),
      runes: collectRunes(row, codeToNameMap),
      properties: collectProperties(row),
    }));
}

/**
 * Collect allowed item types from itype1-6 columns
 */
function collectItemTypes(row: TsvRow): readonly string[] {
  return collectColumnValues(row, 'itype', 6);
}

/**
 * Collect excluded item types from etype1-3 columns
 */
function collectExcludeTypes(row: TsvRow): readonly string[] {
  return collectColumnValues(row, 'etype', 3);
}

/**
 * Collect rune references from Rune1-6 columns
 * Each rune is stored with both code and resolved name
 */
function collectRunes(row: TsvRow, codeToNameMap: Map<string, string>): readonly TxtRuneRef[] {
  const runes: TxtRuneRef[] = [];

  for (let i = 1; i <= 6; i++) {
    const code = row[`Rune${String(i)}`];
    if (!code || code.trim() === '') continue;

    runes.push({
      code: code.trim(),
      name: codeToNameMap.get(code.trim()) ?? code.trim(),
    });
  }

  return runes;
}

/**
 * Collect properties from T1Code1-7, T1Param1-7, T1Min1-7, T1Max1-7 columns
 */
function collectProperties(row: TsvRow): readonly TxtProperty[] {
  const properties: TxtProperty[] = [];

  for (let i = 1; i <= 7; i++) {
    const code = row[`T1Code${String(i)}`];
    if (!code || code.trim() === '') continue;

    const param = row[`T1Param${String(i)}`] ?? '';
    properties.push({
      code: code.trim(),
      param: param.trim(),
      min: parseNumber(row[`T1Min${String(i)}`]),
      max: parseNumber(row[`T1Max${String(i)}`]),
    });
  }

  return properties;
}
