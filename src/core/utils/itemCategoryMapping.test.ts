import { describe, it, expect } from 'vitest';
import { getRelevantCategories, getItemCategory, getCategoryLabel } from './itemCategoryMapping';

describe('getRelevantCategories', () => {
  describe('single item type', () => {
    it('should return weaponsGloves for weapon items', () => {
      expect(getRelevantCategories(['All Weapons'])).toEqual(['weaponsGloves']);
      expect(getRelevantCategories(['Swords'])).toEqual(['weaponsGloves']);
      expect(getRelevantCategories(['Axes'])).toEqual(['weaponsGloves']);
      expect(getRelevantCategories(['Missile Weapons'])).toEqual(['weaponsGloves']);
    });

    it('should return weaponsGloves for glove items', () => {
      expect(getRelevantCategories(['Gloves'])).toEqual(['weaponsGloves']);
    });

    it('should return helmsBoots for helm items', () => {
      expect(getRelevantCategories(['Helms'])).toEqual(['helmsBoots']);
      expect(getRelevantCategories(['Circlets'])).toEqual(['helmsBoots']);
      expect(getRelevantCategories(['Barbarian Helms'])).toEqual(['helmsBoots']);
    });

    it('should return helmsBoots for boot items', () => {
      expect(getRelevantCategories(['Boots'])).toEqual(['helmsBoots']);
    });

    it('should return armorShieldsBelts for armor items', () => {
      expect(getRelevantCategories(['Body Armor'])).toEqual(['armorShieldsBelts']);
      expect(getRelevantCategories(['All Armor'])).toEqual(['armorShieldsBelts']);
    });

    it('should return armorShieldsBelts for shield items', () => {
      expect(getRelevantCategories(['Shields'])).toEqual(['armorShieldsBelts']);
      expect(getRelevantCategories(['Paladin Shields'])).toEqual(['armorShieldsBelts']);
    });

    it('should return armorShieldsBelts for belt items', () => {
      expect(getRelevantCategories(['Belts'])).toEqual(['armorShieldsBelts']);
    });
  });

  describe('case insensitivity', () => {
    it('should match regardless of case', () => {
      expect(getRelevantCategories(['SWORDS'])).toEqual(['weaponsGloves']);
      expect(getRelevantCategories(['swords'])).toEqual(['weaponsGloves']);
      expect(getRelevantCategories(['Swords'])).toEqual(['weaponsGloves']);
    });
  });

  describe('multiple item types', () => {
    it('should return multiple categories for mixed items', () => {
      const result = getRelevantCategories(['Swords', 'Helms']);
      expect(result).toContain('weaponsGloves');
      expect(result).toContain('helmsBoots');
      expect(result).toHaveLength(2);
    });

    it('should return all three categories when applicable', () => {
      const result = getRelevantCategories(['Swords', 'Helms', 'Armor']);
      expect(result).toEqual(['weaponsGloves', 'helmsBoots', 'armorShieldsBelts']);
    });

    it('should deduplicate categories', () => {
      const result = getRelevantCategories(['Swords', 'Axes', 'Maces']);
      expect(result).toEqual(['weaponsGloves']);
    });

    it('should maintain consistent order', () => {
      // Order should always be weaponsGloves, helmsBoots, armorShieldsBelts
      const result1 = getRelevantCategories(['Armor', 'Helms', 'Swords']);
      const result2 = getRelevantCategories(['Swords', 'Armor', 'Helms']);
      expect(result1).toEqual(['weaponsGloves', 'helmsBoots', 'armorShieldsBelts']);
      expect(result2).toEqual(['weaponsGloves', 'helmsBoots', 'armorShieldsBelts']);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      expect(getRelevantCategories([])).toEqual([]);
    });

    it('should return empty array for unknown items', () => {
      expect(getRelevantCategories(['Unknown Item'])).toEqual([]);
      expect(getRelevantCategories(['Random Stuff'])).toEqual([]);
    });

    it('should filter out unknown items while keeping known ones', () => {
      const result = getRelevantCategories(['Swords', 'Unknown Item', 'Helms']);
      expect(result).toEqual(['weaponsGloves', 'helmsBoots']);
    });
  });

  describe('specific weapon types', () => {
    it('should recognize melee/ranged weapon keywords as weaponsGloves', () => {
      const weaponTypes = ['Hammer', 'Polearm', 'Spear', 'Katana', 'Blade', 'Dagger', 'Bow', 'Crossbow', 'Javelin', 'Scepter', 'Claw'];

      for (const weapon of weaponTypes) {
        expect(getRelevantCategories([weapon])).toEqual(['weaponsGloves']);
      }
    });

    it('should recognize staves, orbs, and wands as helmsBoots (per runewords.htm column 5)', () => {
      expect(getRelevantCategories(['Staff'])).toEqual(['helmsBoots']);
      expect(getRelevantCategories(['Orb'])).toEqual(['helmsBoots']);
      expect(getRelevantCategories(['Wand'])).toEqual(['helmsBoots']);
    });

    it('should recognize charms as helmsBoots', () => {
      expect(getRelevantCategories(['Charm'])).toEqual(['helmsBoots']);
    });
  });

  describe('compound item names', () => {
    it('should match partial keywords in compound names', () => {
      expect(getRelevantCategories(['Amazon Weapons'])).toEqual(['weaponsGloves']);
      expect(getRelevantCategories(['Elite Helms'])).toEqual(['helmsBoots']);
      expect(getRelevantCategories(['Exceptional Armor'])).toEqual(['armorShieldsBelts']);
    });
  });

  describe('multi-category runewords', () => {
    it('should return both categories for Weapon + Charm runewords (e.g., Machine)', () => {
      expect(getRelevantCategories(['Weapon', 'Charm'])).toEqual(['weaponsGloves', 'helmsBoots']);
    });

    it('should return both categories for Staff + Weapon runewords (e.g., Insight)', () => {
      expect(getRelevantCategories(['Polearm', 'Staff', 'Missile Weapon'])).toEqual(['weaponsGloves', 'helmsBoots']);
    });

    it('should return helmsBoots + armorShieldsBelts for Body Armor + Charm (e.g., Evolution)', () => {
      expect(getRelevantCategories(['Body Armor', 'Charm'])).toEqual(['helmsBoots', 'armorShieldsBelts']);
    });
  });
});

describe('getItemCategory', () => {
  it('should return correct category for each item type', () => {
    expect(getItemCategory('Sword')).toBe('weaponsGloves');
    expect(getItemCategory('Helm')).toBe('helmsBoots');
    expect(getItemCategory('Staff')).toBe('helmsBoots');
    expect(getItemCategory('Orb')).toBe('helmsBoots');
    expect(getItemCategory('Wand')).toBe('helmsBoots');
    expect(getItemCategory('Charm')).toBe('helmsBoots');
    expect(getItemCategory('Body Armor')).toBe('armorShieldsBelts');
  });

  it('should return null for unknown items', () => {
    expect(getItemCategory('Unknown')).toBeNull();
  });
});

describe('getCategoryLabel', () => {
  it('should generate dynamic labels from allowed items', () => {
    expect(getCategoryLabel(['Weapon', 'Charm'], 'weaponsGloves')).toBe('Weapon');
    expect(getCategoryLabel(['Weapon', 'Charm'], 'helmsBoots')).toBe('Charm');
  });

  it('should join multiple items in the same category', () => {
    expect(getCategoryLabel(['Polearm', 'Staff', 'Missile Weapon'], 'weaponsGloves')).toBe('Polearm/Missile Weapon');
    expect(getCategoryLabel(['Polearm', 'Staff', 'Missile Weapon'], 'helmsBoots')).toBe('Staff');
  });

  it('should fall back to default labels when no items match', () => {
    expect(getCategoryLabel(['Charm'], 'weaponsGloves')).toBe('Weapons/Gloves');
    expect(getCategoryLabel(['Sword'], 'armorShieldsBelts')).toBe('Armor/Shields/Belts');
  });
});
