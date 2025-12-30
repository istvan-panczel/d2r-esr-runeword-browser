import { describe, it, expect } from 'vitest';
import { parseItemTypeDefsTxt } from './itemTypeDefsParser';

describe('itemTypeDefsParser', () => {
  describe('parseItemTypeDefsTxt', () => {
    it('should parse item type definitions', () => {
      const content = `Code\tItemType\tEquiv1\tEquiv2\tStorePage
swor\tSword\tweap\t\tarmo
axe\tAxe\tweap\t\tarmo`;

      const result = parseItemTypeDefsTxt(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'swor',
        name: 'Sword',
        equiv1: 'weap',
        equiv2: '',
        storePage: 'armo',
      });
    });

    it('should skip rows with invalid codes', () => {
      const content = `Code\tItemType\tEquiv1\tEquiv2\tStorePage
swor\tSword\tweap\t\tarmo
none\tNone\t\t\t
xxx\tUnused\t\t\t
axe\tAxe\tweap\t\tarmo`;

      const result = parseItemTypeDefsTxt(content);

      expect(result).toHaveLength(2);
      expect(result.find((t) => t.code === 'none')).toBeUndefined();
      expect(result.find((t) => t.code === 'xxx')).toBeUndefined();
    });

    it('should lowercase codes', () => {
      const content = `Code\tItemType\tEquiv1\tEquiv2\tStorePage
SWOR\tSword\tWEAP\t\tARMO`;

      const result = parseItemTypeDefsTxt(content);

      expect(result[0].code).toBe('swor');
      expect(result[0].equiv1).toBe('weap');
      expect(result[0].storePage).toBe('armo');
    });

    it('should handle empty equiv columns', () => {
      const content = `Code\tItemType\tEquiv1\tEquiv2\tStorePage
swor\tSword\t\t\tarmo`;

      const result = parseItemTypeDefsTxt(content);

      expect(result[0].equiv1).toBe('');
      expect(result[0].equiv2).toBe('');
    });

    it('should handle empty content', () => {
      const result = parseItemTypeDefsTxt('');
      expect(result).toHaveLength(0);
    });

    it('should handle content with only header', () => {
      const content = `Code\tItemType\tEquiv1\tEquiv2\tStorePage`;
      const result = parseItemTypeDefsTxt(content);
      expect(result).toHaveLength(0);
    });

    it('should skip rows without code', () => {
      const content = `Code\tItemType\tEquiv1\tEquiv2\tStorePage
\tEmpty\tweap\t\tarmo
swor\tSword\tweap\t\tarmo`;

      const result = parseItemTypeDefsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('swor');
    });
  });
});
