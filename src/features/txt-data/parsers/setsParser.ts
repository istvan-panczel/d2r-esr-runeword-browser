import { parseTsv, parseNumber, type TsvRow } from '@/core/utils';
import type { TxtSet, TxtPartialBonus, TxtProperty } from '@/core/db';

/**
 * Parse sets.txt to extract set definitions
 *
 * @param content - Raw content from sets.txt
 * @returns Array of set definitions
 */
export function parseSetsTxt(content: string): TxtSet[] {
  const rows = parseTsv(content);

  return rows
    .filter((row) => row.index && row.name)
    .map((row) => ({
      index: row.index,
      name: row.name,
      partialBonuses: collectPartialBonuses(row),
      fullSetBonuses: collectFullSetBonuses(row),
    }));
}

/**
 * Collect partial set bonuses from PCode2a-5b columns
 * Each number (2-5) represents how many items must be equipped
 */
function collectPartialBonuses(row: TsvRow): readonly TxtPartialBonus[] {
  const bonuses: TxtPartialBonus[] = [];

  for (let itemCount = 2; itemCount <= 5; itemCount++) {
    const properties: TxtProperty[] = [];
    const countStr = String(itemCount);

    // Each item count has 'a' and 'b' variants
    for (const suffix of ['a', 'b']) {
      const code = row[`PCode${countStr}${suffix}`];
      if (!code || code.trim() === '') continue;

      const param = row[`PParam${countStr}${suffix}`] ?? '';
      properties.push({
        code: code.trim(),
        param: param.trim(),
        min: parseNumber(row[`PMin${countStr}${suffix}`]),
        max: parseNumber(row[`PMax${countStr}${suffix}`]),
      });
    }

    if (properties.length > 0) {
      bonuses.push({ itemCount, properties });
    }
  }

  return bonuses;
}

/**
 * Collect full set bonuses from FCode1-8 columns
 */
function collectFullSetBonuses(row: TsvRow): readonly TxtProperty[] {
  const properties: TxtProperty[] = [];

  for (let i = 1; i <= 8; i++) {
    const idx = String(i);
    const code = row[`FCode${idx}`];
    if (!code || code.trim() === '') continue;

    const param = row[`FParam${idx}`] ?? '';
    properties.push({
      code: code.trim(),
      param: param.trim(),
      min: parseNumber(row[`FMin${idx}`]),
      max: parseNumber(row[`FMax${idx}`]),
    });
  }

  return properties;
}
