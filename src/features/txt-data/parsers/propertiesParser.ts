import { parseTsv } from '@/core/utils';
import type { TxtPropertyDef } from '@/core/db';

/**
 * Parse properties.txt to extract property definitions
 * Used for translating property codes to human-readable text
 *
 * @param content - Raw content from properties.txt
 * @returns Array of property definitions
 */
export function parsePropertiesTxt(content: string): TxtPropertyDef[] {
  const rows = parseTsv(content);

  return rows
    .filter((row) => row.code && row['*Tooltip'])
    .map((row) => ({
      code: row.code,
      tooltip: row['*Tooltip'],
      parameter: row['*Parameter'] ?? '',
    }));
}

/**
 * Build a lookup map from property code to tooltip text
 */
export function buildPropertyMap(properties: readonly TxtPropertyDef[]): Map<string, TxtPropertyDef> {
  return new Map(properties.map((p) => [p.code, p]));
}
