import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isEsrRuneName, parseEsrRunesHtml } from './esrRunesParser';

describe('isEsrRuneName', () => {
  it('should return true for ESR rune names with valid colors', () => {
    expect(isEsrRuneName('I Rune', 'WHITE')).toBe(true);
    expect(isEsrRuneName('Ka Rune', 'WHITE')).toBe(true);
    expect(isEsrRuneName('Null Rune', 'PURPLE')).toBe(true);
  });

  it('should return false for Kanji runes (BLUE color)', () => {
    expect(isEsrRuneName('Moon Rune', 'BLUE')).toBe(false);
    expect(isEsrRuneName('Fire Rune', 'BLUE')).toBe(false);
  });

  it('should return true for runes with color even if name matches LoD (e.g. Ko)', () => {
    // Ko Rune exists in both ESR and LoD - distinguished by color in HTML
    // LoD Ko has no color, ESR Ko has YELLOW color
    expect(isEsrRuneName('Ko Rune', 'YELLOW')).toBe(true);
    // LoD runes in reality have no color (null), which returns false
    expect(isEsrRuneName('El Rune', null)).toBe(false);
  });

  it('should return false for null color', () => {
    expect(isEsrRuneName('I Rune', null)).toBe(false);
  });

  it('should return false for names without " Rune" suffix', () => {
    expect(isEsrRuneName('I', 'WHITE')).toBe(false);
  });
});

describe('parseEsrRunesHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

  it('should parse ESR runes (approximately 47)', () => {
    const esrRunes = parseEsrRunesHtml(html);
    // ESR runes count may vary, but should be around 47
    expect(esrRunes.length).toBeGreaterThanOrEqual(40);
    expect(esrRunes.length).toBeLessThanOrEqual(55);
  });

  it('should have correct tier assignments based on color', () => {
    const esrRunes = parseEsrRunesHtml(html);

    const whiteRunes = esrRunes.filter((r) => r.color === 'WHITE');
    const redRunes = esrRunes.filter((r) => r.color === 'RED');
    const goldRunes = esrRunes.filter((r) => r.color === 'GOLD');
    const purpleRunes = esrRunes.filter((r) => r.color === 'PURPLE');

    // All WHITE runes should be tier 1
    for (const rune of whiteRunes) {
      expect(rune.tier).toBe(1);
    }

    // All RED runes should be tier 2
    for (const rune of redRunes) {
      expect(rune.tier).toBe(2);
    }

    // All GOLD runes should be tier 6
    for (const rune of goldRunes) {
      expect(rune.tier).toBe(6);
    }

    // All PURPLE runes should be tier 7
    for (const rune of purpleRunes) {
      expect(rune.tier).toBe(7);
    }
  });

  it('should parse I Rune correctly', () => {
    const esrRunes = parseEsrRunesHtml(html);
    const iRune = esrRunes.find((r) => r.name === 'I Rune');

    expect(iRune).toBeDefined();
    expect(iRune!.color).toBe('WHITE');
    expect(iRune!.tier).toBe(1);
    expect(iRune!.reqLevel).toBe(2);
  });

  it('should parse Null Rune correctly', () => {
    const esrRunes = parseEsrRunesHtml(html);
    const nullRune = esrRunes.find((r) => r.name === 'Null Rune');

    expect(nullRune).toBeDefined();
    expect(nullRune!.color).toBe('PURPLE');
    expect(nullRune!.tier).toBe(7);
  });

  it('should not include LoD runes', () => {
    const esrRunes = parseEsrRunesHtml(html);

    expect(esrRunes.find((r) => r.name === 'El Rune')).toBeUndefined();
    expect(esrRunes.find((r) => r.name === 'Zod Rune')).toBeUndefined();
  });

  it('should not include Kanji runes', () => {
    const esrRunes = parseEsrRunesHtml(html);

    expect(esrRunes.find((r) => r.name === 'Moon Rune')).toBeUndefined();
    expect(esrRunes.find((r) => r.name === 'Fire Rune')).toBeUndefined();
  });

  it('should parse bonuses for most ESR runes', () => {
    const esrRunes = parseEsrRunesHtml(html);

    // Most ESR runes should have bonuses (some edge cases may have empty categories)
    const runesWithBonuses = esrRunes.filter(
      (r) => r.bonuses.weaponsGloves.length > 0 || r.bonuses.helmsBoots.length > 0 || r.bonuses.armorShieldsBelts.length > 0
    );

    expect(runesWithBonuses.length).toBeGreaterThan(40);
  });
});
