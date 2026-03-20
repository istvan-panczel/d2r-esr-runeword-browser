/**
 * Integration test for mythical uniques: parse → store → query
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { parseMythicalUniques } from './parsers/mythicalUniquesParser';
import type { MythicalUnique } from '@/core/db';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mythicalsHtml = readFileSync(resolve(__dirname, '../../../test-fixtures/unique_mythicals.htm'), 'utf-8');

// ─── Test database ──────────────────────────────────────────────────────────

class TestDb extends Dexie {
  mythicalUniques!: Dexie.Table<MythicalUnique, number>;

  constructor() {
    super('test-mythical-uniques');
    this.version(1).stores({
      mythicalUniques: '++id, name, category, reqLevel',
    });
  }
}

let testDb: TestDb;
let allParsedItems: MythicalUnique[];

beforeAll(async () => {
  testDb = new TestDb();

  // Parse mythicals
  allParsedItems = parseMythicalUniques(mythicalsHtml);

  // Store in IndexedDB
  await testDb.mythicalUniques.bulkPut(allParsedItems);
});

afterAll(async () => {
  await testDb.delete();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Parse → Store → Verify count
// ═══════════════════════════════════════════════════════════════════════════════

describe('Parse → Store → Query round-trip', () => {
  it('should store all parsed items in IndexedDB', async () => {
    const count = await testDb.mythicalUniques.count();
    expect(count).toBe(allParsedItems.length);
    expect(count).toBeGreaterThanOrEqual(30);
  });

  it('should query items by category index', async () => {
    const weapons = await testDb.mythicalUniques.where('category').equals('Mythical Unique Weapons').toArray();
    expect(weapons.length).toBeGreaterThanOrEqual(20);

    const armor = await testDb.mythicalUniques.where('category').equals('Mythical Unique Armor').toArray();
    expect(armor.length).toBeGreaterThan(0);

    const jewelry = await testDb.mythicalUniques.where('category').equals('Mythical Unique Jewelry').toArray();
    expect(jewelry.length).toBeGreaterThan(0);

    const dedicated = await testDb.mythicalUniques.where('category').equals('Dedicated Drops Mythical Uniques').toArray();
    expect(dedicated.length).toBeGreaterThan(0);
  });

  it('should query items by reqLevel index', async () => {
    const highLevel = await testDb.mythicalUniques.where('reqLevel').aboveOrEqual(90).toArray();
    expect(highLevel.length).toBeGreaterThan(0);

    for (const item of highLevel) {
      expect(item.reqLevel).toBeGreaterThanOrEqual(90);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Known item verification from DB
// ═══════════════════════════════════════════════════════════════════════════════

describe('Known item verification from DB', () => {
  it("should retrieve Mephisto's Will from DB", async () => {
    const items = await testDb.mythicalUniques.where('name').equals("Mephisto's Will").toArray();
    expect(items.length).toBe(1);
    const item = items[0];
    expect(item.category).toBe('Mythical Unique Weapons');
    expect(item.baseItem).toBe('Mythical Demonic Wand');
    expect(item.baseItemLink).toBe('weapons.htm#m04');
    expect(item.itemLevel).toBe(100);
    expect(item.reqLevel).toBe(90);
    expect(item.properties.length).toBeGreaterThan(0);
    expect(item.specialProperties.length).toBeGreaterThan(0);
    expect(item.specialProperties[0]).toContain('Skeletal Mages');
    expect(item.imageUrl).toBe('./images/mythical-uniques/mephistos_will.png');
  });

  it('should retrieve Headhunter from DB with notes', async () => {
    const items = await testDb.mythicalUniques.where('name').equals('Headhunter').toArray();
    expect(items.length).toBe(1);
    const item = items[0];
    expect(item.category).toBe('Mythical Unique Armor');
    expect(item.notes.length).toBeGreaterThan(0);
    expect(item.notes[0]).toContain('trophy effect');
  });

  it('should have items from all 4 categories in DB', async () => {
    const categories = ['Mythical Unique Weapons', 'Mythical Unique Armor', 'Mythical Unique Jewelry', 'Dedicated Drops Mythical Uniques'];

    for (const category of categories) {
      const items = await testDb.mythicalUniques.where('category').equals(category).toArray();
      expect(items.length, `${category} should have items`).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Data integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data integrity', () => {
  it('all stored items should have auto-incremented IDs', async () => {
    const items = await testDb.mythicalUniques.toArray();
    for (const item of items) {
      expect(item.id).toBeDefined();
      expect(item.id).toBeGreaterThan(0);
    }
  });

  it('all stored items should preserve special properties and notes arrays', async () => {
    const items = await testDb.mythicalUniques.toArray();
    for (const item of items) {
      expect(Array.isArray(item.properties)).toBe(true);
      expect(Array.isArray(item.specialProperties)).toBe(true);
      expect(Array.isArray(item.notes)).toBe(true);
    }
  });
});
