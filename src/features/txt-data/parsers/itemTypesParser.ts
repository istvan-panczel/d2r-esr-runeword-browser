import { parseTsv } from '@/core/utils';
import type { TxtItemType } from '@/core/db';

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

  // Parse weapons.txt - columns include: name, type, code
  const weapons = parseTsv(weaponsContent);
  for (const row of weapons) {
    const code = row['code'].trim().toLowerCase();
    const type = row['type'].trim().toLowerCase();
    const name = row['name'].trim();

    if (code && type && !seenCodes.has(code)) {
      seenCodes.add(code);
      itemTypes.push({ code, type, name });
    }
  }

  // Parse armor.txt - columns include: name, code, type
  const armors = parseTsv(armorContent);
  for (const row of armors) {
    const code = row['code'].trim().toLowerCase();
    const type = row['type'].trim().toLowerCase();
    const name = row['name'].trim();

    if (code && type && !seenCodes.has(code)) {
      seenCodes.add(code);
      itemTypes.push({ code, type, name });
    }
  }

  // Parse misc.txt - columns include: name, code, type
  const misc = parseTsv(miscContent);
  for (const row of misc) {
    const code = row['code'].trim().toLowerCase();
    const type = row['type'].trim().toLowerCase();
    const name = row['name'].trim();

    if (code && type && !seenCodes.has(code)) {
      seenCodes.add(code);
      itemTypes.push({ code, type, name });
    }
  }

  return itemTypes;
}
