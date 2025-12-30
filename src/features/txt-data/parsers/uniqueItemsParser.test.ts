import { describe, it, expect } from 'vitest';
import { parseUniqueItemsTxt } from './uniqueItemsParser';
import type { TxtPropertyDef } from '@/core/db';

describe('uniqueItemsParser', () => {
  describe('parseUniqueItemsTxt', () => {
    it('should parse basic unique item', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName
The Gnasher\t1\t100\t1\t5\t5\taxe\tHand Axe`;

      const result = parseUniqueItemsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        index: 'The Gnasher',
        id: 1,
        version: 100,
        enabled: true,
        level: 5,
        levelReq: 5,
        itemCode: 'axe',
        itemName: 'Hand Axe',
        resolvedProperties: [],
      });
    });

    it('should parse item properties', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName\tprop1\tpar1\tmin1\tmax1\tprop2\tpar2\tmin2\tmax2
Test Item\t1\t100\t1\t10\t8\tring\tRing\tstr\t\t5\t10\tres-fire\t\t15\t20`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].properties).toHaveLength(2);
      expect(result[0].properties[0]).toEqual({
        code: 'str',
        param: '',
        min: 5,
        max: 10,
      });
      expect(result[0].properties[1]).toEqual({
        code: 'res-fire',
        param: '',
        min: 15,
        max: 20,
      });
    });

    it('should handle properties with parameters', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName\tprop1\tpar1\tmin1\tmax1
Test Item\t1\t100\t1\t10\t8\tamu\tAmulet\toskill\tTeleport\t1\t1`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].properties[0]).toEqual({
        code: 'oskill',
        param: 'Teleport',
        min: 1,
        max: 1,
      });
    });

    it('should handle disabled items (enabled=0)', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName
Disabled Item\t1\t100\t0\t10\t8\taxe\tAxe`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].enabled).toBe(false);
    });

    it('should filter out rows without index', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName
Valid Item\t1\t100\t1\t10\t8\taxe\tAxe
\t2\t100\t1\t10\t8\taxe\tAxe`;

      const result = parseUniqueItemsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe('Valid Item');
    });

    it('should filter out rows without *ID', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName
Valid Item\t1\t100\t1\t10\t8\taxe\tAxe
No ID Item\t\t100\t1\t10\t8\taxe\tAxe`;

      const result = parseUniqueItemsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe('Valid Item');
    });

    it('should parse up to 12 properties', () => {
      // Build content with 12 property columns
      let header = 'index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName';
      let row = 'Test\t1\t100\t1\t10\t8\tring\tRing';

      for (let i = 1; i <= 12; i++) {
        header += `\tprop${i}\tpar${i}\tmin${i}\tmax${i}`;
        row += `\tprop${i}\t\t${i}\t${i}`;
      }

      const content = `${header}\n${row}`;
      const result = parseUniqueItemsTxt(content);

      expect(result[0].properties).toHaveLength(12);
      expect(result[0].properties[11].code).toBe('prop12');
      expect(result[0].properties[11].min).toBe(12);
    });

    it('should handle items with no properties', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName
Test Item\t1\t100\t1\t10\t8\taxe\tAxe`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].properties).toHaveLength(0);
    });

    it('should skip empty property slots', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName\tprop1\tpar1\tmin1\tmax1\tprop2\tpar2\tmin2\tmax2\tprop3\tpar3\tmin3\tmax3
Test Item\t1\t100\t1\t10\t8\taxe\tAxe\tstr\t\t5\t5\t\t\t\t\tdex\t\t3\t3`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].properties).toHaveLength(2);
      expect(result[0].properties[0].code).toBe('str');
      expect(result[0].properties[1].code).toBe('dex');
    });

    it('should handle multiple unique items', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName
Item One\t1\t100\t1\t10\t8\taxe\tAxe
Item Two\t2\t100\t1\t20\t18\tswd\tSword
Item Three\t3\t100\t1\t30\t28\tmac\tMace`;

      const result = parseUniqueItemsTxt(content);

      expect(result).toHaveLength(3);
      expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
    });

    it('should handle empty content', () => {
      const result = parseUniqueItemsTxt('');
      expect(result).toHaveLength(0);
    });

    it('should trim whitespace from property codes and params', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName\tprop1\tpar1\tmin1\tmax1
Test Item\t1\t100\t1\t10\t8\taxe\tAxe\t str \t param \t5\t5`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].properties[0].code).toBe('str');
      expect(result[0].properties[0].param).toBe('param');
    });

    it('should parse numeric fields correctly', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName
Test\t123\t100\t1\t45\t42\tamu\tAmulet`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].id).toBe(123);
      expect(result[0].version).toBe(100);
      expect(result[0].level).toBe(45);
      expect(result[0].levelReq).toBe(42);
    });

    it('should have empty resolvedProperties without propertyDefs', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName\tprop1\tpar1\tmin1\tmax1
Test Item\t1\t100\t1\t10\t8\tring\tRing\tstr\t\t5\t10`;

      const result = parseUniqueItemsTxt(content);

      expect(result[0].properties).toHaveLength(1);
      expect(result[0].resolvedProperties).toHaveLength(0);
    });

    it('should pre-resolve properties when propertyDefs provided', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName\tprop1\tpar1\tmin1\tmax1\tprop2\tpar2\tmin2\tmax2
Test Item\t1\t100\t1\t10\t8\tring\tRing\tstr\t\t5\t10\tres-fire\t\t15\t15`;

      const propertyDefs: TxtPropertyDef[] = [
        { code: 'str', tooltip: '+# to Strength', parameter: '' },
        { code: 'res-fire', tooltip: 'Fire Resist +#%', parameter: '' },
      ];

      const result = parseUniqueItemsTxt(content, undefined, propertyDefs);

      expect(result[0].properties).toHaveLength(2);
      expect(result[0].resolvedProperties).toHaveLength(2);
      expect(result[0].resolvedProperties[0]).toBe('+5-10 to Strength');
      expect(result[0].resolvedProperties[1]).toBe('Fire Resist +15%');
    });

    it('should use fallback tooltips for percent properties', () => {
      const content = `index\t*ID\tversion\tenabled\tlvl\tlvl req\tcode\t*ItemName\tprop1\tpar1\tmin1\tmax1\tprop2\tpar2\tmin2\tmax2
Test Item\t1\t100\t1\t10\t8\tring\tRing\tstrpercent\t\t10\t20\tvitpercent\t\t15\t15`;

      const propertyDefs: TxtPropertyDef[] = [];

      const result = parseUniqueItemsTxt(content, undefined, propertyDefs);

      expect(result[0].resolvedProperties).toHaveLength(2);
      expect(result[0].resolvedProperties[0]).toBe('+10-20% Bonus to Strength');
      expect(result[0].resolvedProperties[1]).toBe('+15% Bonus to Vitality');
    });
  });
});
