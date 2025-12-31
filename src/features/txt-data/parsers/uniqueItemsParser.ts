import { parseTsv, parseNumber, parseBoolean, type TsvRow } from '@/core/utils';
import type { TxtUniqueItem, TxtProperty, TxtPropertyDef, TxtSkill, TxtMonster, TxtItemType, ItemTier } from '@/core/db';
import { createPropertyTranslator } from '../utils/propertyTranslator';

/** Item codes to exclude from parsing (ore = Uni Ore, ast = Ascendancy Stone) */
const EXCLUDED_ITEM_CODES = new Set(['ore', 'ast']);

/** Item names to exclude from parsing (special mod items not meant for display) */
const EXCLUDED_ITEM_NAMES = new Set(['Damage Augmenter', 'Kill Ledger', 'Randomizing Stone']);

/** Property codes to exclude (internal flags not meant for display) */
const EXCLUDED_PROPERTY_CODES = new Set(['tinkerflag', 'tinkerflag2']);

/**
 * Parse uniqueitems.txt to extract unique item definitions
 *
 * @param content - Raw content from uniqueitems.txt
 * @param ancientCouponItems - Set of item names that are obtained via Ancient Coupons
 * @param propertyDefs - Property definitions for pre-translating properties (optional)
 * @param skills - Skill definitions for class name lookup in translations (optional)
 * @param monsters - Monster definitions for reanimate property translation (optional)
 * @param itemTypes - Item type definitions for tier lookup (optional)
 * @returns Array of unique item definitions
 */
export function parseUniqueItemsTxt(
  content: string,
  ancientCouponItems?: Set<string>,
  propertyDefs?: readonly TxtPropertyDef[],
  skills?: readonly TxtSkill[],
  monsters?: readonly TxtMonster[],
  itemTypes?: readonly TxtItemType[]
): TxtUniqueItem[] {
  const rows = parseTsv(content);
  const couponSet = ancientCouponItems ?? new Set<string>();
  const translator = propertyDefs ? createPropertyTranslator(propertyDefs, skills, monsters) : null;
  // Build a map from item code to tier for quick lookup
  const tierMap = new Map<string, ItemTier>(itemTypes?.map((it) => [it.code, it.tier]) ?? []);

  return rows
    .filter((row) => row.index && row['*ID'])
    .filter((row) => !EXCLUDED_ITEM_CODES.has(row.code.toLowerCase()))
    .filter((row) => !EXCLUDED_ITEM_NAMES.has(row.index))
    .map((row) => {
      const properties = collectItemProperties(row, 12);
      const resolvedProperties = translator ? translator.translateAll(properties).map((p) => p.text) : [];
      const itemCode = row.code;
      const itemTier = tierMap.get(itemCode.toLowerCase()) ?? '';

      return {
        index: row.index,
        id: parseNumber(row['*ID']),
        version: parseNumber(row.version),
        enabled: parseBoolean(row.enabled),
        level: parseNumber(row.lvl),
        levelReq: parseNumber(row['lvl req']),
        itemCode,
        itemName: row['*ItemName'],
        itemTier,
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
