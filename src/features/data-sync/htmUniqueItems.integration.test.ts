/**
 * Integration test for HTM unique items: parse → store → query
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { parseHtmUniqueItems } from './parsers/htmUniqueItemsParser';
import type { HtmUniqueItem, HtmUniqueItemPage } from '@/core/db';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const weaponsHtml = readFileSync(resolve(__dirname, '../../../test-fixtures/unique_weapons.htm'), 'utf-8');
const armorsHtml = readFileSync(resolve(__dirname, '../../../test-fixtures/unique_armors.htm'), 'utf-8');
const othersHtml = readFileSync(resolve(__dirname, '../../../test-fixtures/unique_others.htm'), 'utf-8');

// ─── Test database ──────────────────────────────────────────────────────────

class TestDb extends Dexie {
  htmUniqueItems!: Dexie.Table<HtmUniqueItem, number>;

  constructor() {
    super('test-htm-uniques');
    this.version(1).stores({
      htmUniqueItems: '++id, name, page, category, reqLevel',
    });
  }
}

let testDb: TestDb;
let allParsedItems: HtmUniqueItem[];

beforeAll(async () => {
  testDb = new TestDb();

  // Parse all 3 pages
  const weapons = parseHtmUniqueItems(weaponsHtml, 'weapons');
  const armors = parseHtmUniqueItems(armorsHtml, 'armors');
  const others = parseHtmUniqueItems(othersHtml, 'other');
  allParsedItems = [...weapons, ...armors, ...others];

  // Store in IndexedDB
  await testDb.htmUniqueItems.bulkPut(allParsedItems);
});

afterAll(async () => {
  await testDb.delete();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Parse → Store → Verify count
// ═══════════════════════════════════════════════════════════════════════════════

describe('Parse → Store → Query round-trip', () => {
  it('should store all parsed items in IndexedDB', async () => {
    const count = await testDb.htmUniqueItems.count();
    expect(count).toBe(allParsedItems.length);
    expect(count).toBeGreaterThanOrEqual(700);
  });

  it('should query items by page index', async () => {
    const weapons = await testDb.htmUniqueItems.where('page').equals('weapons').toArray();
    const armors = await testDb.htmUniqueItems.where('page').equals('armors').toArray();
    const others = await testDb.htmUniqueItems.where('page').equals('other').toArray();

    expect(weapons.length).toBeGreaterThanOrEqual(300);
    expect(armors.length).toBeGreaterThanOrEqual(200);
    expect(others.length).toBeGreaterThanOrEqual(80);
    expect(weapons.length + armors.length + others.length).toBe(allParsedItems.length);
  });

  it('should query items by category index', async () => {
    const axes = await testDb.htmUniqueItems.where('category').equals('Axe').toArray();
    expect(axes.length).toBeGreaterThan(0);

    // All axes should be weapons
    for (const item of axes) {
      expect(item.page).toBe('weapons');
    }
  });

  it('should query items by reqLevel index', async () => {
    const lowLevel = await testDb.htmUniqueItems.where('reqLevel').belowOrEqual(10).toArray();
    expect(lowLevel.length).toBeGreaterThan(0);

    for (const item of lowLevel) {
      expect(item.reqLevel).toBeLessThanOrEqual(10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Name uniqueness
// ═══════════════════════════════════════════════════════════════════════════════

describe('Name uniqueness', () => {
  it('should have bounded duplicate names across pages (normal + coupon variants)', () => {
    const names = new Set<string>();
    const duplicates: string[] = [];

    for (const item of allParsedItems) {
      if (names.has(item.name)) {
        duplicates.push(item.name);
      }
      names.add(item.name);
    }

    // Some items legitimately share names across pages (e.g., normal + Ancient Coupon variants)
    if (duplicates.length > 0) {
      console.log('[Test] Duplicate names (expected for coupon variants):', duplicates);
    }

    // Duplicates should be bounded — if this grows significantly, investigate
    expect(duplicates.length).toBeLessThanOrEqual(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Specific known items verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Known item verification from DB', () => {
  it("should retrieve Krok's Basher from DB", async () => {
    const items = await testDb.htmUniqueItems.where('name').equals("Krok's Basher").toArray();
    expect(items.length).toBe(1);
    const item = items[0];
    expect(item.page).toBe('weapons');
    expect(item.category).toBe('Axe');
    expect(item.baseItem).toBe('Hand Axe');
    expect(item.baseItemCode).toBe('hax');
    expect(item.itemLevel).toBe(4);
    expect(item.reqLevel).toBe(5);
    expect(item.notes).toBe('');
  });

  it('should round-trip the notes field through IndexedDB', async () => {
    const items = await testDb.htmUniqueItems.where('name').equals('Barbaric Devastator').toArray();
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.notes)).toContain('Blessed Edge Variant');

    const stored = await testDb.htmUniqueItems.toArray();
    const withNotes = stored.filter((i) => i.notes !== '');
    expect(withNotes.length).toBeGreaterThan(0);
    // Notes are a rare annotation — the overwhelming majority of items have none
    expect(withNotes.length / stored.length).toBeLessThan(0.1);
  });

  it('should have items from all 3 pages in DB', async () => {
    const pages: HtmUniqueItemPage[] = ['weapons', 'armors', 'other'];

    for (const page of pages) {
      const items = await testDb.htmUniqueItems.where('page').equals(page).toArray();
      expect(items.length, `${page} page should have items`).toBeGreaterThan(0);
    }
  });
});
