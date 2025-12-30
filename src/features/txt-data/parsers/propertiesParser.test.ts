import { describe, it, expect } from 'vitest';
import { parsePropertiesTxt, buildPropertyMap } from './propertiesParser';

describe('propertiesParser', () => {
  describe('parsePropertiesTxt', () => {
    it('should parse properties with code and tooltip', () => {
      const content = `code\t*Tooltip\t*Parameter
str\t+# to Strength\tMin #
dex\t+# to Dexterity\tMin #`;

      const result = parsePropertiesTxt(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'str',
        tooltip: '+# to Strength',
        parameter: 'Min #',
      });
      expect(result[1]).toEqual({
        code: 'dex',
        tooltip: '+# to Dexterity',
        parameter: 'Min #',
      });
    });

    it('should filter out rows without code', () => {
      const content = `code\t*Tooltip\t*Parameter
str\t+# to Strength\tMin #
\t+# to Something\tMin #
vit\t+# to Vitality\tMin #`;

      const result = parsePropertiesTxt(content);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('str');
      expect(result[1].code).toBe('vit');
    });

    it('should filter out rows without tooltip', () => {
      const content = `code\t*Tooltip\t*Parameter
str\t+# to Strength\tMin #
dmg\t\tMin #
vit\t+# to Vitality\tMin #`;

      const result = parsePropertiesTxt(content);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('str');
      expect(result[1].code).toBe('vit');
    });

    it('should handle missing parameter with empty string', () => {
      const content = `code\t*Tooltip\t*Parameter
res-all\tAll Resistances +#\t`;

      const result = parsePropertiesTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 'res-all',
        tooltip: 'All Resistances +#',
        parameter: '',
      });
    });

    it('should handle empty content', () => {
      const result = parsePropertiesTxt('');
      expect(result).toHaveLength(0);
    });

    it('should handle content with only header', () => {
      const content = `code\t*Tooltip\t*Parameter`;
      const result = parsePropertiesTxt(content);
      expect(result).toHaveLength(0);
    });

    it('should parse common D2 property codes correctly', () => {
      const content = `code\t*Tooltip\t*Parameter
ac\t+# Defense\t
dmg%\t+#% Enhanced Damage\t
allskills\t+# to All Skills\t
res-fire\tFire Resist +#%\t
swing1\t#% Increased Attack Speed\t`;

      const result = parsePropertiesTxt(content);

      expect(result).toHaveLength(5);
      expect(result.find((p) => p.code === 'ac')?.tooltip).toBe('+# Defense');
      expect(result.find((p) => p.code === 'dmg%')?.tooltip).toBe('+#% Enhanced Damage');
      expect(result.find((p) => p.code === 'allskills')?.tooltip).toBe('+# to All Skills');
    });
  });

  describe('buildPropertyMap', () => {
    it('should create a map from code to property definition', () => {
      const properties = [
        { code: 'str', tooltip: '+# to Strength', parameter: 'Min #' },
        { code: 'dex', tooltip: '+# to Dexterity', parameter: 'Min #' },
      ];

      const map = buildPropertyMap(properties);

      expect(map.size).toBe(2);
      expect(map.get('str')).toEqual(properties[0]);
      expect(map.get('dex')).toEqual(properties[1]);
    });

    it('should handle empty array', () => {
      const map = buildPropertyMap([]);
      expect(map.size).toBe(0);
    });

    it('should allow lookup by code', () => {
      const properties = [
        { code: 'dmg%', tooltip: '+#% Enhanced Damage', parameter: '' },
        { code: 'ac', tooltip: '+# Defense', parameter: '' },
      ];

      const map = buildPropertyMap(properties);

      expect(map.has('dmg%')).toBe(true);
      expect(map.has('ac')).toBe(true);
      expect(map.has('unknown')).toBe(false);
    });
  });
});
