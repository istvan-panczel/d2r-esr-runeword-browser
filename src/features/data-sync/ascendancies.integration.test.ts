/**
 * Integration test for ascendancies: parse → store → query
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { parseAscendanciesPage } from './parsers/ascendanciesParser';
import type { Ascendancy, AscendancyChallenge, AscendancySection } from '@/core/db';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ascendanciesHtml = readFileSync(resolve(__dirname, '../../../test-fixtures/ascendancies.htm'), 'utf-8');

// ─── Test database ──────────────────────────────────────────────────────────

class TestDb extends Dexie {
  ascendancies!: Dexie.Table<Ascendancy, string>;
  ascendancyChallenges!: Dexie.Table<AscendancyChallenge, number>;
  ascendancySections!: Dexie.Table<AscendancySection, string>;

  constructor() {
    super('test-ascendancies');
    this.version(1).stores({
      ascendancies: 'name',
      ascendancyChallenges: 'tier',
      ascendancySections: 'title',
    });
  }
}

let testDb: TestDb;
let allParsedItems: Ascendancy[];
let allParsedChallenges: AscendancyChallenge[];
let allParsedSections: AscendancySection[];

beforeAll(async () => {
  testDb = new TestDb();

  // Parse ascendancies, their challenges and the other sections
  const page = parseAscendanciesPage(ascendanciesHtml);
  allParsedItems = page.ascendancies;
  allParsedChallenges = page.challenges;
  allParsedSections = page.sections;

  // Store in IndexedDB
  await testDb.ascendancies.bulkPut(allParsedItems);
  await testDb.ascendancyChallenges.bulkPut(allParsedChallenges);
  await testDb.ascendancySections.bulkPut(allParsedSections);
});

afterAll(async () => {
  await testDb.delete();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Parse → Store → Verify count
// ═══════════════════════════════════════════════════════════════════════════════

describe('Parse → Store → Query round-trip', () => {
  it('should store all parsed items in IndexedDB', async () => {
    const count = await testDb.ascendancies.count();
    expect(count).toBe(allParsedItems.length);
    expect(count).toBe(15);
  });

  it('should query items by name index', async () => {
    const battlemage = await testDb.ascendancies.get('Battlemage');
    expect(battlemage).toBeDefined();
    expect(battlemage!.name).toBe('Battlemage');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Known item verification from DB
// ═══════════════════════════════════════════════════════════════════════════════

describe('Known item verification from DB', () => {
  it('should retrieve Battlemage from DB with all fields', async () => {
    const item = await testDb.ascendancies.get('Battlemage');
    expect(item).toBeDefined();
    expect(item!.name).toBe('Battlemage');
    expect(item!.imageUrl).toContain('battlemage');
    expect(item!.tiers.length).toBe(5);
    expect(item!.tiers[0].tier).toBe(1);
    expect(item!.tiers[0].bonuses).toContain('+1 to Class Skill Levels');
    expect(item!.footnotes.length).toBe(1);
    expect(item!.footnotes[0]).toContain('Total Defense Bonus');
  });

  it('should store the five challenges keyed by tier', async () => {
    const tiers = await testDb.ascendancyChallenges.toArray();
    expect(tiers.map((c) => c.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(tiers[0].description.join(' ')).toContain('consumed to unlock the ascendancy panel');
    const tier4 = await testDb.ascendancyChallenges.get(4);
    expect(tier4?.description[0]).toContain('Primordial Soulstones');
    expect(tier4?.description[0]).toContain('unlocked automatically');
  });

  it('should store the Lich King Bonus section keyed by its title', async () => {
    const lichKing = await testDb.ascendancySections.get('Lich King Bonus');
    expect(lichKing?.order).toBe(0);
    expect(lichKing?.description).toEqual([
      'Killing the Lich King on /players 8 difficulty unlocks an additional bonus that increases the tier 3 and 4 stat scaling bonuses by 10%.',
    ]);
    expect(await testDb.ascendancySections.count()).toBe(1);
  });

  it('should retrieve Worldshaper from DB with footnotes', async () => {
    const item = await testDb.ascendancies.get('Worldshaper');
    expect(item).toBeDefined();
    expect(item!.footnotes.length).toBeGreaterThanOrEqual(2);
  });

  it('should retrieve Awakened from DB with 3 footnotes', async () => {
    const item = await testDb.ascendancies.get('Awakened');
    expect(item).toBeDefined();
    expect(item!.footnotes.length).toBe(3);
    expect(item!.footnotes.some((fn) => fn.includes('Annihilation'))).toBe(true);
  });

  it('should have all 15 ascendancies in DB', async () => {
    const all = await testDb.ascendancies.toArray();
    const names = all.map((a) => a.name).sort();
    expect(names).toEqual([
      'Arcanist',
      'Awakened',
      'Battlemage',
      'Berserker',
      'Blademaster',
      'Bloodmage',
      'Ironbolt',
      'Lifebreaker',
      'Mana Warden',
      'Nomad',
      'Sharpshooter',
      'Soul Warden',
      'Stance Dancer',
      'Starborn',
      'Worldshaper',
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Data integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data integrity', () => {
  it('all stored items should have name as primary key', async () => {
    const items = await testDb.ascendancies.toArray();
    for (const item of items) {
      expect(item.name).toBeDefined();
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it('all stored items should preserve tiers and footnotes arrays', async () => {
    const items = await testDb.ascendancies.toArray();
    for (const item of items) {
      expect(Array.isArray(item.tiers)).toBe(true);
      expect(Array.isArray(item.footnotes)).toBe(true);
      expect(item.tiers.length).toBe(5);
    }
  });

  it('all tiers should have bonuses arrays', async () => {
    const items = await testDb.ascendancies.toArray();
    for (const item of items) {
      for (const tier of item.tiers) {
        expect(Array.isArray(tier.bonuses)).toBe(true);
        expect(tier.bonuses.length).toBeGreaterThan(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Data snapshot counts
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data snapshot counts', () => {
  it('should report counts for tracking ESR updates', async () => {
    const items = await testDb.ascendancies.toArray();
    const total = items.length;
    const withFootnotes = items.filter((i) => i.footnotes.length > 0).length;
    const withoutFootnotes = items.filter((i) => i.footnotes.length === 0).length;

    console.log('[Test] Ascendancies DB snapshot:', {
      total,
      withFootnotes,
      withoutFootnotes,
    });

    expect(total).toBe(15);
  });
});
