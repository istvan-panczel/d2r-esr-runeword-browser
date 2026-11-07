import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseGemsHtml } from './gemsParser';
import { parseGemwordsHtml, calculateGemwordReqLevel } from './gemwordsParser';
import type { BonusPool, Gemword } from '@/core/db';
import type { GemReqLevelLookup } from './runewordsParser';
import { firstNonEmptyPools } from '@/core/utils/columnAffixes';

const gemwordsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/gemwords.htm'), 'utf-8');
// The pre-ESR 3.3 page (per-category bonus columns), still parsed in case a cached or lagging page is served
const previousGemwordsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/previous/gemwords.htm'), 'utf-8');
const gemsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

describe('parseGemwordsHtml', () => {
  const gems = parseGemsHtml(gemsHtml);
  const gemReqLevelLookup: GemReqLevelLookup = new Map(gems.map((gem) => [gem.name, gem.reqLevel]));
  // Parsed once: each parse takes 1–2 s under jsdom, and parsing per test pushed single tests past the 5 s timeout
  // under parallel load (the full suite). The tests only read the result.
  const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);

  it('should parse all gemword rows (approximately 720-750)', () => {
    // ESR 3.2: 8 families x 90 rows (18 Charm-only rows + 72 item rows) + 14 named gemwords
    expect(gemwords.length).toBeGreaterThanOrEqual(720);
    expect(gemwords.length).toBeLessThanOrEqual(750);
  });

  it('parses a one-socket Holy charm gemword (Charm rows are listed separately since ESR 3.2)', () => {
    const holy = gemwords.find((gemword) => gemword.name === 'Holy' && gemword.variant === 1);

    expect(holy).toBeDefined();
    expect(holy?.sockets).toBe(1);
    expect(holy?.reqLevel).toBe(1);
    expect(holy?.gems).toEqual(['Chipped Diamond']);
    expect(holy?.ingredients).toEqual(['Chipped Diamond']);
    expect(holy?.allowedItems).toEqual(['Charm']);
    expect(holy?.affixes.map((affix) => affix.rawText)).toEqual(['5% Chance to Cast Level 5 Magic Surge when Struck']);
    expect(holy?.columnAffixes.weaponsGloves).toEqual([]);
    expect(holy?.columnAffixes.armorShieldsBelts).toEqual([]);
  });

  it('parses a one-socket Holy item gemword with allowed items and per-column bonuses', () => {
    const holy = gemwords.find(
      (gemword) => gemword.name === 'Holy' && gemword.allowedItems.includes('Body Armor') && gemword.gems.join() === 'Chipped Diamond'
    );

    expect(holy).toBeDefined();
    expect(holy?.sockets).toBe(1);
    expect(holy?.reqLevel).toBe(1);
    expect(holy?.allowedItems).toEqual(['Body Armor', 'Any Shield', 'Helm', 'Boots', 'Belt']);
    expect(holy?.columnAffixes.weaponsGloves).toEqual([]);
    expect(holy?.columnAffixes.helmsBoots.map((affix) => affix.rawText)).toEqual([
      '5% Chance to Cast Level 5 Magic Surge when Struck',
      'Socketables cannot be removed',
    ]);
    expect(holy?.columnAffixes.armorShieldsBelts.map((affix) => affix.rawText)).toEqual([
      '5% Chance to Cast Level 5 Magic Surge when Struck',
      'Socketables cannot be removed',
    ]);
  });

  it('keeps only the gemword bonuses, not the random bonus pools or gem bonuses after the <br><br> separator', () => {
    const holy = gemwords.find(
      (gemword) => gemword.name === 'Holy' && gemword.allowedItems.includes('Body Armor') && gemword.gems.join() === 'Chipped Diamond'
    );
    const armorBonuses = holy?.columnAffixes.armorShieldsBelts.map((affix) => affix.rawText);

    // After <br><br> the armor cell lists "1-2 of the following:" random pools, then
    // Chipped Diamond's own bonuses (e.g. "All Resists +5") — neither is the gemword's
    expect(holy?.affixes.map((affix) => affix.rawText)).toEqual([
      '5% Chance to Cast Level 5 Magic Surge when Struck',
      'Socketables cannot be removed',
    ]);
    expect(armorBonuses).not.toContain('1-2 of the following:');
    expect(armorBonuses).not.toContain('+(20 to 30) Defense');
    expect(armorBonuses).not.toContain('All Resists +5');
  });

  it('parses the random bonus pools of the one-socket Holy item gemword, identical in both populated columns', () => {
    const holy = gemwords.find(
      (gemword) => gemword.name === 'Holy' && gemword.allowedItems.includes('Body Armor') && gemword.gems.join() === 'Chipped Diamond'
    );
    const expected = [
      {
        label: '1-2 of the following:',
        lines: [
          '+(20 to 30) Defense',
          '+(4 to 6)% Chance of Crushing Blow',
          'All Resists +(5 to 7)',
          'Damage Reduced by (2 to 3)',
          'Magic Resist +(2 to 3)%',
          '+(15 to 22)% Damage to Undead',
        ],
      },
      {
        label: '1-2 of the following:',
        lines: [
          '+(10 to 15) to Life',
          '+(10 to 15) to Mana',
          '+(1 to 2) to All Attributes',
          'Increase Maximum Life +(1 to 2)%',
          'Increase Maximum Mana +(1 to 2)%',
          '+15% Enhanced Defense',
          '+(11 to 12)% to All Speeds',
        ],
      },
    ];

    expect(holy?.columnBonusPools?.weaponsGloves).toEqual([]);
    expect(poolTexts(holy?.columnBonusPools?.helmsBoots)).toEqual(expected);
    expect(poolTexts(holy?.columnBonusPools?.armorShieldsBelts)).toEqual(expected);
  });

  it('parses no bonus pools for Charm-only rows', () => {
    const charms = gemwords.filter((gemword) => gemword.allowedItems.join() === 'Charm');

    expect(charms.length).toBeGreaterThan(100);
    for (const charm of charms) {
      expect(allPools(charm), `${charm.name} #${String(charm.variant)}`).toEqual([]);
    }
  });

  it('gives most item gemwords at least one pool in every populated column, with "N-M of the following:" headers', () => {
    const items = gemwords.filter((gemword) => gemword.allowedItems.join() !== 'Charm');
    const withPools = items.filter((gemword) => allPools(gemword).length > 0);

    // Only the named gemwords (Rainbow, ArchDimeron, the country gemwords) have no pools in ESR 3.2
    const withoutPools = new Set(items.filter((gemword) => allPools(gemword).length === 0).map((gemword) => gemword.name));
    expect([...withoutPools].sort()).toEqual(
      [
        'America',
        'ArchDimeron',
        'Austria',
        'Britain',
        'Canada',
        'China',
        'France',
        'Germany',
        'Italy',
        'Japan',
        'Portugal',
        'Rainbow',
        'Russia',
      ].sort()
    );
    expect(withPools.length).toBeGreaterThan(items.length * 0.9);
    for (const gemword of withPools) {
      const populated = (['weaponsGloves', 'helmsBoots', 'armorShieldsBelts'] as const).filter(
        (column) => gemword.columnAffixes[column].length > 0
      );
      for (const column of populated) {
        expect(gemword.columnBonusPools?.[column].length, `${gemword.name} #${String(gemword.variant)} ${column}`).toBeGreaterThan(0);
      }
    }
    for (const pool of withPools.flatMap(allPools)) {
      expect(pool.label).toMatch(/^\d+-\d+ of the following:$/);
      expect(pool.affixes.length).toBeGreaterThan(0);
    }
  });

  it('keeps pools apart from the gemword bonuses and the trailing gem bonuses', () => {
    const holyArmor = gemwords.find(
      (gemword) => gemword.name === 'Holy' && gemword.allowedItems.includes('Body Armor') && gemword.gems.join() === 'Chipped Diamond'
    );
    const poolLines = allPools(holyArmor).flatMap((pool) => pool.affixes.map((affix) => affix.rawText));

    // Chipped Diamond's own armor bonuses come after the pools
    expect(poolLines).not.toContain('All Resists +5');
    expect(poolLines).not.toContain('Damage Reduced by 2');
    for (const gemword of gemwords) {
      const fixed = gemword.affixes.map((affix) => affix.rawText);
      expect(fixed.some((line) => /of the following/i.test(line))).toBe(false);
      for (const pool of allPools(gemword)) {
        expect(pool.affixes.some((affix) => /of the following/i.test(affix.rawText))).toBe(false);
      }
    }
  });

  it('parses one pool per "of the following:" header in the raw HTML', () => {
    const doc = new DOMParser().parseFromString(gemwordsHtml, 'text/html');
    const uniqueRows = new Set(Array.from(doc.querySelectorAll('tr.recipeRow'), (row) => row.innerHTML));
    const rawHeaderCount = Array.from(uniqueRows).reduce(
      (count, rowHtml) => count + (rowHtml.match(/of the following:/gi)?.length ?? 0),
      0
    );

    // The ESR 3.3 "Bonuses" column lists each pool once per row (the old layout once per bonus column)
    expect(rawHeaderCount).toBeGreaterThan(1000);
    expect(gemwords.flatMap((gemword) => (gemword.columnBonusPools ? firstNonEmptyPools(gemword.columnBonusPools) : []))).toHaveLength(
      rawHeaderCount
    );
  });

  it('captures the jewel requirement for recipes that need one', () => {
    const america = gemwords.find((gemword) => gemword.name === 'America');

    expect(america).toBeDefined();
    expect(america?.sockets).toBe(4);
    expect(america?.gems).toEqual(['Perfect Sapphire', 'Perfect Ruby', 'Perfect Diamond']);
    expect(america?.jewelInfo).toBe('Jewel');

    const withJewel = gemwords.filter((gemword) => gemword.jewelInfo !== undefined);
    expect(withJewel.map((gemword) => gemword.name).sort()).toEqual(['America', 'Canada', 'China']);
  });

  it('skips rows that repeat an earlier row verbatim (America is listed twice since ESR 3.2)', () => {
    expect(gemwords.filter((gemword) => gemword.name === 'America')).toHaveLength(1);
  });

  it('assigns unique (name, variant) pairs — favourite ids depend on this', () => {
    const keys = gemwords.map((gemword) => `${gemword.name}:${String(gemword.variant)}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps gemword variants separate by name', () => {
    const holyVariants = gemwords.filter((gemword) => gemword.name === 'Holy');

    expect(holyVariants.length).toBeGreaterThan(20);
    expect(holyVariants.slice(0, 6).map((gemword) => gemword.variant)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('only accepts known gem names as ingredients', () => {
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

describe('parseGemwordsHtml: ESR 3.3 Socketable Bonuses column', () => {
  const gemwords = parseGemwordsHtml(gemwordsHtml);
  const holyArmor = gemwords.find(
    (gemword) => gemword.name === 'Holy' && gemword.allowedItems.includes('Body Armor') && gemword.gems.join() === 'Chipped Diamond'
  );

  it('reads the required level the page prints when no gem lookup is given', () => {
    expect(holyArmor?.reqLevel).toBe(1);
    expect(gemwords.find((gemword) => gemword.name === 'America')?.reqLevel).toBe(35);
  });

  it('keeps both "1-2 of the following:" pools of the Holy armor row (no trailing gem group to drop)', () => {
    const pools = holyArmor?.columnBonusPools ? firstNonEmptyPools(holyArmor.columnBonusPools) : [];
    expect(pools.map((pool) => [pool.label, pool.affixes.length])).toEqual([
      ['1-2 of the following:', 6],
      ['1-2 of the following:', 7],
    ]);
    expect(pools[1]?.affixes.at(-1)?.rawText).toBe('+(11 to 12)% to All Speeds');
  });

  it('stores the gem bonuses per item-type group', () => {
    expect(holyArmor?.socketableBonuses?.map((group) => [group.label, group.affixes.map((affix) => affix.rawText)])).toEqual([
      ['Any Shield / Body Armor / Belt', ['Magic Resist +2%', 'All Resists +5', 'Damage Reduced by 2']],
      ['Helm / Boots', ['-5% Target Defense', '+4% Chance of Crushing Blow', '+20 Defense']],
    ]);
  });

  it('stores one unlabelled group for a Charm row', () => {
    const holyCharm = gemwords.find((gemword) => gemword.name === 'Holy' && gemword.variant === 1);
    expect(holyCharm?.socketableBonuses).toEqual([
      {
        label: '',
        itemTypes: [],
        affixes: expect.arrayContaining([expect.objectContaining({ rawText: '-5% Target Defense' })]) as unknown,
      },
    ]);
  });

  it('gives every gemword at least one socketable bonus group', () => {
    for (const gemword of gemwords) {
      expect(gemword.socketableBonuses?.length, `${gemword.name} #${String(gemword.variant)}`).toBeGreaterThan(0);
    }
  });
});

describe('parseGemwordsHtml: pre-ESR 3.3 layout (per-category bonus columns)', () => {
  const previous = parseGemwordsHtml(previousGemwordsHtml);
  const current = parseGemwordsHtml(gemwordsHtml);

  it('parses the same rows in the same order (variant numbers stay stable across the layouts)', () => {
    expect(previous.length).toBeGreaterThanOrEqual(720);
    expect(previous.map((gemword) => `${gemword.name}:${String(gemword.variant)}`)).toEqual(
      current.map((gemword) => `${gemword.name}:${String(gemword.variant)}`)
    );
  });

  it('drops the trailing gem bonus group, keeps the pools and stores no socketable bonus groups', () => {
    const holyArmor = previous.find(
      (gemword) => gemword.name === 'Holy' && gemword.allowedItems.includes('Body Armor') && gemword.gems.join() === 'Chipped Diamond'
    );
    expect(holyArmor?.affixes.map((affix) => affix.rawText)).toEqual([
      '5% Chance to Cast Level 5 Magic Surge when Struck',
      'Socketables cannot be removed',
    ]);
    expect(poolTexts(holyArmor?.columnBonusPools?.armorShieldsBelts)?.map((pool) => pool.lines.length)).toEqual([6, 7]);
    expect(holyArmor?.socketableBonuses).toBeUndefined();
  });

  it('fills the same bonus columns as the ESR 3.3 layout (builds compare saved column snapshots)', () => {
    const filled = (gemword: Gemword) =>
      (['weaponsGloves', 'helmsBoots', 'armorShieldsBelts'] as const).map((c) => gemword.columnAffixes[c].length > 0);
    expect(current.map(filled)).toEqual(previous.map(filled));
  });
});

function allPools(gemword: Gemword | undefined): readonly BonusPool[] {
  const pools = gemword?.columnBonusPools;
  return pools ? [...pools.weaponsGloves, ...pools.helmsBoots, ...pools.armorShieldsBelts] : [];
}

function poolTexts(pools: readonly BonusPool[] | undefined) {
  return pools?.map((pool) => ({ label: pool.label, lines: pool.affixes.map((affix) => affix.rawText) }));
}
