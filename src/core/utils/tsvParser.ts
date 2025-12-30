/**
 * Generic TSV (Tab-Separated Values) parser for Diablo 2 TXT files
 */

/**
 * Interface for a parsed TSV row with dynamic columns
 */
export interface TsvRow {
  readonly [column: string]: string;
}

/**
 * Parse TSV content into an array of row objects
 *
 * @param content - Raw TSV string content
 * @returns Array of objects where keys are column headers
 *
 * @example
 * ```typescript
 * const content = "name\tcode\nChipped Diamond\tgcw";
 * const rows = parseTsv(content);
 * // [{ name: "Chipped Diamond", code: "gcw" }]
 * ```
 */
export function parseTsv(content: string): TsvRow[] {
  const lines = content.split('\n').filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    return []; // Need at least header + one data row
  }

  const headers = lines[0].split('\t');

  return lines
    .slice(1)
    .filter((line) => !isMarkerRow(line))
    .map((line) => {
      const values = line.split('\t');
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() ?? '';
      });

      return row;
    });
}

/**
 * Check if a row is a marker row that should be skipped
 * (e.g., "Expansion" markers in D2 TXT files)
 */
function isMarkerRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('Expansion') || trimmed === '';
}

/**
 * Parse a string value to number, returning 0 for empty/invalid values
 */
export function parseNumber(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 0;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse a string value to boolean (treats '1' and 'true' as true)
 */
export function parseBoolean(value: string | undefined): boolean {
  if (value === undefined || value === '') {
    return false;
  }
  return value === '1' || value.toLowerCase() === 'true';
}

/**
 * Collect non-empty values from numbered columns (e.g., Rune1, Rune2, Rune3...)
 */
export function collectColumnValues(row: TsvRow, prefix: string, count: number): readonly string[] {
  const values: string[] = [];
  for (let i = 1; i <= count; i++) {
    const value = row[`${prefix}${String(i)}`];
    if (value && value.trim() !== '') {
      values.push(value.trim());
    }
  }
  return values;
}

/**
 * Get column headers from TSV content
 */
export function getTsvHeaders(content: string): readonly string[] {
  const firstLine = content.split('\n')[0];
  if (!firstLine) {
    return [];
  }
  return firstLine.split('\t');
}
