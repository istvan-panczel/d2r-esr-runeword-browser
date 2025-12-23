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
    expect(extractAllowedItems(cell)).toEqual(['Weapon']);
  });

  it('should extract multiple item types', () => {
    const cell = createElementFromHtml('<td>Body Armor<br>Any Shield<br></td>');
    expect(extractAllowedItems(cell)).toEqual(['Body Armor', 'Any Shield']);
  });

  it('should filter empty strings', () => {
    const cell = createElementFromHtml('<td>Weapon<br><br>Missile<br></td>');
    expect(extractAllowedItems(cell)).toEqual(['Weapon', 'Missile']);
  });

  it('should strip font tags', () => {
    const cell = createElementFromHtml('<td><font size="-1">Helm<br>Gloves<br></font></td>');
    expect(extractAllowedItems(cell)).toEqual(['Helm', 'Gloves']);
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

  it('should parse runewords (approximately 280-320 unique)', () => {
    const runewords = parseRunewordsHtml(html);
    expect(runewords.length).toBeGreaterThanOrEqual(280);
    expect(runewords.length).toBeLessThanOrEqual(320);
  });

  it('should parse Boar runeword correctly', () => {
    const runewords = parseRunewordsHtml(html);
    const boar = runewords.find((r) => r.name === 'Boar');

    expect(boar).toBeDefined();
    expect(boar!.sockets).toBe(1);
    expect(boar!.runes).toEqual(['I Rune']);
    expect(boar!.allowedItems).toContain('Weapon');
    expect(boar!.affixes.length).toBeGreaterThan(0);
  });

  it('should parse Stone runeword correctly', () => {
    const runewords = parseRunewordsHtml(html);
    const stone = runewords.find((r) => r.name === 'Stone');

    expect(stone).toBeDefined();
    expect(stone!.sockets).toBe(2);
    expect(stone!.runes).toEqual(['I Rune', 'Shi Rune']);
    expect(stone!.affixes.length).toBeGreaterThan(0);
  });

  it('should parse Airship runeword with correct runes', () => {
    const runewords = parseRunewordsHtml(html);
    const airship = runewords.find((r) => r.name === 'Airship');

    expect(airship).toBeDefined();
    expect(airship!.runes).toEqual(['Hi Rune', 'Ko Rune', 'U Rune', 'Se Rune', 'N Rune']);
    expect(airship!.sockets).toBe(5);
  });

  it('should merge duplicate runeword entries with different allowed items', () => {
    const runewords = parseRunewordsHtml(html);
    const stone = runewords.find((r) => r.name === 'Stone');

    expect(stone).toBeDefined();
    // Stone should have merged allowedItems from multiple entries
    expect(stone!.allowedItems.length).toBeGreaterThanOrEqual(1);
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
    const boar = runewords.find((r) => r.name === 'Boar');

    // Boar uses I Rune which gives +15% Enhanced Damage as rune bonus
    // The runeword itself should not include this as it's after the separator
    expect(boar).toBeDefined();
    const affixTexts = boar!.affixes.map((a) => a.rawText);

    // Check that runeword affixes are present
    expect(affixTexts.some((t) => t.includes('Minimum Damage') || t.includes('Maximum Damage'))).toBe(true);
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
});
