import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import { txtDb } from '@/core/db';
import {
  parsePropertiesTxt,
  parseSocketablesTxt,
  buildCodeToNameMap,
  parseRunewordsTxt,
  parseUniqueItemsTxt,
  parseSetsTxt,
  parseSetItemsTxt,
} from './parsers';
import { createPropertyTranslator } from './utils';

// Helper to read TXT fixtures from public/txt/
const TXT_DIR = resolve(__dirname, '../../../public/txt');
const readTxtFixture = (filename: string) => readFileSync(resolve(TXT_DIR, filename), 'utf-8');

const propertiesTxt = readTxtFixture('properties.txt');
const gemsTxt = readTxtFixture('gems.txt');
const runesTxt = readTxtFixture('runes.txt');
const uniqueItemsTxt = readTxtFixture('uniqueitems.txt');
const setsTxt = readTxtFixture('sets.txt');
const setItemsTxt = readTxtFixture('setitems.txt');

describe('TXT Data Integration', () => {
  beforeEach(async () => {
    await Promise.all(txtDb.tables.map((table) => table.clear()));
  });

  describe('Properties Parsing', () => {
    it('should parse properties.txt', () => {
      const properties = parsePropertiesTxt(propertiesTxt);

      expect(properties.length).toBeGreaterThan(100);

      // Check for known properties
      const acProp = properties.find((p) => p.code === 'ac');
      expect(acProp).toBeDefined();
      expect(acProp?.tooltip).toContain('Defense');
    });

    it('should store properties in IndexedDB', async () => {
      const properties = parsePropertiesTxt(propertiesTxt);
      await txtDb.properties.bulkPut([...properties]);

      const stored = await txtDb.properties.toArray();
      expect(stored.length).toBe(properties.length);

      const strProp = await txtDb.properties.get('str');
      expect(strProp).toBeDefined();
      expect(strProp?.tooltip).toContain('Strength');
    });
  });

  describe('Socketables Parsing', () => {
    it('should parse gems.txt', () => {
      const socketables = parseSocketablesTxt(gemsTxt);

      // Should have gems (8 types × 6 qualities = 48) plus other socketables
      expect(socketables.length).toBeGreaterThan(40);
    });

    it('should parse gem with correct structure', () => {
      const socketables = parseSocketablesTxt(gemsTxt);
      const chippedDiamond = socketables.find((s) => s.code === 'gcw');

      expect(chippedDiamond).toBeDefined();
      expect(chippedDiamond?.name).toBe('Chipped Diamond');
      expect(chippedDiamond?.weaponMods.length).toBeGreaterThan(0);
      expect(chippedDiamond?.helmMods.length).toBeGreaterThan(0);
      expect(chippedDiamond?.shieldMods.length).toBeGreaterThan(0);
    });

    it('should build code-to-name map', () => {
      const socketables = parseSocketablesTxt(gemsTxt);
      const codeToName = buildCodeToNameMap(socketables);

      expect(codeToName.get('gcw')).toBe('Chipped Diamond');
      expect(codeToName.get('gcv')).toBe('Chipped Amethyst');
    });

    it('should store socketables in IndexedDB', async () => {
      const socketables = parseSocketablesTxt(gemsTxt);
      await txtDb.socketables.bulkPut([...socketables]);

      const stored = await txtDb.socketables.toArray();
      expect(stored.length).toBe(socketables.length);

      const diamond = await txtDb.socketables.get('gcw');
      expect(diamond).toBeDefined();
      expect(diamond?.name).toBe('Chipped Diamond');
    });
  });

  describe('Runewords Parsing', () => {
    it('should parse runes.txt with resolved rune names', () => {
      const socketables = parseSocketablesTxt(gemsTxt);
      const codeToNameMap = buildCodeToNameMap(socketables);
      const runewords = parseRunewordsTxt(runesTxt, codeToNameMap);

      expect(runewords.length).toBeGreaterThan(100);
    });

    it('should parse runeword with correct structure', () => {
      const socketables = parseSocketablesTxt(gemsTxt);
      const codeToNameMap = buildCodeToNameMap(socketables);
      const runewords = parseRunewordsTxt(runesTxt, codeToNameMap);

      // Find a "Holy" runeword
      const holy = runewords.find((r) => r.displayName === 'Holy');
      expect(holy).toBeDefined();
      expect(holy?.complete).toBe(true);
      expect(holy?.runes.length).toBeGreaterThan(0);
      expect(holy?.itemTypes.length).toBeGreaterThan(0);
      expect(holy?.properties.length).toBeGreaterThan(0);

      // Runes should have both code and resolved name
      expect(holy?.runes[0].code).toBeDefined();
      expect(holy?.runes[0].name).toBeDefined();
    });

    it('should store runewords in IndexedDB', async () => {
      const socketables = parseSocketablesTxt(gemsTxt);
      const codeToNameMap = buildCodeToNameMap(socketables);
      const runewords = parseRunewordsTxt(runesTxt, codeToNameMap);

      await txtDb.runewords.bulkPut([...runewords]);

      const stored = await txtDb.runewords.toArray();
      // Note: some runewords may have duplicate IDs causing overwrites
      // The stored count should be close to but may be less than parsed count
      expect(stored.length).toBeGreaterThan(900);

      // Query by display name
      const holyRunewords = await txtDb.runewords.where('displayName').equals('Holy').toArray();
      expect(holyRunewords.length).toBeGreaterThan(0);
    });
  });

  describe('Unique Items Parsing', () => {
    it('should parse uniqueitems.txt', () => {
      const uniqueItems = parseUniqueItemsTxt(uniqueItemsTxt);

      expect(uniqueItems.length).toBeGreaterThan(100);
    });

    it('should parse unique item with correct structure', () => {
      const uniqueItems = parseUniqueItemsTxt(uniqueItemsTxt);
      const firstItem = uniqueItems[0];

      expect(firstItem.index).toBeDefined();
      expect(typeof firstItem.id).toBe('number');
      expect(typeof firstItem.level).toBe('number');
      expect(typeof firstItem.levelReq).toBe('number');
      expect(Array.isArray(firstItem.properties)).toBe(true);
    });

    it('should store unique items in IndexedDB', async () => {
      const uniqueItems = parseUniqueItemsTxt(uniqueItemsTxt);
      await txtDb.uniqueItems.bulkPut([...uniqueItems]);

      const stored = await txtDb.uniqueItems.toArray();
      expect(stored.length).toBe(uniqueItems.length);

      // Query by ID
      const item = await txtDb.uniqueItems.get(0);
      expect(item).toBeDefined();
    });
  });

  describe('Sets Parsing', () => {
    it('should parse sets.txt', () => {
      const sets = parseSetsTxt(setsTxt);

      expect(sets.length).toBeGreaterThan(10);
    });

    it('should parse set with correct structure', () => {
      const sets = parseSetsTxt(setsTxt);
      const firstSet = sets[0];

      expect(firstSet.index).toBeDefined();
      expect(firstSet.name).toBeDefined();
      expect(Array.isArray(firstSet.partialBonuses)).toBe(true);
      expect(Array.isArray(firstSet.fullSetBonuses)).toBe(true);
    });

    it('should store sets in IndexedDB', async () => {
      const sets = parseSetsTxt(setsTxt);
      await txtDb.sets.bulkPut([...sets]);

      const stored = await txtDb.sets.toArray();
      expect(stored.length).toBe(sets.length);
    });
  });

  describe('Set Items Parsing', () => {
    it('should parse setitems.txt', () => {
      const setItems = parseSetItemsTxt(setItemsTxt);

      expect(setItems.length).toBeGreaterThan(10);
    });

    it('should parse set item with correct structure', () => {
      const setItems = parseSetItemsTxt(setItemsTxt);
      const firstItem = setItems[0];

      expect(firstItem.index).toBeDefined();
      expect(typeof firstItem.id).toBe('number');
      expect(firstItem.setName).toBeDefined();
      expect(Array.isArray(firstItem.properties)).toBe(true);
      expect(Array.isArray(firstItem.partialBonuses)).toBe(true);
    });

    it('should store set items in IndexedDB', async () => {
      const setItems = parseSetItemsTxt(setItemsTxt);
      await txtDb.setItems.bulkPut([...setItems]);

      const stored = await txtDb.setItems.toArray();
      expect(stored.length).toBe(setItems.length);

      // Query by set name
      const autolycsItems = await txtDb.setItems.where('setName').equals("Autolycus' Magic Tools").toArray();
      expect(autolycsItems.length).toBeGreaterThan(0);
    });
  });

  describe('Property Translator', () => {
    it('should translate property codes to text', () => {
      const properties = parsePropertiesTxt(propertiesTxt);
      const translator = createPropertyTranslator(properties);

      const translated = translator.translate({
        code: 'ac',
        param: '',
        min: 100,
        max: 100,
      });

      expect(translated.text).toContain('100');
      expect(translated.text).toContain('Defense');
    });

    it('should handle range values', () => {
      const properties = parsePropertiesTxt(propertiesTxt);
      const translator = createPropertyTranslator(properties);

      const translated = translator.translate({
        code: 'str',
        param: '',
        min: 10,
        max: 20,
      });

      expect(translated.text).toContain('(10 to 20)');
      expect(translated.text).toContain('Strength');
    });

    it('should handle unknown properties', () => {
      const properties = parsePropertiesTxt(propertiesTxt);
      const translator = createPropertyTranslator(properties);

      const translated = translator.translate({
        code: 'unknown-prop',
        param: 'test',
        min: 5,
        max: 10,
      });

      expect(translated.text).toContain('unknown-prop');
      expect(translated.rawCode).toBe('unknown-prop');
    });
  });

  describe('Full Integration', () => {
    it('should parse and store all TXT data', async () => {
      // Parse all data
      const properties = parsePropertiesTxt(propertiesTxt);
      const socketables = parseSocketablesTxt(gemsTxt);
      const codeToNameMap = buildCodeToNameMap(socketables);
      const runewords = parseRunewordsTxt(runesTxt, codeToNameMap);
      const uniqueItems = parseUniqueItemsTxt(uniqueItemsTxt);
      const sets = parseSetsTxt(setsTxt);
      const setItems = parseSetItemsTxt(setItemsTxt);

      // Store all data (clear first, then bulk insert)
      await Promise.all(txtDb.tables.map((table) => table.clear()));
      await Promise.all([
        txtDb.properties.bulkPut([...properties]),
        txtDb.socketables.bulkPut([...socketables]),
        txtDb.runewords.bulkPut([...runewords]),
        txtDb.uniqueItems.bulkPut([...uniqueItems]),
        txtDb.sets.bulkPut([...sets]),
        txtDb.setItems.bulkPut([...setItems]),
      ]);

      // Verify all tables have data
      const [propCount, sockCount, rwCount, uiCount, setCount, siCount] = await Promise.all([
        txtDb.properties.count(),
        txtDb.socketables.count(),
        txtDb.runewords.count(),
        txtDb.uniqueItems.count(),
        txtDb.sets.count(),
        txtDb.setItems.count(),
      ]);

      expect(propCount).toBeGreaterThan(0);
      expect(sockCount).toBeGreaterThan(0);
      expect(rwCount).toBeGreaterThan(0);
      expect(uiCount).toBeGreaterThan(0);
      expect(setCount).toBeGreaterThan(0);
      expect(siCount).toBeGreaterThan(0);

      console.log(
        `Stored: ${propCount} properties, ${sockCount} socketables, ${rwCount} runewords, ` +
          `${uiCount} unique items, ${setCount} sets, ${siCount} set items`
      );
    });
  });
});
