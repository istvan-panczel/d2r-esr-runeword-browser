import { describe, it, expect } from 'vitest';
import { parseSetsTxt } from './setsParser';

describe('setsParser', () => {
  describe('parseSetsTxt', () => {
    it('should parse basic set with index and name', () => {
      const content = `index\tname\tversion
1\tAngelic Raiment\t100`;

      const result = parseSetsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        index: '1',
        name: 'Angelic Raiment',
      });
    });

    it('should parse partial set bonuses (2-5 items)', () => {
      const content = `index\tname\tPCode2a\tPParam2a\tPMin2a\tPMax2a\tPCode2b\tPParam2b\tPMin2b\tPMax2b\tPCode3a\tPParam3a\tPMin3a\tPMax3a
1\tTest Set\tstr\t\t10\t10\tdex\t\t5\t5\tvit\t\t15\t15`;

      const result = parseSetsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(2);

      // 2-item bonus
      expect(result[0].partialBonuses[0].itemCount).toBe(2);
      expect(result[0].partialBonuses[0].properties).toHaveLength(2);
      expect(result[0].partialBonuses[0].properties[0]).toEqual({
        code: 'str',
        param: '',
        min: 10,
        max: 10,
      });
      expect(result[0].partialBonuses[0].properties[1]).toEqual({
        code: 'dex',
        param: '',
        min: 5,
        max: 5,
      });

      // 3-item bonus
      expect(result[0].partialBonuses[1].itemCount).toBe(3);
      expect(result[0].partialBonuses[1].properties).toHaveLength(1);
    });

    it('should parse full set bonuses (FCode1-8)', () => {
      const content = `index\tname\tFCode1\tFParam1\tFMin1\tFMax1\tFCode2\tFParam2\tFMin2\tFMax2
1\tTest Set\tallskills\t\t2\t2\tres-all\t\t25\t25`;

      const result = parseSetsTxt(content);

      expect(result[0].fullSetBonuses).toHaveLength(2);
      expect(result[0].fullSetBonuses[0]).toEqual({
        code: 'allskills',
        param: '',
        min: 2,
        max: 2,
      });
      expect(result[0].fullSetBonuses[1]).toEqual({
        code: 'res-all',
        param: '',
        min: 25,
        max: 25,
      });
    });

    it('should handle bonuses with parameters', () => {
      const content = `index\tname\tFCode1\tFParam1\tFMin1\tFMax1
1\tTest Set\toskill\tTeleport\t1\t1`;

      const result = parseSetsTxt(content);

      expect(result[0].fullSetBonuses[0]).toEqual({
        code: 'oskill',
        param: 'Teleport',
        min: 1,
        max: 1,
      });
    });

    it('should filter out rows without index', () => {
      const content = `index\tname
1\tValid Set
\tNo Index Set`;

      const result = parseSetsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Set');
    });

    it('should filter out rows without name', () => {
      const content = `index\tname
1\tValid Set
2\t`;

      const result = parseSetsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe('1');
    });

    it('should handle sets with no partial bonuses', () => {
      const content = `index\tname\tFCode1\tFParam1\tFMin1\tFMax1
1\tSimple Set\tstr\t\t10\t10`;

      const result = parseSetsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(0);
      expect(result[0].fullSetBonuses).toHaveLength(1);
    });

    it('should handle sets with no full set bonuses', () => {
      const content = `index\tname\tPCode2a\tPParam2a\tPMin2a\tPMax2a
1\tPartial Set\tstr\t\t10\t10`;

      const result = parseSetsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(1);
      expect(result[0].fullSetBonuses).toHaveLength(0);
    });

    it('should handle all partial bonus levels (2-5 items)', () => {
      const content = `index\tname\tPCode2a\tPMin2a\tPMax2a\tPCode3a\tPMin3a\tPMax3a\tPCode4a\tPMin4a\tPMax4a\tPCode5a\tPMin5a\tPMax5a
1\tFull Set\tp2\t2\t2\tp3\t3\t3\tp4\t4\t4\tp5\t5\t5`;

      const result = parseSetsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(4);
      expect(result[0].partialBonuses[0].itemCount).toBe(2);
      expect(result[0].partialBonuses[1].itemCount).toBe(3);
      expect(result[0].partialBonuses[2].itemCount).toBe(4);
      expect(result[0].partialBonuses[3].itemCount).toBe(5);
    });

    it('should handle up to 8 full set bonuses', () => {
      let header = 'index\tname';
      let row = '1\tTest';

      for (let i = 1; i <= 8; i++) {
        header += `\tFCode${i}\tFParam${i}\tFMin${i}\tFMax${i}`;
        row += `\tbonus${i}\t\t${i}\t${i}`;
      }

      const content = `${header}\n${row}`;
      const result = parseSetsTxt(content);

      expect(result[0].fullSetBonuses).toHaveLength(8);
      expect(result[0].fullSetBonuses[7].code).toBe('bonus8');
    });

    it('should handle multiple sets', () => {
      const content = `index\tname
1\tSet One
2\tSet Two
3\tSet Three`;

      const result = parseSetsTxt(content);

      expect(result).toHaveLength(3);
      expect(result.map((s) => s.name)).toEqual(['Set One', 'Set Two', 'Set Three']);
    });

    it('should handle empty content', () => {
      const result = parseSetsTxt('');
      expect(result).toHaveLength(0);
    });

    it('should skip empty bonus slots', () => {
      const content = `index\tname\tPCode2a\tPMin2a\tPMax2a\tPCode2b\tPMin2b\tPMax2b\tPCode3a\tPMin3a\tPMax3a
1\tTest\tstr\t5\t5\t\t\t\tvit\t10\t10`;

      const result = parseSetsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(2);
      expect(result[0].partialBonuses[0].properties).toHaveLength(1); // Only 'a' bonus, 'b' is empty
      expect(result[0].partialBonuses[1].properties).toHaveLength(1);
    });

    it('should trim whitespace from codes and params', () => {
      const content = `index\tname\tFCode1\tFParam1\tFMin1\tFMax1
1\tTest\t str \t param \t10\t10`;

      const result = parseSetsTxt(content);

      expect(result[0].fullSetBonuses[0].code).toBe('str');
      expect(result[0].fullSetBonuses[0].param).toBe('param');
    });
  });
});
