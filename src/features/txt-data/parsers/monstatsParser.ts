import { parseTsv, parseNumber } from '@/core/utils';
import type { TxtMonster } from '@/core/db';

/**
 * Parse monstats.txt to extract monster ID to name mappings
 * Used for translating reanimate properties (monster ID → display name)
 *
 * @param content - Raw content from monstats.txt
 * @returns Array of monster definitions
 */
export function parseMonstatsTxt(content: string): TxtMonster[] {
  const rows = parseTsv(content);

  return rows
    .filter((row) => row['*hcIdx'] && row.NameStr) // Only rows with valid ID and name
    .map((row) => ({
      hcIdx: parseNumber(row['*hcIdx']),
      nameStr: row.NameStr,
    }))
    .filter((monster) => monster.hcIdx > 0); // Filter out invalid IDs
}

/**
 * Build a lookup map from monster ID to display name
 */
export function buildMonsterNameMap(monsters: readonly TxtMonster[]): Map<number, string> {
  return new Map(monsters.map((m) => [m.hcIdx, m.nameStr]));
}
