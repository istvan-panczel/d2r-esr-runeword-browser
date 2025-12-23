import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isGemName, extractGemTypeAndQuality, parseGemsHtml } from './gemsParser';

describe('isGemName', () => {
  it('should return true for gem names', () => {
    expect(isGemName('Amethyst')).toBe(true);
    expect(isGemName('Perfect Ruby')).toBe(true);
    expect(isGemName('Chipped Sapphire')).toBe(true);
    expect(isGemName('Flawed Obsidian')).toBe(true);
  });

  it('should return false for non-gem names', () => {
    expect(isGemName('El Rune')).toBe(false);
    expect(isGemName('Shadow Quartz')).toBe(false);
    expect(isGemName('Random Item')).toBe(false);
  });
});

describe('extractGemTypeAndQuality', () => {
  it('should extract type and quality from prefixed names', () => {
    expect(extractGemTypeAndQuality('Chipped Amethyst')).toEqual({
      type: 'Amethyst',
      quality: 'Chipped',
    });
    expect(extractGemTypeAndQuality('Perfect Ruby')).toEqual({
      type: 'Ruby',
      quality: 'Perfect',
    });
    expect(extractGemTypeAndQuality('Flawless Topaz')).toEqual({
      type: 'Topaz',
      quality: 'Flawless',
    });
  });

  it('should extract Standard quality for unprefixed names', () => {
    expect(extractGemTypeAndQuality('Amethyst')).toEqual({
      type: 'Amethyst',
      quality: 'Standard',
    });
    expect(extractGemTypeAndQuality('Ruby')).toEqual({
      type: 'Ruby',
      quality: 'Standard',
    });
  });

  it('should return null for invalid names', () => {
    expect(extractGemTypeAndQuality('El Rune')).toBe(null);
    expect(extractGemTypeAndQuality('Invalid')).toBe(null);
  });
});

describe('parseGemsHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../public/data/gems.htm'), 'utf-8');

  it('should parse exactly 48 gems (8 types x 6 qualities)', () => {
    const gems = parseGemsHtml(html);
    expect(gems).toHaveLength(48);
  });

  it('should parse all gem types', () => {
    const gems = parseGemsHtml(html);
    const types = [...new Set(gems.map((g) => g.type))];

    expect(types).toContain('Amethyst');
    expect(types).toContain('Sapphire');
    expect(types).toContain('Emerald');
    expect(types).toContain('Ruby');
    expect(types).toContain('Diamond');
    expect(types).toContain('Topaz');
    expect(types).toContain('Skull');
    expect(types).toContain('Obsidian');
    expect(types).toHaveLength(8);
  });

  it('should parse all gem qualities', () => {
    const gems = parseGemsHtml(html);
    const qualities = [...new Set(gems.map((g) => g.quality))];

    expect(qualities).toContain('Chipped');
    expect(qualities).toContain('Flawed');
    expect(qualities).toContain('Standard');
    expect(qualities).toContain('Flawless');
    expect(qualities).toContain('Blemished');
    expect(qualities).toContain('Perfect');
    expect(qualities).toHaveLength(6);
  });

  it('should parse Perfect Ruby correctly', () => {
    const gems = parseGemsHtml(html);
    const perfectRuby = gems.find((g) => g.name === 'Perfect Ruby');

    expect(perfectRuby).toBeDefined();
    expect(perfectRuby!.type).toBe('Ruby');
    expect(perfectRuby!.quality).toBe('Perfect');
    expect(perfectRuby!.color).toBe('RED');
    expect(perfectRuby!.reqLevel).toBe(35);
    expect(perfectRuby!.bonuses.weaponsGloves.length).toBeGreaterThan(0);
  });

  it('should parse bonuses for all gems', () => {
    const gems = parseGemsHtml(html);

    for (const gem of gems) {
      expect(gem.bonuses.weaponsGloves.length).toBeGreaterThan(0);
      expect(gem.bonuses.helmsBoots.length).toBeGreaterThan(0);
      expect(gem.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
    }
  });
});
