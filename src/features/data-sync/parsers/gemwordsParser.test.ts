import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseGemsHtml } from './gemsParser';
import { parseGemwordsHtml, calculateGemwordReqLevel } from './gemwordsParser';
import type { GemReqLevelLookup } from './runewordsParser';

const gemwordsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/gemwords.htm'), 'utf-8');
const gemsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

describe('parseGemwordsHtml', () => {
  const gems = parseGemsHtml(gemsHtml);
  const gemReqLevelLookup: GemReqLevelLookup = new Map(gems.map((gem) => [gem.name, gem.reqLevel]));

  it('should parse all gemword rows (approximately 580-610)', () => {
    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);

    expect(gemwords.length).toBeGreaterThanOrEqual(580);
    expect(gemwords.length).toBeLessThanOrEqual(610);
  });

  it('parses a one-socket Holy gemword with allowed items and per-column bonuses', () => {
    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);
    const holy = gemwords.find((gemword) => gemword.name === 'Holy' && gemword.variant === 1);

    expect(holy).toBeDefined();
    expect(holy?.sockets).toBe(1);
    expect(holy?.reqLevel).toBe(1);
    expect(holy?.gems).toEqual(['Chipped Diamond']);
    expect(holy?.ingredients).toEqual(['Chipped Diamond']);
    expect(holy?.allowedItems).toEqual(['Body Armor', 'Any Shield', 'Helm', 'Charm', 'Boots', 'Belt']);
    expect(holy?.columnAffixes.weaponsGloves).toEqual([]);
    expect(holy?.columnAffixes.helmsBoots.map((affix) => affix.rawText)).toEqual(['5% Chance to Cast Level 5 Magic Surge when Struck']);
    expect(holy?.columnAffixes.armorShieldsBelts.map((affix) => affix.rawText)).toEqual([
      '5% Chance to Cast Level 5 Magic Surge when Struck',
    ]);
  });

  it('keeps only the gemword bonuses, not the gem bonuses after the <br><br> separator', () => {
    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);
    const holy = gemwords.find((gemword) => gemword.name === 'Holy' && gemword.variant === 1);

    // The armor cell also lists Chipped Diamond's own bonuses (e.g. "Cold Resist +5%")
    // after a <br><br> separator — those belong to the gem, not the gemword
    expect(holy?.affixes.map((affix) => affix.rawText)).toEqual(['5% Chance to Cast Level 5 Magic Surge when Struck']);
    expect(holy?.columnAffixes.armorShieldsBelts.map((affix) => affix.rawText)).not.toContain('Cold Resist +5%');
  });

  it('captures the jewel requirement for recipes that need one', () => {
    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);
    const america = gemwords.find((gemword) => gemword.name === 'America');

    expect(america).toBeDefined();
    expect(america?.sockets).toBe(4);
    expect(america?.gems).toEqual(['Perfect Sapphire', 'Perfect Ruby', 'Perfect Diamond']);
    expect(america?.jewelInfo).toBe('Jewel');

    const withJewel = gemwords.filter((gemword) => gemword.jewelInfo !== undefined);
    expect(withJewel.map((gemword) => gemword.name).sort()).toEqual(['America', 'Canada', 'China']);
  });

  it('assigns unique (name, variant) pairs — favourite ids depend on this', () => {
    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);
    const keys = gemwords.map((gemword) => `${gemword.name}:${String(gemword.variant)}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps gemword variants separate by name', () => {
    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);
    const holyVariants = gemwords.filter((gemword) => gemword.name === 'Holy');

    expect(holyVariants.length).toBeGreaterThan(20);
    expect(holyVariants.slice(0, 6).map((gemword) => gemword.variant)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('only accepts known gem names as ingredients', () => {
    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);
    const gemNames = new Set(gems.map((gem) => gem.name));

    for (const gemword of gemwords) {
      expect(gemword.gems.length).toBeGreaterThan(0);
      for (const gemName of gemword.gems) {
        expect(gemNames.has(gemName), `${gemword.name} ingredient "${gemName}" should be a known gem`).toBe(true);
      }
    }
  });

  it('calculates required level from the highest required gem', () => {
    expect(calculateGemwordReqLevel(['Chipped Diamond'], gemReqLevelLookup)).toBe(1);
    expect(calculateGemwordReqLevel(['Perfect Diamond', 'Flawed Diamond'], gemReqLevelLookup)).toBe(35);
  });
});
