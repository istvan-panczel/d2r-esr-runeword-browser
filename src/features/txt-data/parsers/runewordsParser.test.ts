import { describe, it, expect } from 'vitest';
import { parseRunewordsTxt } from './runewordsParser';

describe('runewordsParser', () => {
  // Create a mock code-to-name map for testing
  const codeToNameMap = new Map([
    ['r01', 'El Rune'],
    ['r02', 'Eld Rune'],
    ['r03', 'Tir Rune'],
    ['r04', 'Nef Rune'],
    ['r05', 'Eth Rune'],
    ['gcv', 'Chipped Amethyst'],
    ['gcw', 'Chipped Diamond'],
  ]);

  describe('parseRunewordsTxt', () => {
    it('should parse basic runeword with name and display name', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tRune2
Runeword1\tHoly\t1\tshie\tr01\tr02`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('Runeword1');
      expect(result[0].displayName).toBe('Holy');
      expect(result[0].complete).toBe(true);
    });

    it('should resolve rune codes to names', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tRune2\tRune3
Runeword1\tSteel\t1\tweap\tr03\tr02\tr01`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].runes).toHaveLength(3);
      expect(result[0].runes[0]).toEqual({ code: 'r03', name: 'Tir Rune' });
      expect(result[0].runes[1]).toEqual({ code: 'r02', name: 'Eld Rune' });
      expect(result[0].runes[2]).toEqual({ code: 'r01', name: 'El Rune' });
    });

    it('should keep original code if name not found in map', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1
Runeword1\tTest\t1\tweap\tunknown`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].runes[0]).toEqual({ code: 'unknown', name: 'unknown' });
    });

    it('should collect item types from itype1-6', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\titype2\titype3\tRune1
Runeword1\tTest\t1\ttors\tshie\thelm\tr01`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].itemTypes).toEqual(['tors', 'shie', 'helm']);
    });

    it('should collect exclude types from etype1-3', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tetype1\tetype2\tRune1
Runeword1\tTest\t1\tweap\torbs\tstaf\tr01`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].excludeTypes).toEqual(['orbs', 'staf']);
    });

    it('should collect properties from T1Code/Param/Min/Max columns', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tT1Code1\tT1Param1\tT1Min1\tT1Max1\tT1Code2\tT1Param2\tT1Min2\tT1Max2
Runeword1\tTest\t1\tweap\tr01\tstr\t\t10\t15\tallskills\t\t2\t2`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].properties).toHaveLength(2);
      expect(result[0].properties[0]).toEqual({
        code: 'str',
        param: '',
        min: 10,
        max: 15,
      });
      expect(result[0].properties[1]).toEqual({
        code: 'allskills',
        param: '',
        min: 2,
        max: 2,
      });
    });

    it('should handle properties with parameters (skill names)', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tT1Code1\tT1Param1\tT1Min1\tT1Max1
Runeword1\tTest\t1\tweap\tr01\toskill\tTeleport\t1\t1`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].properties[0]).toEqual({
        code: 'oskill',
        param: 'Teleport',
        min: 1,
        max: 1,
      });
    });

    it('should filter out incomplete runewords (complete=0)', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1
Runeword1\tActive\t1\tweap\tr01
Runeword2\tInactive\t0\tweap\tr02`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Active');
    });

    it('should filter out rows without Name', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1
Runeword1\tTest\t1\tweap\tr01
\tNoName\t1\tweap\tr02`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result).toHaveLength(1);
    });

    it('should use Name as displayName if *Rune Name is missing', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1
Runeword1\t\t1\tweap\tr01`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].displayName).toBe('Runeword1');
    });

    it('should handle gemwords (runewords using gems)', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tRune2
Gemword1\tGemTest\t1\tweap\tgcv\tgcw`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].runes).toHaveLength(2);
      expect(result[0].runes[0]).toEqual({ code: 'gcv', name: 'Chipped Amethyst' });
      expect(result[0].runes[1]).toEqual({ code: 'gcw', name: 'Chipped Diamond' });
    });

    it('should handle up to 6 runes', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tRune2\tRune3\tRune4\tRune5\tRune6
Runeword1\tLong\t1\tweap\tr01\tr02\tr03\tr04\tr05\tr01`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].runes).toHaveLength(6);
    });

    it('should handle up to 7 properties', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tT1Code1\tT1Min1\tT1Max1\tT1Code2\tT1Min2\tT1Max2\tT1Code3\tT1Min3\tT1Max3\tT1Code4\tT1Min4\tT1Max4\tT1Code5\tT1Min5\tT1Max5\tT1Code6\tT1Min6\tT1Max6\tT1Code7\tT1Min7\tT1Max7
Runeword1\tMany\t1\tweap\tr01\tp1\t1\t1\tp2\t2\t2\tp3\t3\t3\tp4\t4\t4\tp5\t5\t5\tp6\t6\t6\tp7\t7\t7`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].properties).toHaveLength(7);
    });

    it('should skip empty rune slots', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tRune2\tRune3
Runeword1\tTest\t1\tweap\tr01\t\tr03`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].runes).toHaveLength(2);
      expect(result[0].runes[0].code).toBe('r01');
      expect(result[0].runes[1].code).toBe('r03');
    });

    it('should handle empty content', () => {
      const result = parseRunewordsTxt('', codeToNameMap);
      expect(result).toHaveLength(0);
    });

    it('should trim whitespace from codes and params', () => {
      const content = `Name\t*Rune Name\tcomplete\titype1\tRune1\tT1Code1\tT1Param1\tT1Min1\tT1Max1
Runeword1\tTest\t1\tweap\t r01 \t str \t param \t10\t10`;

      const result = parseRunewordsTxt(content, codeToNameMap);

      expect(result[0].runes[0].code).toBe('r01');
      expect(result[0].properties[0].code).toBe('str');
      expect(result[0].properties[0].param).toBe('param');
    });
  });
});
