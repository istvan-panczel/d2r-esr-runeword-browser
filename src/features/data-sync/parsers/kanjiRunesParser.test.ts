import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isKanjiRuneName, parseKanjiRunesHtml } from './kanjiRunesParser';

describe('isKanjiRuneName', () => {
  it('should return true for Kanji rune names with BLUE color', () => {
    expect(isKanjiRuneName('Moon Rune', 'BLUE')).toBe(true);
    expect(isKanjiRuneName('Fire Rune', 'BLUE')).toBe(true);
    expect(isKanjiRuneName('Water Rune', 'BLUE')).toBe(true);
  });

  it('should return false for non-BLUE colors', () => {
    expect(isKanjiRuneName('Moon Rune', 'WHITE')).toBe(false);
    expect(isKanjiRuneName('Fire Rune', 'RED')).toBe(false);
    expect(isKanjiRuneName('Water Rune', null)).toBe(false);
  });

  it('should return false for names without " Rune" suffix', () => {
    expect(isKanjiRuneName('Moon', 'BLUE')).toBe(false);
  });
});

describe('parseKanjiRunesHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

  it('should parse Kanji runes (approximately 11-14)', () => {
    const kanjiRunes = parseKanjiRunesHtml(html);
    expect(kanjiRunes.length).toBeGreaterThanOrEqual(10);
    expect(kanjiRunes.length).toBeLessThanOrEqual(16);
  });

  it('should have all runes at level 60', () => {
    const kanjiRunes = parseKanjiRunesHtml(html);

    for (const rune of kanjiRunes) {
      expect(rune.reqLevel).toBe(60);
    }
  });

  it('should parse Moon Rune correctly', () => {
    const kanjiRunes = parseKanjiRunesHtml(html);
    const moonRune = kanjiRunes.find((r) => r.name === 'Moon Rune');

    expect(moonRune).toBeDefined();
    expect(moonRune!.reqLevel).toBe(60);
    expect(moonRune!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
  });

  it('should parse Fire Rune correctly', () => {
    const kanjiRunes = parseKanjiRunesHtml(html);
    const fireRune = kanjiRunes.find((r) => r.name === 'Fire Rune');

    expect(fireRune).toBeDefined();
    expect(fireRune!.reqLevel).toBe(60);
  });

  it('should not include ESR runes', () => {
    const kanjiRunes = parseKanjiRunesHtml(html);

    expect(kanjiRunes.find((r) => r.name === 'I Rune')).toBeUndefined();
    expect(kanjiRunes.find((r) => r.name === 'Null Rune')).toBeUndefined();
  });

  it('should not include LoD runes', () => {
    const kanjiRunes = parseKanjiRunesHtml(html);

    expect(kanjiRunes.find((r) => r.name === 'El Rune')).toBeUndefined();
    expect(kanjiRunes.find((r) => r.name === 'Zod Rune')).toBeUndefined();
  });

  it('should parse bonuses for all Kanji runes', () => {
    const kanjiRunes = parseKanjiRunesHtml(html);

    for (const rune of kanjiRunes) {
      expect(rune.bonuses.weaponsGloves.length).toBeGreaterThan(0);
      expect(rune.bonuses.helmsBoots.length).toBeGreaterThan(0);
      expect(rune.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
    }
  });
});
