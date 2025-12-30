import { describe, it, expect } from 'vitest';
import { parseItemTypesTxt } from './itemTypesParser';

describe('itemTypesParser', () => {
  describe('parseItemTypesTxt', () => {
    it('should parse weapons with code and type', () => {
      const weapons = `name\ttype\tcode
Short Sword\tswor\tssd
Long Sword\tswor\tlsd`;
      const armor = `name\tcode\ttype`;
      const misc = `name\tcode\ttype`;

      const result = parseItemTypesTxt(weapons, armor, misc);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ code: 'ssd', type: 'swor', name: 'Short Sword' });
      expect(result[1]).toEqual({ code: 'lsd', type: 'swor', name: 'Long Sword' });
    });

    it('should parse armor with code and type', () => {
      const weapons = `name\ttype\tcode`;
      const armor = `name\tcode\ttype
Quilted Armor\tqlt\ttors
Leather Armor\tlea\ttors`;
      const misc = `name\tcode\ttype`;

      const result = parseItemTypesTxt(weapons, armor, misc);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ code: 'qlt', type: 'tors', name: 'Quilted Armor' });
    });

    it('should parse misc items', () => {
      const weapons = `name\ttype\tcode`;
      const armor = `name\tcode\ttype`;
      const misc = `name\tcode\ttype
Minor Healing Potion\thp1\thpot
Stamina Potion\tvps\tspot`;

      const result = parseItemTypesTxt(weapons, armor, misc);

      expect(result).toHaveLength(2);
    });

    it('should deduplicate by code', () => {
      const weapons = `name\ttype\tcode
Short Sword\tswor\tssd`;
      const armor = `name\tcode\ttype
Short Sword\tssd\tswor`;
      const misc = `name\tcode\ttype`;

      const result = parseItemTypesTxt(weapons, armor, misc);

      expect(result).toHaveLength(1);
    });

    it('should lowercase codes and types', () => {
      const weapons = `name\ttype\tcode
Short Sword\tSWOR\tSSD`;
      const armor = `name\tcode\ttype`;
      const misc = `name\tcode\ttype`;

      const result = parseItemTypesTxt(weapons, armor, misc);

      expect(result[0].code).toBe('ssd');
      expect(result[0].type).toBe('swor');
    });

    it('should skip rows without code or type', () => {
      const weapons = `name\ttype\tcode
Short Sword\tswor\tssd
\tswor\t
Long Sword\t\tlsd`;
      const armor = `name\tcode\ttype`;
      const misc = `name\tcode\ttype`;

      const result = parseItemTypesTxt(weapons, armor, misc);

      expect(result).toHaveLength(1);
    });

    it('should handle all empty files', () => {
      const result = parseItemTypesTxt('', '', '');
      expect(result).toHaveLength(0);
    });
  });
});
