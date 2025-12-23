import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isLodRuneName, getLodRuneOrder, parseLodRunesHtml } from './lodRunesParser';

describe('isLodRuneName', () => {
  it('should return true for LoD rune names', () => {
    expect(isLodRuneName('El Rune')).toBe(true);
    expect(isLodRuneName('Zod Rune')).toBe(true);
    expect(isLodRuneName('Jah Rune')).toBe(true);
    expect(isLodRuneName('Ber Rune')).toBe(true);
  });

  it('should return false for ESR rune names', () => {
    expect(isLodRuneName('I Rune')).toBe(false);
    expect(isLodRuneName('Ka Rune')).toBe(false);
    expect(isLodRuneName('Null Rune')).toBe(false);
  });

  it('should return false for names without " Rune" suffix', () => {
    expect(isLodRuneName('El')).toBe(false);
    expect(isLodRuneName('Zod')).toBe(false);
  });

  it('should return false for non-rune names', () => {
    expect(isLodRuneName('Perfect Ruby')).toBe(false);
    expect(isLodRuneName('Shadow Quartz')).toBe(false);
  });
});

describe('getLodRuneOrder', () => {
  it('should return correct order for LoD runes', () => {
    expect(getLodRuneOrder('El Rune')).toBe(1);
    expect(getLodRuneOrder('Eld Rune')).toBe(2);
    expect(getLodRuneOrder('Tir Rune')).toBe(3);
    expect(getLodRuneOrder('Zod Rune')).toBe(33);
  });

  it('should return 0 for invalid runes', () => {
    expect(getLodRuneOrder('I Rune')).toBe(0);
    expect(getLodRuneOrder('Invalid')).toBe(0);
  });
});

describe('parseLodRunesHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../public/data/gems.htm'), 'utf-8');

  it('should parse exactly 33 LoD runes (El to Zod)', () => {
    const lodRunes = parseLodRunesHtml(html);
    expect(lodRunes).toHaveLength(33);
  });

  it('should have runes in correct order', () => {
    const lodRunes = parseLodRunesHtml(html);

    expect(lodRunes[0].name).toBe('El Rune');
    expect(lodRunes[0].order).toBe(1);

    expect(lodRunes[32].name).toBe('Zod Rune');
    expect(lodRunes[32].order).toBe(33);
  });

  it('should parse El Rune correctly', () => {
    const lodRunes = parseLodRunesHtml(html);
    const elRune = lodRunes.find((r) => r.name === 'El Rune');

    expect(elRune).toBeDefined();
    expect(elRune!.order).toBe(1);
    expect(elRune!.reqLevel).toBe(11);
    expect(elRune!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
  });

  it('should parse Zod Rune correctly', () => {
    const lodRunes = parseLodRunesHtml(html);
    const zodRune = lodRunes.find((r) => r.name === 'Zod Rune');

    expect(zodRune).toBeDefined();
    expect(zodRune!.order).toBe(33);
    expect(zodRune!.reqLevel).toBe(69);
  });

  it('should parse bonuses for all LoD runes', () => {
    const lodRunes = parseLodRunesHtml(html);

    for (const rune of lodRunes) {
      expect(rune.bonuses.weaponsGloves.length).toBeGreaterThan(0);
      expect(rune.bonuses.helmsBoots.length).toBeGreaterThan(0);
      expect(rune.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
    }
  });
});
