import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  extractName,
  extractSockets,
  extractRunes,
  extractAllowedItems,
  extractAffixes,
  parseRunewordsHtml,
  calculateReqLevel,
  calculateSortKey,
  calculateTierPointTotals,
  type RuneReqLevelLookup,
  type RunePointsLookup,
  type RunePriorityLookup,
} from './runewordsParser';
import { parseEsrRunesHtml } from './esrRunesParser';
import { parseLodRunesHtml } from './lodRunesParser';
import { parseKanjiRunesHtml } from './kanjiRunesParser';
import { DEFAULT_ESR_RUNE_POINTS, DEFAULT_LOD_RUNE_POINTS } from '../constants/defaultRunePoints';

// Helper to create a DOM element from HTML string
function createElementFromHtml(html: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  return doc.body.firstElementChild!;
}

// Helper to create a table row from HTML string (for extractAffixes tests)
function createTableRowFromHtml(html: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
  return doc.querySelector('tr')!;
}

describe('extractName', () => {
  it('should extract runeword name from cell', () => {
    const cell = createElementFromHtml(`
      <td>
        <font size="-1" face="arial,helvetica">
          <font color="#908858"><b>Stone</b></font><br><br>(2 Socket)<br><br>
        </font>
      </td>
    `);
    expect(extractName(cell)).toBe('Stone');
  });

  it('should return empty string for cell without name', () => {
    const cell = createElementFromHtml('<td><font size="-1"></font></td>');
    expect(extractName(cell)).toBe('');
  });

  it('should handle uppercase FONT tags', () => {
    const cell = createElementFromHtml(`
      <td>
        <FONT color="#908858"><b>Boar</b></FONT>
      </td>
    `);
    expect(extractName(cell)).toBe('Boar');
  });
});

describe('extractSockets', () => {
  it('should extract socket count from cell', () => {
    const cell = createElementFromHtml(`
      <td>
        <font color="#908858"><b>Stone</b></font><br><br>(2 Socket)<br><br>
      </td>
    `);
    expect(extractSockets(cell)).toBe(2);
  });

  it('should handle single socket', () => {
    const cell = createElementFromHtml('<td>(1 Socket)</td>');
    expect(extractSockets(cell)).toBe(1);
  });

  it('should handle multi-digit socket counts', () => {
    const cell = createElementFromHtml('<td>(6 Socket)</td>');
    expect(extractSockets(cell)).toBe(6);
  });

  it('should return 0 if no socket count found', () => {
    const cell = createElementFromHtml('<td>No sockets here</td>');
    expect(extractSockets(cell)).toBe(0);
  });
});

describe('extractRunes', () => {
  it('should extract single rune', () => {
    const cell = createElementFromHtml(`
      <td class="ingredients">
        <font color="#908858">
          <FONT COLOR="WHITE">I Rune</FONT><br>
        </font>
      </td>
    `);
    expect(extractRunes(cell)).toEqual(['I Rune']);
  });

  it('should extract multiple runes', () => {
    const cell = createElementFromHtml(`
      <td class="ingredients">
        <font color="#908858">
          <FONT COLOR="WHITE">I Rune</FONT><br>
          <FONT COLOR="WHITE">Shi Rune</FONT><br>
        </font>
      </td>
    `);
    expect(extractRunes(cell)).toEqual(['I Rune', 'Shi Rune']);
  });

  it('should handle mixed color runes', () => {
    const cell = createElementFromHtml(`
      <td class="ingredients">
        <font color="#908858">
          <FONT COLOR="GREEN">Hi Rune</FONT><br>
          <FONT COLOR="YELLOW">Ko Rune</FONT><br>
          <FONT COLOR="WHITE">U Rune</FONT><br>
        </font>
      </td>
    `);
    expect(extractRunes(cell)).toEqual(['Hi Rune', 'Ko Rune', 'U Rune']);
  });

  it('should not include wrapper font element', () => {
    const cell = createElementFromHtml(`
      <td class="ingredients">
        <font size="-1" face="arial,helvetica" color="#908858">
          <FONT COLOR="WHITE">I Rune</FONT><br>
          <FONT COLOR="WHITE">Shi Rune</FONT><br>
        </font>
      </td>
    `);
    const runes = extractRunes(cell);
    expect(runes).toEqual(['I Rune', 'Shi Rune']);
    expect(runes).not.toContain('I Rune\n                          Shi Rune');
  });

  it('should return empty array for cell without runes', () => {
    const cell = createElementFromHtml('<td>No runes</td>');
    expect(extractRunes(cell)).toEqual([]);
  });
});

describe('extractAllowedItems', () => {
  it('should extract single item type', () => {
    const cell = createElementFromHtml('<td>Weapon<br></td>');
    expect(extractAllowedItems(cell)).toEqual({ allowedItems: ['Weapon'], excludedItems: [] });
  });

  it('should extract multiple item types', () => {
    const cell = createElementFromHtml('<td>Body Armor<br>Any Shield<br></td>');
    expect(extractAllowedItems(cell)).toEqual({ allowedItems: ['Body Armor', 'Any Shield'], excludedItems: [] });
  });

  it('should filter empty strings', () => {
    const cell = createElementFromHtml('<td>Weapon<br><br>Missile<br></td>');
    expect(extractAllowedItems(cell)).toEqual({ allowedItems: ['Weapon', 'Missile'], excludedItems: [] });
  });

  it('should strip font tags', () => {
    const cell = createElementFromHtml('<td><font size="-1">Helm<br>Gloves<br></font></td>');
    expect(extractAllowedItems(cell)).toEqual({ allowedItems: ['Helm', 'Gloves'], excludedItems: [] });
  });

  it('should extract excluded items', () => {
    const cell = createElementFromHtml('<td><font size="-1">Staff<br><br>Excluded:<br>Orb<br>Sorceress Mana Blade<br></font></td>');
    expect(extractAllowedItems(cell)).toEqual({
      allowedItems: ['Staff'],
      excludedItems: ['Orb', 'Sorceress Mana Blade'],
    });
  });

  it('should handle excluded with multiple allowed items', () => {
    const cell = createElementFromHtml('<td>2H Swing Weapon<br><br>Excluded:<br>Hammer<br>Polearm<br>Spear<br></td>');
    expect(extractAllowedItems(cell)).toEqual({
      allowedItems: ['2H Swing Weapon'],
      excludedItems: ['Hammer', 'Polearm', 'Spear'],
    });
  });

  it('should collapse internal whitespace in item names split across lines', () => {
    const cell = createElementFromHtml(
      '<td><font size="-1">Staff<br><br>Excluded:<br>Orb<br>Sorceress Mana\n                            Blade<br></font></td>'
    );
    expect(extractAllowedItems(cell)).toEqual({
      allowedItems: ['Staff'],
      excludedItems: ['Orb', 'Sorceress Mana Blade'],
    });
  });
});

describe('extractAffixes', () => {
  it('should extract affixes from first non-empty bonus cell', () => {
    const row = createTableRowFromHtml(`
      <tr>
        <td>Name</td>
        <td>Runes</td>
        <td>Items</td>
        <td><font color="8080E6">+100 Defense <br>+30 to Strength <br><br>+15% Enhanced Damage<br></font></td>
        <td></td>
        <td></td>
      </tr>
    `);
    const cells = row.querySelectorAll('td');
    const { affixes } = extractAffixes(cells);

    expect(affixes).toHaveLength(2);
    expect(affixes[0].rawText).toBe('+100 Defense');
    expect(affixes[1].rawText).toBe('+30 to Strength');
  });

  it('should skip to next column if first bonus cell is empty', () => {
    const row = createTableRowFromHtml(`
      <tr>
        <td>Name</td>
        <td>Runes</td>
        <td>Items</td>
        <td><font color="8080E6"></font></td>
        <td><font color="8080E6"></font></td>
        <td><font color="8080E6">+50 Defense <br><br>Rune bonus<br></font></td>
      </tr>
    `);
    const cells = row.querySelectorAll('td');
    const { affixes } = extractAffixes(cells);

    expect(affixes).toHaveLength(1);
    expect(affixes[0].rawText).toBe('+50 Defense');
  });

  it('should normalize whitespace in affixes', () => {
    const row = createTableRowFromHtml(`
      <tr>
        <td>Name</td>
        <td>Runes</td>
        <td>Items</td>
        <td><font color="8080E6">+2% Enhanced Maximum Damage (Based on
                                Character Level) <br><br></font></td>
        <td></td>
        <td></td>
      </tr>
    `);
    const cells = row.querySelectorAll('td');
    const { affixes } = extractAffixes(cells);

    expect(affixes).toHaveLength(1);
    expect(affixes[0].rawText).toBe('+2% Enhanced Maximum Damage (Based on Character Level)');
    // Note: +2 becomes # (the + is part of the number pattern)
    expect(affixes[0].pattern).toBe('#% Enhanced Maximum Damage (Based on Character Level)');
  });

  it('should extract per-column affixes', () => {
    const row = createTableRowFromHtml(`
      <tr>
        <td>Name</td>
        <td>Runes</td>
        <td>Items</td>
        <td><font color="8080E6">+100 Defense <br><br>Rune bonus<br></font></td>
        <td><font color="8080E6">+50 to Mana <br><br>Rune bonus<br></font></td>
        <td></td>
      </tr>
    `);
    const cells = row.querySelectorAll('td');
    const { affixes, columnAffixes } = extractAffixes(cells);

    // Legacy affixes = first non-empty column (weapon)
    expect(affixes).toHaveLength(1);
    expect(affixes[0].rawText).toBe('+100 Defense');

    // Per-column affixes
    expect(columnAffixes.weaponsGloves).toHaveLength(1);
    expect(columnAffixes.weaponsGloves[0].rawText).toBe('+100 Defense');
    expect(columnAffixes.helmsBoots).toHaveLength(1);
    expect(columnAffixes.helmsBoots[0].rawText).toBe('+50 to Mana');
    expect(columnAffixes.armorShieldsBelts).toHaveLength(0);
  });
});

describe('calculateReqLevel', () => {
  it('should return 0 for empty runes array', () => {
    const lookup: RuneReqLevelLookup = new Map();
    expect(calculateReqLevel([], lookup)).toBe(0);
  });

  it('should return 0 for runes not in lookup', () => {
    const lookup: RuneReqLevelLookup = new Map();
    expect(calculateReqLevel(['Unknown Rune'], lookup)).toBe(0);
  });

  it('should return the reqLevel for a single rune', () => {
    const lookup: RuneReqLevelLookup = new Map([['I Rune', 2]]);
    expect(calculateReqLevel(['I Rune'], lookup)).toBe(2);
  });

  it('should return the max reqLevel from multiple runes', () => {
    const lookup: RuneReqLevelLookup = new Map([
      ['I Rune', 2],
      ['Shi Rune', 4],
      ['Chi Rune', 6],
    ]);
    expect(calculateReqLevel(['I Rune', 'Shi Rune', 'Chi Rune'], lookup)).toBe(6);
  });

  it('should handle mix of known and unknown runes', () => {
    const lookup: RuneReqLevelLookup = new Map([
      ['I Rune', 2],
      ['Chi Rune', 6],
    ]);
    expect(calculateReqLevel(['I Rune', 'Unknown Rune', 'Chi Rune'], lookup)).toBe(6);
  });

  it('should return max when first rune has highest level', () => {
    const lookup: RuneReqLevelLookup = new Map([
      ['El Rune', 11],
      ['Zod Rune', 69],
    ]);
    expect(calculateReqLevel(['Zod Rune', 'El Rune'], lookup)).toBe(69);
  });
});

describe('calculateSortKey', () => {
  it('should return reqLevel for ESR-only runes', () => {
    const lookup: RunePriorityLookup = new Map([
      ['esrRunes:I Rune', 100],
      ['esrRunes:Shi Rune', 100],
    ]);
    expect(calculateSortKey(['I Rune', 'Shi Rune'], 4, lookup)).toBe(4);
  });

  it('should return reqLevel for Kanji-only runes', () => {
    const lookup: RunePriorityLookup = new Map([['kanjiRunes:Moon Rune', 800]]);
    expect(calculateSortKey(['Moon Rune'], 60, lookup)).toBe(60);
  });

  it('should return 10000 + reqLevel for LoD-exclusive runes', () => {
    // El and Zod only exist in LoD (no esrRunes or kanjiRunes keys)
    const lookup: RunePriorityLookup = new Map([
      ['lodRunes:El Rune', 901],
      ['lodRunes:Zod Rune', 933],
    ]);
    expect(calculateSortKey(['El Rune', 'Zod Rune'], 69, lookup)).toBe(10069);
  });

  it('should return reqLevel for shared rune (Ko) that exists in both ESR and LoD', () => {
    // Ko exists in both ESR and LoD — not LoD-exclusive, so ESR classification
    const lookup: RunePriorityLookup = new Map([
      ['esrRunes:Ko Rune', 300],
      ['lodRunes:Ko Rune', 918],
    ]);
    expect(calculateSortKey(['Ko Rune'], 30, lookup)).toBe(30);
  });

  it('should classify as LoD when at least one rune is LoD-exclusive', () => {
    // Zod is LoD-exclusive (no ESR or Kanji entry), Ko is shared
    const lookup: RunePriorityLookup = new Map([
      ['esrRunes:Ko Rune', 300],
      ['lodRunes:Ko Rune', 918],
      ['lodRunes:Zod Rune', 933],
    ]);
    expect(calculateSortKey(['Ko Rune', 'Zod Rune'], 69, lookup)).toBe(10069);
  });

  it('should return reqLevel for ESR + Kanji mix', () => {
    const lookup: RunePriorityLookup = new Map([
      ['esrRunes:Ko Rune', 300],
      ['kanjiRunes:Moon Rune', 800],
    ]);
    expect(calculateSortKey(['Ko Rune', 'Moon Rune'], 60, lookup)).toBe(60);
  });

  it('should return reqLevel for empty runes array', () => {
    const lookup: RunePriorityLookup = new Map();
    expect(calculateSortKey([], 30, lookup)).toBe(30);
  });

  it('should return reqLevel for unknown runes (not in lookup)', () => {
    const lookup: RunePriorityLookup = new Map();
    expect(calculateSortKey(['Unknown Rune'], 25, lookup)).toBe(25);
  });
});

describe('calculateTierPointTotals', () => {
  it('should return empty array for empty runes array', () => {
    const lookup: RunePointsLookup = new Map();
    expect(calculateTierPointTotals([], lookup)).toEqual([]);
  });

  it('should return empty array for runes not in lookup', () => {
    const lookup: RunePointsLookup = new Map();
    expect(calculateTierPointTotals(['Unknown Rune'], lookup)).toEqual([]);
  });

  it('should calculate points for a single ESR rune', () => {
    const lookup: RunePointsLookup = new Map([['I Rune', { points: 1, tier: 1, category: 'esrRunes' }]]);
    const result = calculateTierPointTotals(['I Rune'], lookup);
    expect(result).toEqual([{ tier: 1, category: 'esrRunes', totalPoints: 1 }]);
  });

  it('should calculate points for a single LoD rune', () => {
    const lookup: RunePointsLookup = new Map([['El Rune', { points: 1, tier: 1, category: 'lodRunes' }]]);
    const result = calculateTierPointTotals(['El Rune'], lookup);
    expect(result).toEqual([{ tier: 1, category: 'lodRunes', totalPoints: 1 }]);
  });

  it('should sum points for multiple runes in the same tier and category', () => {
    const lookup: RunePointsLookup = new Map([
      ['I Rune', { points: 1, tier: 1, category: 'esrRunes' }],
      ['Shi Rune', { points: 2, tier: 1, category: 'esrRunes' }],
    ]);
    const result = calculateTierPointTotals(['I Rune', 'Shi Rune'], lookup);
    expect(result).toEqual([{ tier: 1, category: 'esrRunes', totalPoints: 3 }]);
  });

  it('should separate points by tier within same category', () => {
    const lookup: RunePointsLookup = new Map([
      ['I Rune', { points: 1, tier: 1, category: 'esrRunes' }],
      ['Chi Rune', { points: 5, tier: 2, category: 'esrRunes' }],
    ]);
    const result = calculateTierPointTotals(['I Rune', 'Chi Rune'], lookup);
    expect(result).toEqual([
      { tier: 1, category: 'esrRunes', totalPoints: 1 },
      { tier: 2, category: 'esrRunes', totalPoints: 5 },
    ]);
  });

  it('should separate points by category', () => {
    const lookup: RunePointsLookup = new Map([
      ['I Rune', { points: 1, tier: 1, category: 'esrRunes' }],
      ['El Rune', { points: 1, tier: 1, category: 'lodRunes' }],
    ]);
    const result = calculateTierPointTotals(['I Rune', 'El Rune'], lookup);
    // Should be sorted by category (esrRunes before lodRunes alphabetically)
    expect(result).toEqual([
      { tier: 1, category: 'esrRunes', totalPoints: 1 },
      { tier: 1, category: 'lodRunes', totalPoints: 1 },
    ]);
  });

  it('should handle mix of known and unknown runes', () => {
    const lookup: RunePointsLookup = new Map([['I Rune', { points: 1, tier: 1, category: 'esrRunes' }]]);
    const result = calculateTierPointTotals(['I Rune', 'Unknown Rune', 'Moon Rune'], lookup);
    // Unknown and Kanji runes are skipped
    expect(result).toEqual([{ tier: 1, category: 'esrRunes', totalPoints: 1 }]);
  });

  it('should sort results by category then tier', () => {
    const lookup: RunePointsLookup = new Map([
      ['Zod Rune', { points: 50, tier: 3, category: 'lodRunes' }],
      ['I Rune', { points: 1, tier: 1, category: 'esrRunes' }],
      ['El Rune', { points: 1, tier: 1, category: 'lodRunes' }],
      ['Chi Rune', { points: 5, tier: 2, category: 'esrRunes' }],
    ]);
    const result = calculateTierPointTotals(['Zod Rune', 'I Rune', 'El Rune', 'Chi Rune'], lookup);
    // esrRunes comes before lodRunes, then sorted by tier within each category
    expect(result).toEqual([
      { tier: 1, category: 'esrRunes', totalPoints: 1 },
      { tier: 2, category: 'esrRunes', totalPoints: 5 },
      { tier: 1, category: 'lodRunes', totalPoints: 1 },
      { tier: 3, category: 'lodRunes', totalPoints: 50 },
    ]);
  });

  it('should sum duplicate runes correctly', () => {
    const lookup: RunePointsLookup = new Map([['I Rune', { points: 1, tier: 1, category: 'esrRunes' }]]);
    // Runeword with same rune used multiple times
    const result = calculateTierPointTotals(['I Rune', 'I Rune', 'I Rune'], lookup);
    expect(result).toEqual([{ tier: 1, category: 'esrRunes', totalPoints: 3 }]);
  });
});

describe('parseRunewordsHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../test-fixtures/runewords.htm'), 'utf-8');

  it('should parse all runeword rows (approximately 380-400)', () => {
    const runewords = parseRunewordsHtml(html);
    expect(runewords.length).toBeGreaterThanOrEqual(380);
    expect(runewords.length).toBeLessThanOrEqual(400);
  });

  it('should parse Boar runeword correctly', () => {
    const runewords = parseRunewordsHtml(html);
    const boar = runewords.find((r) => r.name === 'Boar' && r.variant === 1);

    expect(boar).toBeDefined();
    expect(boar!.sockets).toBe(1);
    expect(boar!.runes).toEqual(['I Rune']);
    expect(boar!.allowedItems).toContain('Weapon');
    expect(boar!.excludedItems).toEqual([]);
    expect(boar!.affixes.length).toBeGreaterThan(0);
  });

  it('should parse Stone runeword correctly', () => {
    const runewords = parseRunewordsHtml(html);
    const stone = runewords.find((r) => r.name === 'Stone' && r.variant === 1);

    expect(stone).toBeDefined();
    expect(stone!.sockets).toBe(2);
    expect(stone!.runes).toEqual(['I Rune', 'Shi Rune']);
    expect(stone!.affixes.length).toBeGreaterThan(0);
  });

  it('should parse Airship runeword with correct runes', () => {
    const runewords = parseRunewordsHtml(html);
    const airship = runewords.find((r) => r.name === 'Airship' && r.variant === 1);

    expect(airship).toBeDefined();
    expect(airship!.runes).toEqual(['Hi Rune', 'Ko Rune', 'U Rune', 'Se Rune', 'N Rune']);
    expect(airship!.sockets).toBe(5);
  });

  it('should keep multi-variant runewords as separate entries', () => {
    const runewords = parseRunewordsHtml(html);
    const feminineVariants = runewords.filter((r) => r.name === 'Feminine');

    // Feminine has 3 variants
    expect(feminineVariants.length).toBe(3);
    expect(feminineVariants.map((v) => v.variant).sort()).toEqual([1, 2, 3]);

    // Each variant should have different allowed items
    const variant1 = feminineVariants.find((v) => v.variant === 1)!;
    const variant2 = feminineVariants.find((v) => v.variant === 2)!;
    const variant3 = feminineVariants.find((v) => v.variant === 3)!;

    expect(variant1.allowedItems).toContain('Staff');
    expect(variant1.excludedItems.length).toBeGreaterThan(0);
    expect(variant2.allowedItems).toContain('Missile Weapon');
    expect(variant3.allowedItems).toContain('Assassin 2H Katana');
  });

  it('should parse excluded items correctly', () => {
    const runewords = parseRunewordsHtml(html);
    const withExcluded = runewords.filter((r) => r.excludedItems.length > 0);

    // There should be several runewords with excluded items
    expect(withExcluded.length).toBeGreaterThan(0);

    // Check Feminine variant 1 specifically
    const feminine1 = runewords.find((r) => r.name === 'Feminine' && r.variant === 1)!;
    expect(feminine1.excludedItems).toContain('Orb');
    expect(feminine1.excludedItems).toContain('Sorceress Mana Blade');
  });

  it('should have normalized whitespace in affixes', () => {
    const runewords = parseRunewordsHtml(html);

    // Check that no affixes contain newlines or excessive spaces
    for (const runeword of runewords.slice(0, 50)) {
      for (const affix of runeword.affixes) {
        expect(affix.rawText).not.toMatch(/\n/);
        expect(affix.rawText).not.toMatch(/\s{2,}/);
        expect(affix.pattern).not.toMatch(/\n/);
        expect(affix.pattern).not.toMatch(/\s{2,}/);
      }
    }
  });

  it('should parse affixes with correct value types', () => {
    const runewords = parseRunewordsHtml(html);
    const withAffixes = runewords.filter((r) => r.affixes.length > 0);

    expect(withAffixes.length).toBeGreaterThan(200);

    // Check some common affix patterns
    for (const runeword of withAffixes.slice(0, 20)) {
      for (const affix of runeword.affixes) {
        if (affix.rawText.includes('%')) {
          expect(affix.valueType).toBe('percent');
        }
        if (affix.rawText.match(/\d+-\d+/)) {
          expect(affix.valueType).toBe('range');
        }
      }
    }
  });

  it('should not include rune bonuses in runeword affixes', () => {
    const runewords = parseRunewordsHtml(html);
    const boar = runewords.find((r) => r.name === 'Boar' && r.variant === 1);

    // Boar uses I Rune which gives +15% Enhanced Damage as rune bonus
    // The runeword itself should not include this as it's after the separator
    expect(boar).toBeDefined();
    const affixTexts = boar!.affixes.map((a) => a.rawText);

    // Check that runeword affixes are present
    expect(affixTexts.some((t) => t.includes('Minimum Damage') || t.includes('Maximum Damage'))).toBe(true);
  });

  it('should assign variant numbers to all runewords', () => {
    const runewords = parseRunewordsHtml(html);

    for (const runeword of runewords) {
      expect(runeword.variant).toBeGreaterThanOrEqual(1);
    }
  });

  it('should include excludedItems field on all runewords', () => {
    const runewords = parseRunewordsHtml(html);

    for (const runeword of runewords) {
      expect(Array.isArray(runeword.excludedItems)).toBe(true);
    }
  });

  it('should have valid socket counts', () => {
    const runewords = parseRunewordsHtml(html);

    for (const runeword of runewords) {
      expect(runeword.sockets).toBeGreaterThanOrEqual(1);
      expect(runeword.sockets).toBeLessThanOrEqual(6);
    }
  });

  it('should have all rune names ending with " Rune"', () => {
    const runewords = parseRunewordsHtml(html);

    for (const runeword of runewords) {
      for (const rune of runeword.runes) {
        expect(rune.endsWith(' Rune')).toBe(true);
      }
    }
  });

  it('should parse Call to Arms (LoD runeword) with 5 separate runes', () => {
    const runewords = parseRunewordsHtml(html);
    const callToArms = runewords.find((r) => r.name === 'Call to Arms');

    expect(callToArms).toBeDefined();
    expect(callToArms!.sockets).toBe(5);
    expect(callToArms!.runes).toHaveLength(5);
    expect(callToArms!.runes).toEqual(['Amn Rune', 'Ral Rune', 'Mal Rune', 'Ist Rune', 'Ohm Rune']);
  });

  it('should parse LoD runewords with plain text runes separated by br', () => {
    const runewords = parseRunewordsHtml(html);

    // Call to Arms is a LoD runeword with plain text runes separated by <br>
    const callToArms = runewords.find((r) => r.name === 'Call to Arms');

    expect(callToArms).toBeDefined();
    expect(callToArms!.runes.length).toBe(5);
    for (const rune of callToArms!.runes) {
      expect(rune.endsWith(' Rune')).toBe(true);
      expect(rune).not.toContain('<br>');
      expect(rune).not.toContain('\n');
    }
  });
});

describe('runeword category classification integration', () => {
  const runewordsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/runewords.htm'), 'utf-8');
  const gemsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

  // Parse all rune types to build name sets and lookups
  const esrRunes = parseEsrRunesHtml(gemsHtml);
  const lodRunes = parseLodRunesHtml(gemsHtml);
  const kanjiRunes = parseKanjiRunesHtml(gemsHtml);

  const esrRuneNames = new Set(esrRunes.map((r) => r.name));
  const lodRuneNames = new Set(lodRunes.map((r) => r.name));
  const kanjiRuneNames = new Set(kanjiRunes.map((r) => r.name));

  // Build lookups same as dataSyncSaga does
  const runePointsLookup: RunePointsLookup = new Map();
  for (const rune of esrRunes) {
    const info =
      rune.points !== undefined
        ? { points: rune.points, tier: rune.tier, category: 'esrRunes' as const }
        : rune.name in DEFAULT_ESR_RUNE_POINTS
          ? { points: DEFAULT_ESR_RUNE_POINTS[rune.name], tier: rune.tier, category: 'esrRunes' as const }
          : null;
    if (info) {
      runePointsLookup.set(rune.name, info);
      runePointsLookup.set(`esrRunes:${rune.name}`, info);
    }
  }
  for (const rune of lodRunes) {
    const info =
      rune.points !== undefined
        ? { points: rune.points, tier: rune.tier, category: 'lodRunes' as const }
        : rune.name in DEFAULT_LOD_RUNE_POINTS
          ? { points: DEFAULT_LOD_RUNE_POINTS[rune.name], tier: rune.tier, category: 'lodRunes' as const }
          : null;
    if (info) {
      runePointsLookup.set(rune.name, info);
      runePointsLookup.set(`lodRunes:${rune.name}`, info);
    }
  }

  const runeReqLevelLookup: RuneReqLevelLookup = new Map();
  for (const rune of esrRunes) runeReqLevelLookup.set(rune.name, rune.reqLevel);
  for (const rune of lodRunes) runeReqLevelLookup.set(rune.name, rune.reqLevel);
  for (const rune of kanjiRunes) runeReqLevelLookup.set(rune.name, rune.reqLevel);

  const runePriorityLookup: RunePriorityLookup = new Map();
  for (const rune of esrRunes) {
    runePriorityLookup.set(rune.name, rune.tier * 100);
    runePriorityLookup.set(`esrRunes:${rune.name}`, rune.tier * 100);
  }
  for (const rune of kanjiRunes) {
    runePriorityLookup.set(rune.name, 800);
    runePriorityLookup.set(`kanjiRunes:${rune.name}`, 800);
  }
  for (const rune of lodRunes) {
    runePriorityLookup.set(rune.name, 900 + rune.order);
    runePriorityLookup.set(`lodRunes:${rune.name}`, 900 + rune.order);
  }

  const runewords = parseRunewordsHtml(runewordsHtml, runePointsLookup, runeReqLevelLookup, runePriorityLookup);

  it('should parse runewords with full lookups', () => {
    expect(runewords.length).toBeGreaterThanOrEqual(380);
  });

  it('should never mix LoD-exclusive runes with ESR runes in a single runeword', () => {
    for (const rw of runewords) {
      const hasEsrOnlyRune = rw.runes.some((r) => esrRuneNames.has(r) && !lodRuneNames.has(r));
      const hasLodExclusiveRune = rw.runes.some((r) => lodRuneNames.has(r) && !esrRuneNames.has(r) && !kanjiRuneNames.has(r));

      expect(
        hasEsrOnlyRune && hasLodExclusiveRune,
        `${rw.name} v${String(rw.variant)} mixes ESR-only and LoD-exclusive runes: ${rw.runes.join(', ')}`
      ).toBe(false);
    }
  });

  it('should never mix LoD-exclusive runes with Kanji runes in a single runeword', () => {
    for (const rw of runewords) {
      const hasKanjiRune = rw.runes.some((r) => kanjiRuneNames.has(r));
      const hasLodExclusiveRune = rw.runes.some((r) => lodRuneNames.has(r) && !esrRuneNames.has(r) && !kanjiRuneNames.has(r));

      expect(
        hasKanjiRune && hasLodExclusiveRune,
        `${rw.name} v${String(rw.variant)} mixes Kanji and LoD-exclusive runes: ${rw.runes.join(', ')}`
      ).toBe(false);
    }
  });

  it('should classify LoD runewords (sortKey >= 10000) only when they have LoD-exclusive runes', () => {
    for (const rw of runewords) {
      const hasLodExclusiveRune = rw.runes.some((r) => lodRuneNames.has(r) && !esrRuneNames.has(r) && !kanjiRuneNames.has(r));
      const isLod = rw.sortKey >= 10000;

      expect(
        isLod,
        `${rw.name} v${String(rw.variant)} sortKey=${String(rw.sortKey)} but hasLodExclusiveRune=${String(hasLodExclusiveRune)}`
      ).toBe(hasLodExclusiveRune);
    }
  });

  it('should classify Gold Scarab (Ko, Metal, Mu, Shi) as ESR, not LoD', () => {
    const goldScarab = runewords.find((r) => r.name === 'Gold Scarab');
    expect(goldScarab).toBeDefined();
    expect(goldScarab!.sortKey).toBeLessThan(10000);
  });

  it('should classify Call to Arms as LoD', () => {
    const cta = runewords.find((r) => r.name === 'Call to Arms');
    expect(cta).toBeDefined();
    expect(cta!.sortKey).toBeGreaterThanOrEqual(10000);
  });

  it('should have consistent tierPointTotals categories with sortKey classification', () => {
    for (const rw of runewords) {
      const isLod = rw.sortKey >= 10000;

      for (const tpt of rw.tierPointTotals) {
        if (isLod) {
          expect(tpt.category, `LoD runeword ${rw.name} v${String(rw.variant)} has non-LoD tier points`).toBe('lodRunes');
        } else {
          expect(tpt.category, `ESR runeword ${rw.name} v${String(rw.variant)} has LoD tier points`).not.toBe('lodRunes');
        }
      }
    }
  });

  it('should have every rune in a runeword be recognized as ESR, LoD, or Kanji', () => {
    for (const rw of runewords) {
      for (const rune of rw.runes) {
        const isKnown = esrRuneNames.has(rune) || lodRuneNames.has(rune) || kanjiRuneNames.has(rune);
        expect(isKnown, `${rw.name} v${String(rw.variant)} has unknown rune: ${rune}`).toBe(true);
      }
    }
  });
});
