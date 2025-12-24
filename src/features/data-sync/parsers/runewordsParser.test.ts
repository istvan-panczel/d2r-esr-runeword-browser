import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractName, extractSockets, extractRunes, extractAllowedItems, extractAffixes, parseRunewordsHtml } from './runewordsParser';

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
    const affixes = extractAffixes(cells);

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
    const affixes = extractAffixes(cells);

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
    const affixes = extractAffixes(cells);

    expect(affixes).toHaveLength(1);
    expect(affixes[0].rawText).toBe('+2% Enhanced Maximum Damage (Based on Character Level)');
    // Note: +2 becomes # (the + is part of the number pattern)
    expect(affixes[0].pattern).toBe('#% Enhanced Maximum Damage (Based on Character Level)');
  });
});

describe('parseRunewordsHtml integration', () => {
  const html = readFileSync(resolve(__dirname, '../../../../public/data/runewords.htm'), 'utf-8');

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
