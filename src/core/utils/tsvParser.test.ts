import { describe, it, expect } from 'vitest';
import { parseTsv, parseNumber, parseBoolean, collectColumnValues, getTsvHeaders, type TsvRow } from './tsvParser';

describe('tsvParser', () => {
  describe('parseTsv', () => {
    it('should parse simple TSV content', () => {
      const content = 'name\tcode\nChipped Diamond\tgcw\nFlawed Diamond\tgfw';
      const rows = parseTsv(content);

      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Chipped Diamond');
      expect(rows[0].code).toBe('gcw');
      expect(rows[1].name).toBe('Flawed Diamond');
      expect(rows[1].code).toBe('gfw');
    });

    it('should handle empty cells', () => {
      const content = 'col1\tcol2\tcol3\nvalue1\t\tvalue3';
      const rows = parseTsv(content);

      expect(rows).toHaveLength(1);
      expect(rows[0].col1).toBe('value1');
      expect(rows[0].col2).toBe('');
      expect(rows[0].col3).toBe('value3');
    });

    it('should skip Expansion marker rows', () => {
      const content = 'name\tcode\nItem1\ti1\nExpansion\nItem2\ti2';
      const rows = parseTsv(content);

      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Item1');
      expect(rows[1].name).toBe('Item2');
    });

    it('should return empty array for empty content', () => {
      expect(parseTsv('')).toEqual([]);
      expect(parseTsv('header\t')).toEqual([]);
    });

    it('should handle content with only header', () => {
      const content = 'name\tcode';
      const rows = parseTsv(content);

      expect(rows).toEqual([]);
    });

    it('should trim whitespace from values', () => {
      const content = 'name\tcode\n  Spaced Name  \t  spaced_code  ';
      const rows = parseTsv(content);

      expect(rows[0].name).toBe('Spaced Name');
      expect(rows[0].code).toBe('spaced_code');
    });
  });

  describe('parseNumber', () => {
    it('should parse valid numbers', () => {
      expect(parseNumber('123')).toBe(123);
      expect(parseNumber('0')).toBe(0);
      expect(parseNumber('-5')).toBe(-5);
    });

    it('should return 0 for empty/invalid values', () => {
      expect(parseNumber('')).toBe(0);
      expect(parseNumber(undefined)).toBe(0);
      expect(parseNumber('abc')).toBe(0);
    });
  });

  describe('parseBoolean', () => {
    it('should parse truthy values', () => {
      expect(parseBoolean('1')).toBe(true);
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
    });

    it('should parse falsy values', () => {
      expect(parseBoolean('0')).toBe(false);
      expect(parseBoolean('')).toBe(false);
      expect(parseBoolean(undefined)).toBe(false);
      expect(parseBoolean('false')).toBe(false);
    });
  });

  describe('collectColumnValues', () => {
    it('should collect numbered column values', () => {
      const row: TsvRow = {
        Rune1: 'gcw',
        Rune2: 'gfw',
        Rune3: '',
        Rune4: 'gsw',
      };

      const values = collectColumnValues(row, 'Rune', 4);
      expect(values).toEqual(['gcw', 'gfw', 'gsw']);
    });

    it('should handle missing columns', () => {
      const row: TsvRow = {
        Item1: 'a',
      };

      const values = collectColumnValues(row, 'Item', 3);
      expect(values).toEqual(['a']);
    });
  });

  describe('getTsvHeaders', () => {
    it('should extract headers from content', () => {
      const content = 'name\tcode\tlevel\ndata';
      const headers = getTsvHeaders(content);

      expect(headers).toEqual(['name', 'code', 'level']);
    });

    it('should return empty array for empty content', () => {
      expect(getTsvHeaders('')).toEqual([]);
    });
  });
});
