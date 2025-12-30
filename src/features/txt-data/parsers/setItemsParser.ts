import { parseTsv, parseNumber, type TsvRow } from '@/core/utils';
import type { TxtSetItem, TxtSetItemBonus, TxtProperty } from '@/core/db';

/**
 * Parse setitems.txt to extract set item definitions
 *
 * @param content - Raw content from setitems.txt
 * @returns Array of set item definitions
 */
export function parseSetItemsTxt(content: string): TxtSetItem[] {
  const rows = parseTsv(content);

  return rows
    .filter((row) => row.index && row['*ID'])
    .map((row) => ({
      index: row.index,
      id: parseNumber(row['*ID']),
      setName: row.set,
      itemCode: row.item,
      itemName: row['*item'],
      level: parseNumber(row.lvl),
      levelReq: parseNumber(row['lvl req']),
      properties: collectSetItemProperties(row, 9),
      partialBonuses: collectSetItemPartialBonuses(row),
    }));
}

/**
 * Collect base properties from prop1-N, par1-N, min1-N, max1-N columns
 */
function collectSetItemProperties(row: TsvRow, count: number): readonly TxtProperty[] {
  const properties: TxtProperty[] = [];

  for (let i = 1; i <= count; i++) {
    const idx = String(i);
    const code = row[`prop${idx}`];
    if (!code || code.trim() === '') continue;

    const param = row[`par${idx}`] ?? '';
    properties.push({
      code: code.trim(),
      param: param.trim(),
      min: parseNumber(row[`min${idx}`]),
      max: parseNumber(row[`max${idx}`]),
    });
  }

  return properties;
}

/**
 * Collect partial set bonuses from aprop1a-5b columns
 * These bonuses activate when more set items are equipped
 */
function collectSetItemPartialBonuses(row: TsvRow): readonly TxtSetItemBonus[] {
  const bonuses: TxtSetItemBonus[] = [];

  for (let slot = 1; slot <= 5; slot++) {
    const slotStr = String(slot);
    const codeA = row[`aprop${slotStr}a`];
    const codeB = row[`aprop${slotStr}b`];

    // Skip if neither property exists
    if ((!codeA || codeA.trim() === '') && (!codeB || codeB.trim() === '')) {
      continue;
    }

    const paramA = row[`apar${slotStr}a`] ?? '';
    const propertyA: TxtProperty | null =
      codeA && codeA.trim() !== ''
        ? {
            code: codeA.trim(),
            param: paramA.trim(),
            min: parseNumber(row[`amin${slotStr}a`]),
            max: parseNumber(row[`amax${slotStr}a`]),
          }
        : null;

    const paramB = row[`apar${slotStr}b`] ?? '';
    const propertyB: TxtProperty | null =
      codeB && codeB.trim() !== ''
        ? {
            code: codeB.trim(),
            param: paramB.trim(),
            min: parseNumber(row[`amin${slotStr}b`]),
            max: parseNumber(row[`amax${slotStr}b`]),
          }
        : null;

    bonuses.push({ slot, propertyA, propertyB });
  }

  return bonuses;
}
