import { parseTsv, type TsvRow } from '@/core/utils';
import type { TxtItemType, ItemTier } from '@/core/db';

/**
 * Determine item tier based on code comparison with normcode/ubercode/ultracode
 * - norm: code matches normcode (normal base item)
 * - exc: code matches ubercode (exceptional base item)
 * - elite: code matches ultracode (elite base item)
 */
function determineItemTier(row: TsvRow): ItemTier {
  const code = row['code'].trim().toLowerCase();
  // These columns may not exist in test data or some rows
  const normcode = (row['normcode'] ?? '').trim().toLowerCase();
  const ubercode = (row['ubercode'] ?? '').trim().toLowerCase();
  const ultracode = (row['ultracode'] ?? '').trim().toLowerCase();

  if (code && code === ultracode) return 'elite';
  if (code && code === ubercode) return 'exc';
  if (code && code === normcode) return 'norm';
  return '';
}

/**
 * Parse weapons.txt, armor.txt, and misc.txt to extract item type mappings.
 * Maps item codes to their type codes for categorization.
 *
 * @param weaponsContent - Raw content from weapons.txt
 * @param armorContent - Raw content from armor.txt
 * @param miscContent - Raw content from misc.txt
 * @returns Array of item type mappings
 */
export function parseItemTypesTxt(weaponsContent: string, armorContent: string, miscContent: string): TxtItemType[] {
  const itemTypes: TxtItemType[] = [];
  const seenCodes = new Set<string>();

  // Parse weapons.txt - columns include: name, type, code, normcode, ubercode, ultracode
  const weapons = parseTsv(weaponsContent);
  for (const row of weapons) {
    const code = row['code'].trim().toLowerCase();
    const type = row['type'].trim().toLowerCase();
    const name = row['name'].trim();
    const tier = determineItemTier(row);

    if (code && type && !seenCodes.has(code)) {
      seenCodes.add(code);
      itemTypes.push({ code, type, name, tier });
    }
  }

  // Parse armor.txt - columns include: name, code, type, normcode, ubercode, ultracode
  const armors = parseTsv(armorContent);
  for (const row of armors) {
    const code = row['code'].trim().toLowerCase();
    const type = row['type'].trim().toLowerCase();
    const name = row['name'].trim();
    const tier = determineItemTier(row);

    if (code && type && !seenCodes.has(code)) {
      seenCodes.add(code);
      itemTypes.push({ code, type, name, tier });
    }
  }

  // Parse misc.txt - columns include: name, code, type, normcode, ubercode, ultracode
  const misc = parseTsv(miscContent);
  for (const row of misc) {
    const code = row['code'].trim().toLowerCase();
    const type = row['type'].trim().toLowerCase();
    const name = row['name'].trim();
    const tier = determineItemTier(row);

    if (code && type && !seenCodes.has(code)) {
      seenCodes.add(code);
      itemTypes.push({ code, type, name, tier });
    }
  }

  return itemTypes;
}
