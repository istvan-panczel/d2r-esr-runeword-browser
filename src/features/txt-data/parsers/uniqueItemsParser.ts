import { parseTsv, parseNumber, parseBoolean, type TsvRow } from '@/core/utils';
import type { TxtUniqueItem, TxtProperty, TxtPropertyDef } from '@/core/db';
import { createPropertyTranslator } from '../utils/propertyTranslator';

/** Item codes to exclude from parsing (ore = Uni Ore, ast = Ascendancy Stone) */
const EXCLUDED_ITEM_CODES = new Set(['ore', 'ast']);

/** Property codes to exclude (internal flags not meant for display) */
const EXCLUDED_PROPERTY_CODES = new Set(['tinkerflag', 'tinkerflag2']);

/**
 * Parse uniqueitems.txt to extract unique item definitions
 *
 * @param content - Raw content from uniqueitems.txt
 * @param ancientCouponItems - Set of item names that are obtained via Ancient Coupons
 * @param propertyDefs - Property definitions for pre-translating properties (optional)
 * @returns Array of unique item definitions
 */
export function parseUniqueItemsTxt(
  content: string,
  ancientCouponItems?: Set<string>,
  propertyDefs?: readonly TxtPropertyDef[]
): TxtUniqueItem[] {
  const rows = parseTsv(content);
  const couponSet = ancientCouponItems ?? new Set<string>();
  const translator = propertyDefs ? createPropertyTranslator(propertyDefs) : null;

  return rows
    .filter((row) => row.index && row['*ID'])
    .filter((row) => !EXCLUDED_ITEM_CODES.has(row.code.toLowerCase()))
    .map((row) => {
      const properties = collectItemProperties(row, 12);
      const resolvedProperties = translator ? translator.translateAll(properties).map((p) => p.text) : [];

      return {
        index: row.index,
        id: parseNumber(row['*ID']),
        version: parseNumber(row.version),
        enabled: parseBoolean(row.enabled),
        level: parseNumber(row.lvl),
        levelReq: parseNumber(row['lvl req']),
        itemCode: row.code,
        itemName: row['*ItemName'],
        properties,
        resolvedProperties,
        isAncientCoupon: couponSet.has(row.index),
      };
    });
}

/**
 * Collect properties from prop1-N, par1-N, min1-N, max1-N columns
 */
function collectItemProperties(row: TsvRow, count: number): readonly TxtProperty[] {
  const properties: TxtProperty[] = [];

  for (let i = 1; i <= count; i++) {
    const idx = String(i);
    const code = row[`prop${idx}`];
    if (!code || code.trim() === '') continue;

    const trimmedCode = code.trim();
    // Skip internal properties not meant for display
    if (EXCLUDED_PROPERTY_CODES.has(trimmedCode.toLowerCase())) continue;

    const param = row[`par${idx}`] ?? '';
    properties.push({
      code: trimmedCode,
      param: param.trim(),
      min: parseNumber(row[`min${idx}`]),
      max: parseNumber(row[`max${idx}`]),
    });
  }

  return properties;
}
