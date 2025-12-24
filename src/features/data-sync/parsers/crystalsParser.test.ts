import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isCrystalName, extractCrystalTypeAndQuality, parseCrystalsHtml } from './crystalsParser';

describe('isCrystalName', () => {
  it('should return true for crystal names', () => {
    expect(isCrystalName('Shadow Quartz')).toBe(true);
    expect(isCrystalName('Chipped Shadow Quartz')).toBe(true);
    expect(isCrystalName('Frozen Soul')).toBe(true);
    expect(isCrystalName('Flawed Bleeding Stone')).toBe(true);
  });

  it('should return false for non-crystal names', () => {
    expect(isCrystalName('El Rune')).toBe(false);
    expect(isCrystalName('Perfect Ruby')).toBe(false);
    expect(isCrystalName('Random Item')).toBe(false);
  });
});

describe('extractCrystalTypeAndQuality', () => {
  it('should extract type and quality from prefixed names', () => {
    expect(extractCrystalTypeAndQuality('Chipped Shadow Quartz')).toEqual({
      type: 'Shadow Quartz',
      quality: 'Chipped',
    });
    expect(extractCrystalTypeAndQuality('Flawed Frozen Soul')).toEqual({
      type: 'Frozen Soul',
      quality: 'Flawed',
    });
  });

  it('should extract Standard quality for unprefixed names', () => {
    expect(extractCrystalTypeAndQuality('Shadow Quartz')).toEqual({
      type: 'Shadow Quartz',
      quality: 'Standard',
    });
    expect(extractCrystalTypeAndQuality('Burning Sulphur')).toEqual({
      type: 'Burning Sulphur',
      quality: 'Standard',
    });
  });

  it('should return null for invalid names', () => {
    expect(extractCrystalTypeAndQuality('El Rune')).toBe(null);
    expect(extractCrystalTypeAndQuality('Invalid')).toBe(null);
  });
});

describe('parseCrystalsHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

  it('should parse exactly 36 crystals (12 types x 3 qualities)', () => {
    const crystals = parseCrystalsHtml(html);
    expect(crystals).toHaveLength(36);
  });

  it('should parse all 12 crystal types', () => {
    const crystals = parseCrystalsHtml(html);
    const types = [...new Set(crystals.map((c) => c.type))];

    expect(types).toContain('Shadow Quartz');
    expect(types).toContain('Frozen Soul');
    expect(types).toContain('Bleeding Stone');
    expect(types).toContain('Burning Sulphur');
    expect(types).toContain('Dark Azurite');
    expect(types).toContain('Bitter Peridot');
    expect(types).toContain('Pulsing Opal');
    expect(types).toContain('Enigmatic Cinnabar');
    expect(types).toContain('Tomb Jade');
    expect(types).toContain('Solid Mercury');
    expect(types).toContain('Storm Amber');
    expect(types).toContain('Tainted Tourmaline');
    expect(types).toHaveLength(12);
  });

  it('should parse all 3 crystal qualities', () => {
    const crystals = parseCrystalsHtml(html);
    const qualities = [...new Set(crystals.map((c) => c.quality))];

    expect(qualities).toContain('Chipped');
    expect(qualities).toContain('Flawed');
    expect(qualities).toContain('Standard');
    expect(qualities).toHaveLength(3);
  });

  it('should parse Shadow Quartz correctly', () => {
    const crystals = parseCrystalsHtml(html);
    const shadowQuartz = crystals.find((c) => c.name === 'Shadow Quartz');

    expect(shadowQuartz).toBeDefined();
    expect(shadowQuartz!.type).toBe('Shadow Quartz');
    expect(shadowQuartz!.quality).toBe('Standard');
    expect(shadowQuartz!.reqLevel).toBe(42);
  });

  it('should parse Chipped Shadow Quartz correctly', () => {
    const crystals = parseCrystalsHtml(html);
    const chippedShadowQuartz = crystals.find((c) => c.name === 'Chipped Shadow Quartz');

    expect(chippedShadowQuartz).toBeDefined();
    expect(chippedShadowQuartz!.type).toBe('Shadow Quartz');
    expect(chippedShadowQuartz!.quality).toBe('Chipped');
    expect(chippedShadowQuartz!.reqLevel).toBe(6);
  });

  it('should have correct required levels for each quality', () => {
    const crystals = parseCrystalsHtml(html);

    const chipped = crystals.filter((c) => c.quality === 'Chipped');
    const flawed = crystals.filter((c) => c.quality === 'Flawed');
    const standard = crystals.filter((c) => c.quality === 'Standard');

    // All Chipped should be level 6
    for (const crystal of chipped) {
      expect(crystal.reqLevel).toBe(6);
    }

    // All Flawed should be level 24
    for (const crystal of flawed) {
      expect(crystal.reqLevel).toBe(24);
    }

    // All Standard should be level 42
    for (const crystal of standard) {
      expect(crystal.reqLevel).toBe(42);
    }
  });

  it('should parse bonuses for all crystals', () => {
    const crystals = parseCrystalsHtml(html);

    for (const crystal of crystals) {
      expect(crystal.bonuses.weaponsGloves.length).toBeGreaterThan(0);
      expect(crystal.bonuses.helmsBoots.length).toBeGreaterThan(0);
      expect(crystal.bonuses.armorShieldsBelts.length).toBeGreaterThan(0);
    }
  });
});
