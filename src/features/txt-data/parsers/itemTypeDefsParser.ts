import { parseTsv } from '@/core/utils';
import type { TxtItemTypeDef } from '@/core/db';

/**
 * Parse itemtypes.txt to extract item type definitions
 * These definitions establish the type hierarchy and categorization
 *
 * @param content - Raw content from itemtypes.txt
 * @returns Array of item type definitions
 */
export function parseItemTypeDefsTxt(content: string): TxtItemTypeDef[] {
  const rows = parseTsv(content);
  const itemTypeDefs: TxtItemTypeDef[] = [];

  for (const row of rows) {
    const code = row['Code'].trim().toLowerCase();
    const name = row['ItemType'].trim();

    // Skip rows without a valid code
    if (!code || code === 'none' || code === 'xxx') continue;

    const equiv1 = row['Equiv1'].trim().toLowerCase();
    const equiv2 = row['Equiv2'].trim().toLowerCase();
    const storePage = row['StorePage'].trim().toLowerCase();

    itemTypeDefs.push({
      code,
      name,
      equiv1,
      equiv2,
      storePage,
    });
  }

  return itemTypeDefs;
}
