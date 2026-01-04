import { describe, it, expect } from 'vitest';
import {
  parseReqLevel,
  extractValue,
  detectValueType,
  parseAffixes,
  parseBonuses,
  hasColoredInnerFont,
  getInnerFontColor,
  getItemName,
  normalizeRuneName,
} from './parserUtils';

describe('parseReqLevel', () => {
  it('should extract required level from valid text', () => {
    expect(parseReqLevel('Req Lvl: 15')).toBe(15);
    expect(parseReqLevel('Req Lvl: 1')).toBe(1);
    expect(parseReqLevel('Req Lvl: 69')).toBe(69);
  });

  it('should handle case variations', () => {
    expect(parseReqLevel('req lvl: 10')).toBe(10);
    expect(parseReqLevel('REQ LVL: 20')).toBe(20);
  });

  it('should return 0 when no match found', () => {
    expect(parseReqLevel('Level: 15')).toBe(0);
    expect(parseReqLevel('')).toBe(0);
    expect(parseReqLevel('No level here')).toBe(0);
  });

  it('should extract level from text with surrounding content', () => {
    expect(parseReqLevel('Some item\nReq Lvl: 42\nMore text')).toBe(42);
  });
});

describe('extractValue', () => {
  it('should extract single numbers', () => {
    expect(extractValue('+15')).toBe(15);
    expect(extractValue('-5')).toBe(5);
    expect(extractValue('25')).toBe(25);
  });

  it('should extract range values', () => {
    expect(extractValue('Adds 10-20 Fire Damage')).toEqual([10, 20]);
    expect(extractValue('1-5 Cold Damage')).toEqual([1, 5]);
  });

  it('should return null for no numbers', () => {
    expect(extractValue('No numbers here')).toBe(null);
    expect(extractValue('')).toBe(null);
  });

  it('should prefer range over single number', () => {
    expect(extractValue('+5 to Attack Rating, Adds 10-20 Damage')).toEqual([10, 20]);
  });
});

describe('detectValueType', () => {
  it('should detect range values', () => {
    expect(detectValueType('10-20')).toBe('range');
    expect(detectValueType('Adds 1-5 Damage')).toBe('range');
  });

  it('should detect percent values', () => {
    expect(detectValueType('+15%')).toBe('percent');
    expect(detectValueType('50% Better Chance')).toBe('percent');
  });

  it('should detect flat values', () => {
    expect(detectValueType('+10')).toBe('flat');
    expect(detectValueType('-5 to Enemy')).toBe('flat');
    expect(detectValueType('25 Defense')).toBe('flat');
  });

  it('should return none for no numeric values', () => {
    expect(detectValueType('Cannot Be Frozen')).toBe('none');
    expect(detectValueType('Knockback')).toBe('none');
    expect(detectValueType('')).toBe('none');
  });
});

describe('parseAffixes', () => {
  it('should parse affixes from HTML cell', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><table><tr><td>+15% Enhanced Damage<br>+10 to Strength<br></td></tr></table></body></html>',
      'text/html'
    );
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    const affixes = parseAffixes(cell!);

    expect(affixes).toHaveLength(2);
    expect(affixes[0].rawText).toBe('+15% Enhanced Damage');
    expect(affixes[0].valueType).toBe('percent');
    expect(affixes[1].rawText).toBe('+10 to Strength');
    expect(affixes[1].valueType).toBe('flat');
  });

  it('should return empty array for empty cell', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body><table><tr><td></td></tr></table></body></html>', 'text/html');
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(parseAffixes(cell!)).toEqual([]);
  });

  it('should generate pattern by replacing numbers with #', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body><table><tr><td>+15% Enhanced Damage</td></tr></table></body></html>', 'text/html');
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    const affixes = parseAffixes(cell!);

    // The regex /[+-]?\d+/g matches "+15" as a whole, replacing it with "#"
    expect(affixes[0].pattern).toBe('#% Enhanced Damage');
  });
});

describe('hasColoredInnerFont', () => {
  it('should return true when colored inner font exists', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><table><tr><td><font color="GRAY"><b><font color="RED">Item Name</font></b></font></td></tr></table></body></html>',
      'text/html'
    );
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(hasColoredInnerFont(cell!)).toBe(true);
  });

  it('should return false when no colored inner font', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><table><tr><td><font color="GRAY"><b>Item Name</b></font></td></tr></table></body></html>',
      'text/html'
    );
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(hasColoredInnerFont(cell!)).toBe(false);
  });
});

describe('getInnerFontColor', () => {
  it('should return uppercase color from inner font', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><table><tr><td><font color="GRAY"><b><font color="red">Item</font></b></font></td></tr></table></body></html>',
      'text/html'
    );
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(getInnerFontColor(cell!)).toBe('RED');
  });

  it('should return null when no inner font', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><table><tr><td><font color="GRAY"><b>Item</b></font></td></tr></table></body></html>',
      'text/html'
    );
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(getInnerFontColor(cell!)).toBe(null);
  });
});

describe('getItemName', () => {
  it('should get name from colored inner font', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><table><tr><td><font color="GRAY"><b><font color="RED">Perfect Ruby</font></b></font></td></tr></table></body></html>',
      'text/html'
    );
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(getItemName(cell!)).toBe('Perfect Ruby');
  });

  it('should fall back to b tag text', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<html><body><table><tr><td><font color="GRAY"><b>El Rune</b></font></td></tr></table></body></html>',
      'text/html'
    );
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(getItemName(cell!)).toBe('El Rune');
  });

  it('should return empty string for empty cell', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<html><body><table><tr><td></td></tr></table></body></html>', 'text/html');
    const cell = doc.querySelector('td');
    expect(cell).not.toBeNull();

    expect(getItemName(cell!)).toBe('');
  });
});

describe('parseBonuses', () => {
  it('should parse three bonus categories from header row', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<table>
        <tr id="header"><td colspan="3">Header</td></tr>
        <tr><td>Weapons</td><td>Helms</td><td>Armor</td></tr>
        <tr>
          <td>+10% Damage<br></td>
          <td>+5 Defense<br></td>
          <td>+3% Block<br></td>
        </tr>
      </table>`,
      'text/html'
    );
    const headerRow = doc.querySelector('#header')!;

    const bonuses = parseBonuses(headerRow);

    expect(bonuses.weaponsGloves).toHaveLength(1);
    expect(bonuses.weaponsGloves[0].rawText).toBe('+10% Damage');
    expect(bonuses.helmsBoots).toHaveLength(1);
    expect(bonuses.helmsBoots[0].rawText).toBe('+5 Defense');
    expect(bonuses.armorShieldsBelts).toHaveLength(1);
    expect(bonuses.armorShieldsBelts[0].rawText).toBe('+3% Block');
  });
});

describe('normalizeRuneName', () => {
  it('should strip "(X points)" suffix and extract points', () => {
    expect(normalizeRuneName('I Rune (1 points)')).toEqual({ name: 'I Rune', points: 1 });
    expect(normalizeRuneName('El Rune (1 points)')).toEqual({ name: 'El Rune', points: 1 });
    expect(normalizeRuneName('Zod Rune (128 points)')).toEqual({ name: 'Zod Rune', points: 128 });
  });

  it('should handle "(X point)" singular form', () => {
    expect(normalizeRuneName('I Rune (1 point)')).toEqual({ name: 'I Rune', points: 1 });
  });

  it('should return undefined points when no suffix present', () => {
    expect(normalizeRuneName('I Rune')).toEqual({ name: 'I Rune', points: undefined });
    expect(normalizeRuneName('Ru Rune')).toEqual({ name: 'Ru Rune', points: undefined });
    expect(normalizeRuneName('Moon Rune')).toEqual({ name: 'Moon Rune', points: undefined });
  });

  it('should trim whitespace', () => {
    expect(normalizeRuneName('  I Rune (1 points)  ')).toEqual({ name: 'I Rune', points: 1 });
    expect(normalizeRuneName('  El Rune  ')).toEqual({ name: 'El Rune', points: undefined });
  });

  it('should handle case variations in "points"', () => {
    expect(normalizeRuneName('I Rune (1 POINTS)')).toEqual({ name: 'I Rune', points: 1 });
    expect(normalizeRuneName('I Rune (1 Points)')).toEqual({ name: 'I Rune', points: 1 });
  });
});
