import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isLodRuneName, getLodRuneOrder, getLodRuneTier, parseLodRunesHtml } from './lodRunesParser';

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

describe('getLodRuneTier', () => {
  it('should return tier 1 (Low) for El(1) to Amn(11)', () => {
    expect(getLodRuneTier(1)).toBe(1); // El
    expect(getLodRuneTier(11)).toBe(1); // Amn (boundary)
  });

  it('should return tier 2 (Mid) for Sol(12) to Um(22)', () => {
    expect(getLodRuneTier(12)).toBe(2); // Sol (boundary)
    expect(getLodRuneTier(22)).toBe(2); // Um (boundary)
  });

  it('should return tier 3 (High) for Mal(23) to Zod(33)', () => {
    expect(getLodRuneTier(23)).toBe(3); // Mal (boundary)
    expect(getLodRuneTier(33)).toBe(3); // Zod
  });
});

describe('parseLodRunesHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

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

  it('should assign correct tiers with new boundaries', () => {
    const lodRunes = parseLodRunesHtml(html);

    // Amn (order 11) should be Low (tier 1)
    const amn = lodRunes.find((r) => r.name === 'Amn Rune')!;
    expect(amn.tier).toBe(1);

    // Sol (order 12) should be Mid (tier 2)
    const sol = lodRunes.find((r) => r.name === 'Sol Rune')!;
    expect(sol.tier).toBe(2);

    // Um (order 22) should be Mid (tier 2)
    const um = lodRunes.find((r) => r.name === 'Um Rune')!;
    expect(um.tier).toBe(2);

    // Mal (order 23) should be High (tier 3)
    const mal = lodRunes.find((r) => r.name === 'Mal Rune')!;
    expect(mal.tier).toBe(3);
  });
});
