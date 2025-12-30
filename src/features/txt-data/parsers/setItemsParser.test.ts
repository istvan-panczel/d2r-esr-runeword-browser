import { describe, it, expect } from 'vitest';
import { parseSetItemsTxt } from './setItemsParser';

describe('setItemsParser', () => {
  describe('parseSetItemsTxt', () => {
    it('should parse basic set item', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req
Angelic Sickle\t1\tAngelic Raiment\tsab\tSabre\t12\t12`;

      const result = parseSetItemsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        index: 'Angelic Sickle',
        id: 1,
        setName: 'Angelic Raiment',
        itemCode: 'sab',
        itemName: 'Sabre',
        level: 12,
        levelReq: 12,
      });
    });

    it('should parse base properties (prop1-9)', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\tprop1\tpar1\tmin1\tmax1\tprop2\tpar2\tmin2\tmax2
Test Item\t1\tTest Set\tring\tRing\t10\t8\tstr\t\t5\t10\tdex\t\t3\t5`;

      const result = parseSetItemsTxt(content);

      expect(result[0].properties).toHaveLength(2);
      expect(result[0].properties[0]).toEqual({
        code: 'str',
        param: '',
        min: 5,
        max: 10,
      });
      expect(result[0].properties[1]).toEqual({
        code: 'dex',
        param: '',
        min: 3,
        max: 5,
      });
    });

    it('should parse partial bonuses (aprop1a-5b)', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\taprop1a\tapar1a\tamin1a\tamax1a\taprop1b\tapar1b\tamin1b\tamax1b
Test Item\t1\tTest Set\tring\tRing\t10\t8\tres-fire\t\t10\t10\tres-cold\t\t15\t15`;

      const result = parseSetItemsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(1);
      expect(result[0].partialBonuses[0].slot).toBe(1);
      expect(result[0].partialBonuses[0].propertyA).toEqual({
        code: 'res-fire',
        param: '',
        min: 10,
        max: 10,
      });
      expect(result[0].partialBonuses[0].propertyB).toEqual({
        code: 'res-cold',
        param: '',
        min: 15,
        max: 15,
      });
    });

    it('should handle partial bonuses with only property A', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\taprop1a\tapar1a\tamin1a\tamax1a\taprop1b\tapar1b\tamin1b\tamax1b
Test Item\t1\tTest Set\tring\tRing\t10\t8\tstr\t\t10\t10\t\t\t\t`;

      const result = parseSetItemsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(1);
      expect(result[0].partialBonuses[0].propertyA).not.toBeNull();
      expect(result[0].partialBonuses[0].propertyB).toBeNull();
    });

    it('should handle partial bonuses with only property B', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\taprop1a\tapar1a\tamin1a\tamax1a\taprop1b\tapar1b\tamin1b\tamax1b
Test Item\t1\tTest Set\tring\tRing\t10\t8\t\t\t\t\tdex\t\t5\t5`;

      const result = parseSetItemsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(1);
      expect(result[0].partialBonuses[0].propertyA).toBeNull();
      expect(result[0].partialBonuses[0].propertyB).not.toBeNull();
    });

    it('should handle properties with parameters', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\tprop1\tpar1\tmin1\tmax1
Test Item\t1\tTest Set\tamu\tAmulet\t10\t8\toskill\tTeleport\t1\t1`;

      const result = parseSetItemsTxt(content);

      expect(result[0].properties[0]).toEqual({
        code: 'oskill',
        param: 'Teleport',
        min: 1,
        max: 1,
      });
    });

    it('should filter out rows without index', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req
Valid Item\t1\tSet\tring\tRing\t10\t8
\t2\tSet\tring\tRing\t10\t8`;

      const result = parseSetItemsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe('Valid Item');
    });

    it('should filter out rows without *ID', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req
Valid Item\t1\tSet\tring\tRing\t10\t8
No ID Item\t\tSet\tring\tRing\t10\t8`;

      const result = parseSetItemsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe('Valid Item');
    });

    it('should handle up to 9 base properties', () => {
      let header = 'index\t*ID\tset\titem\t*item\tlvl\tlvl req';
      let row = 'Test\t1\tSet\tring\tRing\t10\t8';

      for (let i = 1; i <= 9; i++) {
        header += `\tprop${i}\tpar${i}\tmin${i}\tmax${i}`;
        row += `\tprop${i}\t\t${i}\t${i}`;
      }

      const content = `${header}\n${row}`;
      const result = parseSetItemsTxt(content);

      expect(result[0].properties).toHaveLength(9);
      expect(result[0].properties[8].code).toBe('prop9');
    });

    it('should handle up to 5 partial bonus slots', () => {
      let header = 'index\t*ID\tset\titem\t*item\tlvl\tlvl req';
      let row = 'Test\t1\tSet\tring\tRing\t10\t8';

      for (let i = 1; i <= 5; i++) {
        header += `\taprop${i}a\tapar${i}a\tamin${i}a\tamax${i}a`;
        row += `\tslot${i}\t\t${i}\t${i}`;
      }

      const content = `${header}\n${row}`;
      const result = parseSetItemsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(5);
      expect(result[0].partialBonuses[4].slot).toBe(5);
    });

    it('should handle items with no properties', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req
Test Item\t1\tSet\tring\tRing\t10\t8`;

      const result = parseSetItemsTxt(content);

      expect(result[0].properties).toHaveLength(0);
    });

    it('should handle items with no partial bonuses', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\tprop1\tpar1\tmin1\tmax1
Test Item\t1\tSet\tring\tRing\t10\t8\tstr\t\t5\t5`;

      const result = parseSetItemsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(0);
    });

    it('should skip empty partial bonus slots', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\taprop1a\tamin1a\tamax1a\taprop2a\tamin2a\tamax2a\taprop3a\tamin3a\tamax3a
Test\t1\tSet\tring\tRing\t10\t8\tslot1\t1\t1\t\t\t\tslot3\t3\t3`;

      const result = parseSetItemsTxt(content);

      expect(result[0].partialBonuses).toHaveLength(2);
      expect(result[0].partialBonuses[0].slot).toBe(1);
      expect(result[0].partialBonuses[1].slot).toBe(3);
    });

    it('should handle multiple set items', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req
Item One\t1\tSet A\tring\tRing\t10\t8
Item Two\t2\tSet A\tamu\tAmulet\t15\t12
Item Three\t3\tSet B\ttors\tArmor\t20\t18`;

      const result = parseSetItemsTxt(content);

      expect(result).toHaveLength(3);
      expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
    });

    it('should handle empty content', () => {
      const result = parseSetItemsTxt('');
      expect(result).toHaveLength(0);
    });

    it('should trim whitespace from codes and params', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req\tprop1\tpar1\tmin1\tmax1
Test Item\t1\tSet\tring\tRing\t10\t8\t str \t param \t5\t5`;

      const result = parseSetItemsTxt(content);

      expect(result[0].properties[0].code).toBe('str');
      expect(result[0].properties[0].param).toBe('param');
    });

    it('should parse numeric fields correctly', () => {
      const content = `index\t*ID\tset\titem\t*item\tlvl\tlvl req
Test\t123\tTest Set\ttors\tArmor\t45\t42`;

      const result = parseSetItemsTxt(content);

      expect(result[0].id).toBe(123);
      expect(result[0].level).toBe(45);
      expect(result[0].levelReq).toBe(42);
    });
  });
});
