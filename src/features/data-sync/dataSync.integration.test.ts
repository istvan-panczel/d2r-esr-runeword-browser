import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { db } from '@/core/db/db';
import type { AffixPattern } from '@/core/db/models';
import { parseGemsHtml } from './parsers/gemsParser';
import { parseEsrRunesHtml } from './parsers/esrRunesParser';
import { parseLodRunesHtml } from './parsers/lodRunesParser';
import { parseKanjiRunesHtml } from './parsers/kanjiRunesParser';
import { parseCrystalsHtml } from './parsers/crystalsParser';
import { parseRunewordsHtml } from './parsers/runewordsParser';

describe('Data Sync Integration', () => {
  const gemsHtml = readFileSync(resolve(__dirname, '../../../public/data/gems.htm'), 'utf-8');
  const runewordsHtml = readFileSync(resolve(__dirname, '../../../public/data/runewords.htm'), 'utf-8');

  // Keep backward compatibility with existing tests
  const html = gemsHtml;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  describe('Gems → IndexedDB', () => {
    it('should parse and store all 48 gems', async () => {
      const gems = parseGemsHtml(html);
      await db.gems.bulkPut(gems);

      const storedGems = await db.gems.toArray();
      expect(storedGems).toHaveLength(48);
    });

    it('should store Perfect Ruby with correct properties', async () => {
      const gems = parseGemsHtml(html);
      await db.gems.bulkPut(gems);

      const ruby = await db.gems.get('Perfect Ruby');
      expect(ruby).toBeDefined();
      expect(ruby!.type).toBe('Ruby');
      expect(ruby!.quality).toBe('Perfect');
      expect(ruby!.color).toBe('RED');
      expect(ruby!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
    });

    it('should be queryable by type index', async () => {
      const gems = parseGemsHtml(html);
      await db.gems.bulkPut(gems);

      const rubies = await db.gems.where('type').equals('Ruby').toArray();
      expect(rubies).toHaveLength(6); // 6 qualities per type
    });
  });

  describe('ESR Runes → IndexedDB', () => {
    it('should parse and store all 47 ESR runes', async () => {
      const esrRunes = parseEsrRunesHtml(html);
      await db.esrRunes.bulkPut(esrRunes);

      const storedRunes = await db.esrRunes.toArray();
      expect(storedRunes).toHaveLength(47);
    });

    it('should store I Rune with correct properties', async () => {
      const esrRunes = parseEsrRunesHtml(html);
      await db.esrRunes.bulkPut(esrRunes);

      const iRune = await db.esrRunes.get('I Rune');
      expect(iRune).toBeDefined();
      expect(iRune!.tier).toBe(1);
      expect(iRune!.color).toBe('WHITE');
      expect(iRune!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
    });

    it('should be queryable by tier index', async () => {
      const esrRunes = parseEsrRunesHtml(html);
      await db.esrRunes.bulkPut(esrRunes);

      const tier1Runes = await db.esrRunes.where('tier').equals(1).toArray();
      expect(tier1Runes.length).toBeGreaterThan(0);
      tier1Runes.forEach((rune) => expect(rune.tier).toBe(1));
    });
  });

  describe('LoD Runes → IndexedDB', () => {
    it('should parse and store all 33 LoD runes', async () => {
      const lodRunes = parseLodRunesHtml(html);
      await db.lodRunes.bulkPut(lodRunes);

      const storedRunes = await db.lodRunes.toArray();
      expect(storedRunes).toHaveLength(33);
    });

    it('should store El Rune with correct properties', async () => {
      const lodRunes = parseLodRunesHtml(html);
      await db.lodRunes.bulkPut(lodRunes);

      const elRune = await db.lodRunes.get('El Rune');
      expect(elRune).toBeDefined();
      expect(elRune!.order).toBe(1);
      expect(elRune!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
    });

    it('should store Zod Rune as order 33', async () => {
      const lodRunes = parseLodRunesHtml(html);
      await db.lodRunes.bulkPut(lodRunes);

      const zodRune = await db.lodRunes.get('Zod Rune');
      expect(zodRune).toBeDefined();
      expect(zodRune!.order).toBe(33);
    });

    it('should be queryable by order index', async () => {
      const lodRunes = parseLodRunesHtml(html);
      await db.lodRunes.bulkPut(lodRunes);

      const firstFiveRunes = await db.lodRunes.where('order').between(1, 5, true, true).toArray();
      expect(firstFiveRunes).toHaveLength(5);
    });
  });

  describe('Kanji Runes → IndexedDB', () => {
    it('should parse and store all 14 Kanji runes', async () => {
      const kanjiRunes = parseKanjiRunesHtml(html);
      await db.kanjiRunes.bulkPut(kanjiRunes);

      const storedRunes = await db.kanjiRunes.toArray();
      expect(storedRunes).toHaveLength(14);
    });

    it('should store Moon Rune with correct properties', async () => {
      const kanjiRunes = parseKanjiRunesHtml(html);
      await db.kanjiRunes.bulkPut(kanjiRunes);

      const moonRune = await db.kanjiRunes.get('Moon Rune');
      expect(moonRune).toBeDefined();
      expect(moonRune!.reqLevel).toBe(60);
      expect(moonRune!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
    });

    it('should have all runes at level 60', async () => {
      const kanjiRunes = parseKanjiRunesHtml(html);
      await db.kanjiRunes.bulkPut(kanjiRunes);

      const storedRunes = await db.kanjiRunes.toArray();
      storedRunes.forEach((rune) => expect(rune.reqLevel).toBe(60));
    });
  });

  describe('Crystals → IndexedDB', () => {
    it('should parse and store all 36 crystals', async () => {
      const crystals = parseCrystalsHtml(html);
      await db.crystals.bulkPut(crystals);

      const storedCrystals = await db.crystals.toArray();
      expect(storedCrystals).toHaveLength(36);
    });

    it('should store Shadow Quartz with correct properties', async () => {
      const crystals = parseCrystalsHtml(html);
      await db.crystals.bulkPut(crystals);

      const shadowQuartz = await db.crystals.get('Shadow Quartz');
      expect(shadowQuartz).toBeDefined();
      expect(shadowQuartz!.type).toBe('Shadow Quartz');
      expect(shadowQuartz!.quality).toBe('Standard');
      expect(shadowQuartz!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
    });

    it('should be queryable by type index', async () => {
      const crystals = parseCrystalsHtml(html);
      await db.crystals.bulkPut(crystals);

      const shadowQuartzCrystals = await db.crystals.where('type').equals('Shadow Quartz').toArray();
      expect(shadowQuartzCrystals).toHaveLength(3); // 3 qualities per type
    });

    it('should have correct required levels for each quality', async () => {
      const crystals = parseCrystalsHtml(html);
      await db.crystals.bulkPut(crystals);

      const storedCrystals = await db.crystals.toArray();
      const chipped = storedCrystals.filter((c) => c.quality === 'Chipped');
      const flawed = storedCrystals.filter((c) => c.quality === 'Flawed');
      const standard = storedCrystals.filter((c) => c.quality === 'Standard');

      chipped.forEach((c) => expect(c.reqLevel).toBe(6));
      flawed.forEach((c) => expect(c.reqLevel).toBe(24));
      standard.forEach((c) => expect(c.reqLevel).toBe(42));
    });
  });

  describe('Runewords → IndexedDB', () => {
    it('should parse and store runewords (approximately 380-400)', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      const storedRunewords = await db.runewords.toArray();
      expect(storedRunewords.length).toBeGreaterThanOrEqual(380);
      expect(storedRunewords.length).toBeLessThanOrEqual(400);
    });

    it('should store Boar with correct properties', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      // Composite key: [name, variant]
      const boar = await db.runewords.get(['Boar', 1]);
      expect(boar).toBeDefined();
      expect(boar!.sockets).toBe(1);
      expect(boar!.runes).toEqual(['I Rune']);
      expect(boar!.allowedItems).toContain('Weapon');
      expect(boar!.excludedItems).toEqual([]);
      expect(boar!.affixes.length).toBeGreaterThan(0);
    });

    it('should store Stone with correct properties', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      // Composite key: [name, variant]
      const stone = await db.runewords.get(['Stone', 1]);
      expect(stone).toBeDefined();
      expect(stone!.sockets).toBe(2);
      expect(stone!.runes).toEqual(['I Rune', 'Shi Rune']);
      expect(stone!.affixes.length).toBeGreaterThan(0);
    });

    it('should store Airship with correct runes array', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      // Composite key: [name, variant]
      const airship = await db.runewords.get(['Airship', 1]);
      expect(airship).toBeDefined();
      expect(airship!.runes).toEqual(['Hi Rune', 'Ko Rune', 'U Rune', 'Se Rune', 'N Rune']);
      expect(airship!.sockets).toBe(5);
    });

    it('should store multi-variant runewords separately', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      // Feminine has 3 variants
      const feminine1 = await db.runewords.get(['Feminine', 1]);
      const feminine2 = await db.runewords.get(['Feminine', 2]);
      const feminine3 = await db.runewords.get(['Feminine', 3]);

      expect(feminine1).toBeDefined();
      expect(feminine2).toBeDefined();
      expect(feminine3).toBeDefined();

      // First variant has excluded items
      expect(feminine1!.excludedItems.length).toBeGreaterThan(0);
    });

    it('should be queryable by sockets index', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      const twoSocketRunewords = await db.runewords.where('sockets').equals(2).toArray();
      expect(twoSocketRunewords.length).toBeGreaterThan(0);
      twoSocketRunewords.forEach((rw) => expect(rw.sockets).toBe(2));
    });

    it('should have affixes without newlines or excessive whitespace', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      const storedRunewords = await db.runewords.toArray();

      for (const runeword of storedRunewords.slice(0, 50)) {
        for (const affix of runeword.affixes) {
          expect(affix.rawText).not.toMatch(/\n/);
          expect(affix.rawText).not.toMatch(/\s{2,}/);
        }
      }
    });
  });

  describe('Affixes → IndexedDB', () => {
    it('should extract unique affix patterns from all sources', async () => {
      // Parse and store all data
      const gems = parseGemsHtml(gemsHtml);
      const esrRunes = parseEsrRunesHtml(gemsHtml);
      const lodRunes = parseLodRunesHtml(gemsHtml);
      const kanjiRunes = parseKanjiRunesHtml(gemsHtml);
      const crystals = parseCrystalsHtml(gemsHtml);
      const runewords = parseRunewordsHtml(runewordsHtml);

      await db.gems.bulkPut(gems);
      await db.esrRunes.bulkPut(esrRunes);
      await db.lodRunes.bulkPut(lodRunes);
      await db.kanjiRunes.bulkPut(kanjiRunes);
      await db.crystals.bulkPut(crystals);
      await db.runewords.bulkPut(runewords);

      // Collect unique affixes (simulating what the saga does)
      const affixMap = new Map<string, AffixPattern>();

      for (const rw of runewords) {
        for (const affix of rw.affixes) {
          if (!affixMap.has(affix.pattern)) {
            affixMap.set(affix.pattern, { pattern: affix.pattern, valueType: affix.valueType });
          }
        }
      }

      const socketables = [...gems, ...esrRunes, ...lodRunes, ...kanjiRunes, ...crystals];
      for (const item of socketables) {
        for (const affix of [...item.bonuses.weaponsGloves, ...item.bonuses.helmsBoots, ...item.bonuses.armorShieldsBelts]) {
          if (!affixMap.has(affix.pattern)) {
            affixMap.set(affix.pattern, { pattern: affix.pattern, valueType: affix.valueType });
          }
        }
      }

      const uniqueAffixes = Array.from(affixMap.values());
      await db.affixes.bulkPut(uniqueAffixes);

      const storedAffixes = await db.affixes.toArray();
      expect(storedAffixes.length).toBeGreaterThan(100); // Should have many unique patterns
      expect(storedAffixes.length).toBeLessThan(2000); // But not an unreasonable amount
    });

    it('should store affixes with pattern as primary key', async () => {
      const gems = parseGemsHtml(gemsHtml);
      await db.gems.bulkPut(gems);

      // Get a sample affix from a gem
      const perfectRuby = gems.find((g) => g.name === 'Perfect Ruby');
      expect(perfectRuby).toBeDefined();
      const sampleAffix = perfectRuby!.bonuses.weaponsGloves[0];
      expect(sampleAffix).toBeDefined();

      // Store it in affixes table (only pattern + valueType)
      await db.affixes.put({ pattern: sampleAffix.pattern, valueType: sampleAffix.valueType });

      // Should be retrievable by pattern
      const retrieved = await db.affixes.get(sampleAffix.pattern);
      expect(retrieved).toBeDefined();
      expect(retrieved!.valueType).toBe(sampleAffix.valueType);
    });

    it('should have valid affix properties', async () => {
      const runewords = parseRunewordsHtml(runewordsHtml);
      await db.runewords.bulkPut(runewords);

      // Get sample affixes
      const boar = runewords.find((rw) => rw.name === 'Boar' && rw.variant === 1);
      expect(boar).toBeDefined();

      for (const affix of boar!.affixes) {
        await db.affixes.put({ pattern: affix.pattern, valueType: affix.valueType });
      }

      const storedAffixes = await db.affixes.toArray();
      for (const affix of storedAffixes) {
        expect(affix.pattern).toBeDefined();
        expect(['flat', 'percent', 'range', 'none']).toContain(affix.valueType);
      }
    });
  });
});
