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
  parseRecipeAffixes,
  parseRecipeBonusPools,
  parseRecipeBonusesCell,
  parseSocketableBonusGroups,
  parseSocketableGroupLabel,
  isWrappedContinuation,
  mergeWrappedLines,
  mergeWrappedCellLines,
  extractCellLines,
  fillUnformattedBleedDuration,
  splitCellLineGroups,
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

function cellFrom(html: string): Element {
  const doc = new DOMParser().parseFromString(`<table><tr><td>${html}</td></tr></table>`, 'text/html');
  const td = doc.querySelector('td');
  if (!td) throw new Error('no td');
  return td;
}

describe('isWrappedContinuation', () => {
  it('continues when the next line starts with a lowercase letter', () => {
    expect(isWrappedContinuation('Adds 3-4 Fire Damage to Attacks', 'per 4 Dexterity')).toBe(true);
  });

  it('continues when the previous line ends with a comma', () => {
    expect(isWrappedContinuation('While casting or channeling, you have 50% dodge,', 'Physical resist')).toBe(true);
  });

  it('continues when the previous line ends with a lowercase continuation word', () => {
    expect(isWrappedContinuation('Gain 1% Lightning Spell Damage per 100 Strength when', 'Taking Damage for 5 Seconds')).toBe(true);
    expect(isWrappedContinuation('Your Holy Auras have a 25% chance to crit for', '1% more total damage per 50 energy')).toBe(true);
  });

  it('does not continue after a verb: only function words are continuation words', () => {
    expect(isWrappedContinuation('makes your physical attacks deal', '10 additional unscalable damage')).toBe(false);
    expect(isWrappedContinuation('Reap Souls provides', '15% additional Physical Damage')).toBe(false);
  });

  it('does not continue a line that ends with a full stop before a capitalised line', () => {
    expect(
      isWrappedContinuation('have a 25% chance to release twice on discharge.', 'Fists of Fire, Claws of Thunder and Blades of Ice')
    ).toBe(false);
  });

  it('does not continue complete statements', () => {
    expect(isWrappedContinuation('Taking Damage for 5 Seconds', 'This effect can stack up to 25 times')).toBe(false);
    expect(isWrappedContinuation('+1 to All Skills', '+20 to Strength')).toBe(false);
    expect(isWrappedContinuation('dealing 25% weapon damage as cold and return to you', "Reduce enemies' cold resist by 0.5%")).toBe(false);
  });

  it('matches continuation words case-sensitively (Title Case endings are complete)', () => {
    expect(isWrappedContinuation('+5 To All', '+10 to Life')).toBe(false);
  });

  it('never continues across an empty line', () => {
    expect(isWrappedContinuation('', 'per 4 Dexterity')).toBe(false);
    expect(isWrappedContinuation('Adds 1 Damage and', '')).toBe(false);
  });
});

describe('mergeWrappedLines', () => {
  it('joins wrapped lines with a single space', () => {
    expect(
      mergeWrappedLines([
        "Each cast lowers 12% the aimed target's and surrounding",
        'enemies elemental, magic, and physical resistances, but you',
        'lose 4% total resistances for 1 second. Maximum stacks: 25',
        '25% Chance to Cast Level 60 Elemental Surge when you Kill an Enemy',
      ])
    ).toEqual([
      "Each cast lowers 12% the aimed target's and surrounding enemies elemental, magic, and physical resistances, but you lose 4% total resistances for 1 second. Maximum stacks: 25",
      '25% Chance to Cast Level 60 Elemental Surge when you Kill an Enemy',
    ]);
  });

  it("keeps Imperius' separate statements apart while joining the wrapped one", () => {
    expect(
      mergeWrappedLines([
        'Gain 1% Lightning Spell Damage per 100 Strength when',
        'Taking  Damage for 5 Seconds',
        'This effect can stack up to 25 times',
        'Lightning Spell Damage from Energy no Longer Works',
      ])
    ).toEqual([
      'Gain 1% Lightning Spell Damage per 100 Strength when Taking Damage for 5 Seconds',
      'This effect can stack up to 25 times',
      'Lightning Spell Damage from Energy no Longer Works',
    ]);
  });

  it('leaves the reversed Mosaic lines as two lines', () => {
    const lines = ['have a 25% chance to release twice on discharge.', 'Fists of Fire, Claws of Thunder and Blades of Ice'];
    expect(mergeWrappedLines(lines)).toEqual(lines);
  });

  it('treats empty strings as group separators and drops them', () => {
    expect(mergeWrappedLines(['Gain 5% damage and', '', 'reduced stats'])).toEqual(['Gain 5% damage and', 'reduced stats']);
  });
});

describe('mergeWrappedCellLines', () => {
  it('does not merge across a colour boundary', () => {
    expect(
      mergeWrappedCellLines([
        { text: 'Gain 1% damage for', orange: true },
        { text: 'enhanced damage', orange: false },
      ])
    ).toEqual([
      { text: 'Gain 1% damage for', orange: true },
      { text: 'enhanced damage', orange: false },
    ]);
  });

  it('merges within the same colour and keeps the colour', () => {
    expect(
      mergeWrappedCellLines([
        { text: 'Adds 3-4 Fire Damage to Attacks', orange: true },
        { text: 'per 4 Dexterity', orange: true },
      ])
    ).toEqual([{ text: 'Adds 3-4 Fire Damage to Attacks per 4 Dexterity', orange: true }]);
  });
});

describe('extractCellLines', () => {
  it('splits on <br> elements and tracks orange fonts spanning several lines', () => {
    const cell = cellFrom('<font color=4850B8><FONT COLOR="ORANGE"><br>First<br>Second</FONT><br>Regular</font>');
    expect(extractCellLines(cell)).toEqual([
      { text: '', orange: false },
      { text: 'First', orange: true },
      { text: 'Second', orange: true },
      { text: 'Regular', orange: false },
    ]);
  });

  it('matches the orange colour case-insensitively, quoted or not', () => {
    const cell = cellFrom('<font color=orange>a</font><br><font color="Orange">b</font><br><font color="#908858">c</font>');
    expect(extractCellLines(cell).map((l) => l.orange)).toEqual([true, true, false]);
  });

  it('normalises whitespace and decodes entities', () => {
    expect(extractCellLines(cellFrom('Pierce   Flesh &amp;\n Bone'))).toEqual([{ text: 'Pierce Flesh & Bone', orange: false }]);
  });
  it('reads ESR 3.3\'s unfilled bleed duration as "over time" (the page has no number for it)', () => {
    const cell = cellFrom('Adds 25%-50% Bleed Damage over %.2f seconds<br>\n\t\tAdds 1%-1000% Bleed Damage over %.2f seconds');
    expect(extractCellLines(cell).map((line) => line.text)).toEqual([
      'Adds 25%-50% Bleed Damage over time',
      'Adds 1%-1000% Bleed Damage over time',
    ]);
  });
});

describe('fillUnformattedBleedDuration', () => {
  it('replaces only an unfilled printf duration and keeps real numbers', () => {
    expect(fillUnformattedBleedDuration('Adds 400%-500% Bleed Damage over %.2f seconds')).toBe('Adds 400%-500% Bleed Damage over time');
    expect(fillUnformattedBleedDuration('Adds 400%-500% Bleed Damage over 2.00 seconds')).toBe(
      'Adds 400%-500% Bleed Damage over 2.00 seconds'
    );
    expect(fillUnformattedBleedDuration('+50% Cold Damage over 3 seconds')).toBe('+50% Cold Damage over 3 seconds');
  });
});

describe('splitCellLineGroups', () => {
  it('splits on <br><br> but not on a leading <br>', () => {
    const groups = splitCellLineGroups(extractCellLines(cellFrom('<br>A<br>B<br><br>C<br>')));
    expect(groups.map((g) => g.map((l) => l.text).filter(Boolean))).toEqual([['A', 'B'], ['C']]);
  });
});

describe('parseRecipeAffixes with hard-wrapped lines', () => {
  it('joins wrapped recipe lines and still ignores the ingredient bonuses after <br><br>', () => {
    const cell = cellFrom(
      '<font color="8080E6"><FONT COLOR="ORANGE">You gain a random amount of total spell damage<br>between 1% and 50% every 3 seconds</FONT><br>+5 to All Skills<br><br>+30 to Strength<br>and more</font>'
    );
    expect(parseRecipeAffixes(cell).map((a) => a.rawText)).toEqual([
      'You gain a random amount of total spell damage between 1% and 50% every 3 seconds',
      '+5 to All Skills',
    ]);
  });
});

describe('parseRecipeBonusPools', () => {
  const poolCell =
    '<font color="8080E6">\n+1 to All Skills<br><FONT COLOR="LIGHTGRAY">Sockets cannot be removed</FONT><br><br>' +
    '<FONT COLOR="WHITE">1-2 of the following:</FONT><br>+(20 to 30) Defense <br>All Resists +(5 to 7) <br><br>' +
    '<FONT COLOR="WHITE">2-3 of the following:</FONT><br>+(10 to 15) to Life <br><br>' +
    '+20 Defense <br>All Resists +5 <br><br>\n</font>';

  it('returns each header-led group between the recipe bonuses and the ingredient bonuses', () => {
    const pools = parseRecipeBonusPools(cellFrom(poolCell));
    expect(pools.map((pool) => ({ label: pool.label, lines: pool.affixes.map((a) => a.rawText) }))).toEqual([
      { label: '1-2 of the following:', lines: ['+(20 to 30) Defense', 'All Resists +(5 to 7)'] },
      { label: '2-3 of the following:', lines: ['+(10 to 15) to Life'] },
    ]);
  });

  it('does not change the recipe bonuses', () => {
    expect(parseRecipeAffixes(cellFrom(poolCell)).map((a) => a.rawText)).toEqual(['+1 to All Skills', 'Sockets cannot be removed']);
  });

  it('returns no pools for cells with only recipe and ingredient bonuses (extra blank lines included)', () => {
    expect(parseRecipeBonusPools(cellFrom('+1 to All Skills<br><br><br>+20 Defense<br><br><br><br>'))).toEqual([]);
    expect(parseRecipeBonusPools(cellFrom('\n'))).toEqual([]);
  });

  it('never treats the first or the trailing (ingredient) group as a pool', () => {
    expect(parseRecipeBonusPools(cellFrom('+1 to All Skills<br><br>1-2 of the following:<br>+20 Defense'))).toEqual([]);
    expect(parseRecipeBonusPools(cellFrom('1-2 of the following:<br>+20 Defense<br><br>+5 Life'))).toEqual([]);
  });
});

describe('parseAffixes with hard-wrapped lines', () => {
  it('joins wrapped lines', () => {
    const cell = cellFrom('+10% Enhanced Damage and<br>+5 to Strength<br>+1 to Light Radius');
    expect(parseAffixes(cell).map((a) => a.rawText)).toEqual(['+10% Enhanced Damage and +5 to Strength', '+1 to Light Radius']);
  });
});

describe('parseRecipeBonusesCell (ESR 3.3 "Bonuses" column)', () => {
  it('keeps every pool (no trailing ingredient group) and every non-pool group as the recipe bonuses', () => {
    const cell = cellFrom(
      '<font color="8080E6">+1 to All Skills<br><FONT COLOR="LIGHTGRAY">Socketables cannot be removed</FONT><br><br>' +
        '<FONT COLOR="WHITE">1-2 of the following:</FONT><br>+(20 to 30) Defense <br><br>' +
        '<FONT COLOR="WHITE">1-2 of the following:</FONT><br>+(10 to 15) to Life <br><br>Requirements -100% </font>'
    );
    const { affixes, pools } = parseRecipeBonusesCell(cell);
    expect(affixes.map((a) => a.rawText)).toEqual(['+1 to All Skills', 'Socketables cannot be removed', 'Requirements -100%']);
    expect(pools.map((pool) => [pool.label, pool.affixes.map((a) => a.rawText)])).toEqual([
      ['1-2 of the following:', ['+(20 to 30) Defense']],
      ['1-2 of the following:', ['+(10 to 15) to Life']],
    ]);
  });
});

describe('parseSocketableGroupLabel', () => {
  it("splits the item types and keeps each one's exceptions", () => {
    expect(parseSocketableGroupLabel('Weapon (except Orb, Staff, Wand) / Missile / Mythical Arcane Staff')).toEqual([
      { name: 'Weapon', except: ['Orb', 'Staff', 'Wand'] },
      { name: 'Missile', except: [] },
      { name: 'Mythical Arcane Staff', except: [] },
    ]);
    expect(parseSocketableGroupLabel('Spear / Blunt (except Staff) / Polearm')).toEqual([
      { name: 'Spear', except: [] },
      { name: 'Blunt', except: ['Staff'] },
      { name: 'Polearm', except: [] },
    ]);
    expect(parseSocketableGroupLabel('')).toEqual([]);
  });
});

describe('parseSocketableBonusGroups (ESR 3.3 "Socketable Bonuses" column)', () => {
  it('reads one labelled group per rws-group', () => {
    const cell = cellFrom(
      '<div class="rws-groups">' +
        '<div class="rws-group"><div class="rws-label"><span>Weapon</span> (<span>except</span> <span>Orb</span>, <span>Staff</span>, <span>Wand</span>) / <span>Missile</span></div><font color="8080E6">+15% Enhanced Damage<br>+10 to Strength </font></div>' +
        '<div class="rws-group"><div class="rws-label"><span>Staff</span> / <span>Wand</span> / <span>Orb</span></div><font color="8080E6">+30 Defense </font></div>' +
        '</div>'
    );
    expect(
      parseSocketableBonusGroups(cell).map((group) => [group.label, group.itemTypes.length, group.affixes.map((a) => a.rawText)])
    ).toEqual([
      ['Weapon (except Orb, Staff, Wand) / Missile', 2, ['+15% Enhanced Damage', '+10 to Strength']],
      ['Staff / Wand / Orb', 3, ['+30 Defense']],
    ]);
  });

  it('reads a plain list as one unlabelled group, and an empty cell as none', () => {
    const groups = parseSocketableBonusGroups(
      cellFrom('\n<font><font color="8080E6">+1 to All Skills <br>+50 to Strength </font></font>\n')
    );
    expect(groups.map((group) => [group.label, group.itemTypes, group.affixes.map((a) => a.rawText)])).toEqual([
      ['', [], ['+1 to All Skills', '+50 to Strength']],
    ]);
    expect(parseSocketableBonusGroups(cellFrom('\n'))).toEqual([]);
  });
});
