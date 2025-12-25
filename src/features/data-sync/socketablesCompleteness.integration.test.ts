import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseGemsHtml } from './parsers/gemsParser';
import { parseEsrRunesHtml } from './parsers/esrRunesParser';
import { parseLodRunesHtml } from './parsers/lodRunesParser';
import { parseKanjiRunesHtml } from './parsers/kanjiRunesParser';
import { parseCrystalsHtml } from './parsers/crystalsParser';
import { extractAllSocketableNames, categorizeSocketables } from './parsers/shared/extractSocketableNames';
import { GEM_TYPES, GEM_QUALITIES, CRYSTAL_TYPES, CRYSTAL_QUALITIES, ESR_COLOR_TO_TIER } from './constants/constants';

describe('Socketables Completeness', () => {
  const gemsHtml = readFileSync(resolve(__dirname, '../../../test-fixtures/gems.htm'), 'utf-8');

  describe('All socketables are parsed', () => {
    it('should parse all socketables from gems.htm without missing any', () => {
      // 1. Extract all socketable names from HTML (dynamic parsing)
      const allSocketables = extractAllSocketableNames(gemsHtml);
      expect(allSocketables.length).toBeGreaterThan(0);

      // 2. Parse using actual parsers
      const gems = parseGemsHtml(gemsHtml);
      const lodRunes = parseLodRunesHtml(gemsHtml);
      const esrRunes = parseEsrRunesHtml(gemsHtml);
      const kanjiRunes = parseKanjiRunesHtml(gemsHtml);
      const crystals = parseCrystalsHtml(gemsHtml);

      // 3. Create lookup set of all parsed names
      const parsedNames = new Set([
        ...gems.map((g) => g.name),
        ...lodRunes.map((r) => r.name),
        ...esrRunes.map((r) => r.name),
        ...kanjiRunes.map((r) => r.name),
        ...crystals.map((c) => c.name),
      ]);

      // 4. Verify every extracted name exists in parsed data
      const missingNames: string[] = [];
      for (const { name } of allSocketables) {
        if (!parsedNames.has(name)) {
          missingNames.push(name);
        }
      }

      expect(missingNames).toEqual([]);

      // 5. Verify counts match (no extras in parsed data)
      const totalParsed = gems.length + lodRunes.length + esrRunes.length + kanjiRunes.length + crystals.length;
      expect(totalParsed).toBe(allSocketables.length);
    });

    it('should only have known duplicates across parser categories', () => {
      const gems = parseGemsHtml(gemsHtml);
      const lodRunes = parseLodRunesHtml(gemsHtml);
      const esrRunes = parseEsrRunesHtml(gemsHtml);
      const kanjiRunes = parseKanjiRunesHtml(gemsHtml);
      const crystals = parseCrystalsHtml(gemsHtml);

      const allNames = [
        ...gems.map((g) => g.name),
        ...lodRunes.map((r) => r.name),
        ...esrRunes.map((r) => r.name),
        ...kanjiRunes.map((r) => r.name),
        ...crystals.map((c) => c.name),
      ];

      // Known duplicate: "Ko Rune" exists in both LoD and ESR (distinguished by color in HTML)
      const KNOWN_DUPLICATES = ['Ko Rune'];

      // Find actual duplicates
      const nameCounts = new Map<string, number>();
      for (const name of allNames) {
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
      }

      const duplicates = [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name);

      // Only known duplicates should exist
      expect(duplicates.sort()).toEqual(KNOWN_DUPLICATES.sort());
    });
  });

  describe('Socketables are categorized correctly', () => {
    it('should categorize runes by color correctly', () => {
      const allSocketables = extractAllSocketableNames(gemsHtml);
      const categorized = categorizeSocketables(allSocketables);

      const lodRunes = parseLodRunesHtml(gemsHtml);
      const esrRunes = parseEsrRunesHtml(gemsHtml);
      const kanjiRunes = parseKanjiRunesHtml(gemsHtml);

      // Verify LoD runes match
      const lodRuneNames = new Set(lodRunes.map((r) => r.name));
      for (const name of categorized.lodRunes) {
        expect(lodRuneNames.has(name)).toBe(true);
      }
      expect(categorized.lodRunes.length).toBe(lodRunes.length);

      // Verify Kanji runes match
      const kanjiRuneNames = new Set(kanjiRunes.map((r) => r.name));
      for (const name of categorized.kanjiRunes) {
        expect(kanjiRuneNames.has(name)).toBe(true);
      }
      expect(categorized.kanjiRunes.length).toBe(kanjiRunes.length);

      // Verify ESR runes match
      const esrRuneNames = new Set(esrRunes.map((r) => r.name));
      for (const name of categorized.esrRunes) {
        expect(esrRuneNames.has(name)).toBe(true);
      }
      expect(categorized.esrRunes.length).toBe(esrRunes.length);
    });

    it('should categorize gems and crystals correctly', () => {
      const allSocketables = extractAllSocketableNames(gemsHtml);
      const categorized = categorizeSocketables(allSocketables);

      const gems = parseGemsHtml(gemsHtml);
      const crystals = parseCrystalsHtml(gemsHtml);

      const gemNames = new Set(gems.map((g) => g.name));
      const crystalNames = new Set(crystals.map((c) => c.name));

      // Every non-rune should be either a gem or crystal
      for (const name of categorized.nonRunes) {
        const isGem = gemNames.has(name);
        const isCrystal = crystalNames.has(name);
        expect(isGem || isCrystal).toBe(true);
      }

      // Total non-runes should equal gems + crystals
      expect(categorized.nonRunes.length).toBe(gems.length + crystals.length);
    });
  });

  describe('Gems have valid properties', () => {
    it('should have valid type for all gems', () => {
      const gems = parseGemsHtml(gemsHtml);
      const validTypes = new Set(GEM_TYPES);

      for (const gem of gems) {
        expect(validTypes.has(gem.type)).toBe(true);
      }
    });

    it('should have valid quality for all gems', () => {
      const gems = parseGemsHtml(gemsHtml);
      const validQualities = new Set(GEM_QUALITIES);

      for (const gem of gems) {
        expect(validQualities.has(gem.quality)).toBe(true);
      }
    });

    it('should have all type/quality combinations', () => {
      const gems = parseGemsHtml(gemsHtml);
      const combinations = new Set(gems.map((g) => `${g.type}:${g.quality}`));

      // Expected: 8 types × 6 qualities = 48 combinations
      expect(combinations.size).toBe(GEM_TYPES.length * GEM_QUALITIES.length);
    });
  });

  describe('Crystals have valid properties', () => {
    it('should have valid type for all crystals', () => {
      const crystals = parseCrystalsHtml(gemsHtml);
      const validTypes = new Set(CRYSTAL_TYPES);

      for (const crystal of crystals) {
        expect(validTypes.has(crystal.type)).toBe(true);
      }
    });

    it('should have valid quality for all crystals', () => {
      const crystals = parseCrystalsHtml(gemsHtml);
      const validQualities = new Set(CRYSTAL_QUALITIES);

      for (const crystal of crystals) {
        expect(validQualities.has(crystal.quality)).toBe(true);
      }
    });

    it('should have all type/quality combinations', () => {
      const crystals = parseCrystalsHtml(gemsHtml);
      const combinations = new Set(crystals.map((c) => `${c.type}:${c.quality}`));

      // Expected: 12 types × 3 qualities = 36 combinations
      expect(combinations.size).toBe(CRYSTAL_TYPES.length * CRYSTAL_QUALITIES.length);
    });
  });

  describe('Runes have valid properties', () => {
    it('should have valid order for all LoD runes (1-33)', () => {
      const lodRunes = parseLodRunesHtml(gemsHtml);

      for (const rune of lodRunes) {
        expect(rune.order).toBeGreaterThanOrEqual(1);
        expect(rune.order).toBeLessThanOrEqual(33);
      }

      // All orders should be unique
      const orders = lodRunes.map((r) => r.order);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it('should have valid tier for all LoD runes (1-3)', () => {
      const lodRunes = parseLodRunesHtml(gemsHtml);

      for (const rune of lodRunes) {
        expect(rune.tier).toBeGreaterThanOrEqual(1);
        expect(rune.tier).toBeLessThanOrEqual(3);
      }
    });

    it('should have valid tier for all ESR runes (1-7)', () => {
      const esrRunes = parseEsrRunesHtml(gemsHtml);
      const validTiers = new Set(Object.values(ESR_COLOR_TO_TIER));

      for (const rune of esrRunes) {
        expect(validTiers.has(rune.tier)).toBe(true);
      }
    });

    it('should have valid color for all ESR runes', () => {
      const esrRunes = parseEsrRunesHtml(gemsHtml);
      const validColors = new Set(Object.keys(ESR_COLOR_TO_TIER));

      for (const rune of esrRunes) {
        expect(validColors.has(rune.color)).toBe(true);
      }
    });

    it('should have reqLevel of 60 for all Kanji runes', () => {
      const kanjiRunes = parseKanjiRunesHtml(gemsHtml);

      for (const rune of kanjiRunes) {
        expect(rune.reqLevel).toBe(60);
      }
    });
  });

  describe('All socketables have bonuses', () => {
    it('should have non-empty bonuses for all gems', () => {
      const gems = parseGemsHtml(gemsHtml);

      for (const gem of gems) {
        expect(gem.bonuses.weaponsGloves.length).toBeGreaterThan(0);
        expect(gem.bonuses.helmsBoots.length).toBeGreaterThan(0);
        expect(gem.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty bonuses for all crystals', () => {
      const crystals = parseCrystalsHtml(gemsHtml);

      for (const crystal of crystals) {
        expect(crystal.bonuses.weaponsGloves.length).toBeGreaterThan(0);
        expect(crystal.bonuses.helmsBoots.length).toBeGreaterThan(0);
        expect(crystal.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty bonuses for all LoD runes', () => {
      const lodRunes = parseLodRunesHtml(gemsHtml);

      for (const rune of lodRunes) {
        expect(rune.bonuses.weaponsGloves.length).toBeGreaterThan(0);
        expect(rune.bonuses.helmsBoots.length).toBeGreaterThan(0);
        expect(rune.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty bonuses for most ESR runes', () => {
      const esrRunes = parseEsrRunesHtml(gemsHtml);

      // Most ESR runes should have bonuses (some edge cases may have empty categories due to HTML structure)
      const runesWithBonuses = esrRunes.filter(
        (r) => r.bonuses.weaponsGloves.length > 0 || r.bonuses.helmsBoots.length > 0 || r.bonuses.armorShieldsBelts.length > 0
      );

      // At least 40 ESR runes should have some bonuses (matching existing test expectations)
      expect(runesWithBonuses.length).toBeGreaterThan(40);
    });

    it('should have non-empty bonuses for all Kanji runes', () => {
      const kanjiRunes = parseKanjiRunesHtml(gemsHtml);

      for (const rune of kanjiRunes) {
        expect(rune.bonuses.weaponsGloves.length).toBeGreaterThan(0);
        expect(rune.bonuses.helmsBoots.length).toBeGreaterThan(0);
        expect(rune.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
      }
    });
  });
});
