import { describe, it, expect } from 'vitest';
import { getItemTypeFromCode, type ItemTypeDefInfo } from './itemTypeMapping';

/**
 * Tests for item type mapping
 * Ensures items are correctly categorized using data from IndexedDB
 */
describe('itemTypeMapping', () => {
  // Create mock maps based on the TXT file data structure
  // itemCodeToTypeMap: item code -> type code (from weapons/armor/misc.txt)
  const itemCodeToTypeMap = new Map<string, string>([
    // Charms
    ['cm1', 'scha'], // Small Charm
    ['cm2', 'mcha'], // Large Charm
    ['cm3', 'lcha'], // Grand Charm
    ['cx1', 'scha'], // Small Charm (alt)
    ['cx2', 'mcha'], // Large Charm (alt)
    ['cx3', 'lcha'], // Grand Charm (alt)
    ['cm4', 'ocha'], // Odd Charm
    ['cm5', 'qcha'], // Square Charm
    // Weapons
    ['lsd', 'swor'], // Long Sword
    ['bsw', 'swor'], // Broad Sword
    // Amazon Javelin
    ['amf', 'ajav'], // Matriarchal Javelin
  ]);

  // itemTypeDefsMap: type code -> {storePage, name} (from itemtypes.txt)
  const itemTypeDefsMap = new Map<string, ItemTypeDefInfo>([
    // Charms
    ['scha', { storePage: 'misc', name: 'Small Charm' }],
    ['mcha', { storePage: 'misc', name: 'Large Charm' }],
    ['lcha', { storePage: 'misc', name: 'Grand Charm' }],
    ['ocha', { storePage: 'misc', name: 'Odd Charm' }],
    ['qcha', { storePage: 'misc', name: 'Square Charm' }],
    // Weapons
    ['swor', { storePage: 'weap', name: 'Sword' }],
    ['ajav', { storePage: 'weap', name: 'Amazon Javelin' }],
    // Armor
    ['helm', { storePage: 'armo', name: 'Helm' }],
  ]);

  describe('Grand Charm categorization', () => {
    it('should categorize cm3 (Grand Charm) correctly', () => {
      const result = getItemTypeFromCode('cm3', 'Grand Charm', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('other');
      expect(result.typeCode).toBe('lcha');
      expect(result.label).toBe('Grand Charm');
    });

    it('should categorize cx3 (Grand Charm alt) correctly', () => {
      const result = getItemTypeFromCode('cx3', 'Grand Charm', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('other');
      expect(result.typeCode).toBe('lcha');
      expect(result.label).toBe('Grand Charm');
    });

    it("should categorize Gheed's Fortune (cm3) correctly", () => {
      // Even though Gheed's Fortune has itemName "charm" in uniqueitems.txt,
      // the code cm3 maps to type lcha which should be grand-charm
      const result = getItemTypeFromCode('cm3', 'charm', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('other');
      expect(result.typeCode).toBe('lcha');
    });
  });

  describe('Large Charm categorization', () => {
    it('should categorize cm2 (Large Charm) correctly', () => {
      const result = getItemTypeFromCode('cm2', 'Large Charm', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('other');
      expect(result.typeCode).toBe('mcha');
      expect(result.label).toBe('Large Charm');
    });

    it('should categorize cx2 (Large Charm alt) correctly', () => {
      const result = getItemTypeFromCode('cx2', 'Large Charm', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('other');
      expect(result.typeCode).toBe('mcha');
    });
  });

  describe('Small Charm categorization', () => {
    it('should categorize cm1 (Small Charm) correctly', () => {
      const result = getItemTypeFromCode('cm1', 'Small Charm', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('other');
      expect(result.typeCode).toBe('scha');
      expect(result.label).toBe('Small Charm');
    });
  });

  describe('Weapon categorization', () => {
    it('should categorize swords as weapons', () => {
      const result = getItemTypeFromCode('lsd', 'Long Sword', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('weapons');
      expect(result.typeCode).toBe('swor');
      expect(result.label).toBe('Sword');
    });

    it('should categorize Amazon Javelin correctly', () => {
      const result = getItemTypeFromCode('amf', 'Matriarchal Javelin', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('weapons');
      expect(result.typeCode).toBe('ajav');
      expect(result.label).toBe('Amazon Javelin');
    });
  });

  describe('Mythical item detection', () => {
    it('should categorize items with Mythical prefix as mythical', () => {
      const result = getItemTypeFromCode('any', 'Mythical Sword', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('mythical');
      expect(result.typeCode).toBe('mythical');
      expect(result.label).toBe('Mythical');
    });

    it('should be case-insensitive for Mythical detection', () => {
      const result = getItemTypeFromCode('any', 'mythical axe', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('mythical');
      expect(result.typeCode).toBe('mythical');
    });
  });

  describe('Unknown items fallback', () => {
    it('should return unknown for items not in the maps', () => {
      const result = getItemTypeFromCode('xyz', 'Unknown Item', itemCodeToTypeMap, itemTypeDefsMap);
      expect(result.group).toBe('other');
      expect(result.typeCode).toBe('unknown');
      expect(result.label).toBe('Unknown');
    });
  });
});
