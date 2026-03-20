import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseMythicalUniques } from './mythicalUniquesParser';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mythicalsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/unique_mythicals.htm'), 'utf-8');

// ─── Parse all items ─────────────────────────────────────────────────────────

const items = parseMythicalUniques(mythicalsHtml);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Parse count assertions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Parse counts', () => {
  it('should parse a significant number of mythical uniques', () => {
    expect(items.length).toBeGreaterThanOrEqual(30);
    console.log('[Test] Parsed mythical uniques:', items.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Data quality - names
// ═══════════════════════════════════════════════════════════════════════════════

describe('Item names', () => {
  it('every item should have a non-empty name', () => {
    for (const item of items) {
      expect(item.name.length, `Item at index has empty name`).toBeGreaterThan(0);
    }
  });

  it('no name should contain HTML tags', () => {
    for (const item of items) {
      expect(item.name, `${item.name} contains HTML tags`).not.toMatch(/<[^>]*>/);
    }
  });

  it('no name should have leading/trailing whitespace', () => {
    for (const item of items) {
      expect(item.name).toBe(item.name.trim());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Categories
// ═══════════════════════════════════════════════════════════════════════════════

describe('Categories', () => {
  it('every item should have a non-empty category', () => {
    for (const item of items) {
      expect(item.category.length, `${item.name}: empty category`).toBeGreaterThan(0);
    }
  });

  it('should have all 4 expected categories', () => {
    const categories = new Set(items.map((i) => i.category));
    expect(categories.has('Mythical Unique Weapons')).toBe(true);
    expect(categories.has('Mythical Unique Armor')).toBe(true);
    expect(categories.has('Mythical Unique Jewelry')).toBe(true);
    expect(categories.has('Dedicated Drops Mythical Uniques')).toBe(true);
    console.log('[Test] Categories:', Array.from(categories).sort().join(', '));
  });

  it('should have weapons as the largest category', () => {
    const weapons = items.filter((i) => i.category === 'Mythical Unique Weapons');
    expect(weapons.length).toBeGreaterThanOrEqual(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Level data
// ═══════════════════════════════════════════════════════════════════════════════

describe('Level data', () => {
  it('every item should have reqLevel >= 0', () => {
    for (const item of items) {
      expect(item.reqLevel, `${item.name}: reqLevel`).toBeGreaterThanOrEqual(0);
    }
  });

  it('every item should have itemLevel >= 0', () => {
    for (const item of items) {
      expect(item.itemLevel, `${item.name}: itemLevel`).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Properties quality
// ═══════════════════════════════════════════════════════════════════════════════

describe('Properties', () => {
  it('most items should have at least one property', () => {
    const withProps = items.filter((item) => item.properties.length > 0 || item.specialProperties.length > 0);
    expect(withProps.length / items.length).toBeGreaterThan(0.9);
  });

  it('no property should contain HTML tags', () => {
    for (const item of items) {
      for (const prop of [...item.properties, ...item.specialProperties]) {
        expect(prop, `${item.name}: property contains HTML tags`).not.toMatch(/<[^>]*>/);
      }
    }
  });

  it('no property should have leading/trailing whitespace', () => {
    for (const item of items) {
      for (const prop of [...item.properties, ...item.specialProperties]) {
        expect(prop, `${item.name}: property has whitespace`).toBe(prop.trim());
      }
    }
  });

  it('no property should contain double spaces', () => {
    for (const item of items) {
      for (const prop of [...item.properties, ...item.specialProperties]) {
        expect(prop, `${item.name}: "${prop}" has double space`).not.toMatch(/\s{2,}/);
      }
    }
  });

  it('no property should contain HTML entities', () => {
    for (const item of items) {
      for (const prop of [...item.properties, ...item.specialProperties]) {
        expect(prop, `${item.name}: "${prop}" has HTML entity`).not.toMatch(/&amp;|&lt;|&gt;|&quot;/);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Special properties (orange text)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Special properties', () => {
  it('should detect some items with special properties', () => {
    const withSpecial = items.filter((item) => item.specialProperties.length > 0);
    expect(withSpecial.length).toBeGreaterThan(0);
    console.log('[Test] Items with special properties:', withSpecial.length);
  });

  it('special properties should not contain HTML tags', () => {
    for (const item of items) {
      for (const prop of item.specialProperties) {
        expect(prop, `${item.name}: special property contains HTML tags`).not.toMatch(/<[^>]*>/);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Notes
// ═══════════════════════════════════════════════════════════════════════════════

describe('Notes', () => {
  it('should detect some items with notes', () => {
    const withNotes = items.filter((item) => item.notes.length > 0);
    expect(withNotes.length).toBeGreaterThan(0);
    console.log('[Test] Items with notes:', withNotes.length);
  });

  it('no note should contain HTML tags', () => {
    for (const item of items) {
      for (const note of item.notes) {
        expect(note, `${item.name}: note contains HTML tags`).not.toMatch(/<[^>]*>/);
      }
    }
  });

  it('no note should have leading/trailing whitespace', () => {
    for (const item of items) {
      for (const note of item.notes) {
        expect(note, `${item.name}: note has whitespace`).toBe(note.trim());
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Base items
// ═══════════════════════════════════════════════════════════════════════════════

describe('Base items', () => {
  it('every item should have a non-empty baseItem', () => {
    for (const item of items) {
      expect(item.baseItem.length, `${item.name}: empty baseItem`).toBeGreaterThan(0);
    }
  });

  it('no baseItem should contain HTML tags', () => {
    for (const item of items) {
      expect(item.baseItem, `${item.name}: baseItem contains HTML tags`).not.toMatch(/<[^>]*>/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Images
// ═══════════════════════════════════════════════════════════════════════════════

describe('Images', () => {
  it('should detect some items with images', () => {
    const withImages = items.filter((item) => item.imageUrl.length > 0);
    expect(withImages.length).toBeGreaterThan(0);
    console.log('[Test] Items with images:', withImages.length);
  });

  it('image URLs should not contain HTML tags', () => {
    for (const item of items) {
      if (item.imageUrl) {
        expect(item.imageUrl, `${item.name}: imageUrl contains HTML tags`).not.toMatch(/<[^>]*>/);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: Known item verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Known items', () => {
  it("should parse Mephisto's Will (first weapon)", () => {
    const item = items.find((i) => i.name === "Mephisto's Will");
    expect(item).toBeDefined();
    expect(item!.baseItem).toBe('Mythical Demonic Wand');
    expect(item!.baseItemLink).toBe('weapons.htm#m04');
    expect(item!.category).toBe('Mythical Unique Weapons');
    expect(item!.itemLevel).toBe(100);
    expect(item!.reqLevel).toBe(90);
    expect(item!.properties.length).toBeGreaterThan(0);
    expect(item!.specialProperties.length).toBeGreaterThan(0);
    expect(item!.imageUrl).toBe('./images/mythical-uniques/mephistos_will.png');
  });

  it('should parse Headhunter (armor with notes)', () => {
    const item = items.find((i) => i.name === 'Headhunter');
    expect(item).toBeDefined();
    expect(item!.category).toBe('Mythical Unique Armor');
    expect(item!.baseItem).toBe('Mythical Hemp Band');
    expect(item!.baseItemLink).toBe('armors.htm#m10');
    expect(item!.notes.length).toBeGreaterThan(0);
    expect(item!.imageUrl).toContain('headhunter');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: Data snapshot counts
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data snapshot counts', () => {
  it('should report counts for tracking ESR updates', () => {
    const total = items.length;
    const weapons = items.filter((i) => i.category === 'Mythical Unique Weapons').length;
    const armor = items.filter((i) => i.category === 'Mythical Unique Armor').length;
    const jewelry = items.filter((i) => i.category === 'Mythical Unique Jewelry').length;
    const dedicated = items.filter((i) => i.category === 'Dedicated Drops Mythical Uniques').length;
    const withSpecial = items.filter((i) => i.specialProperties.length > 0).length;
    const withNotes = items.filter((i) => i.notes.length > 0).length;
    const withImages = items.filter((i) => i.imageUrl.length > 0).length;

    console.log('[Test] Mythical Uniques snapshot:', {
      total,
      weapons,
      armor,
      jewelry,
      dedicated,
      withSpecial,
      withNotes,
      withImages,
    });

    expect(total).toBeGreaterThanOrEqual(30);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: Edge cases (synthetic HTML)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('should return empty array for empty HTML', () => {
    expect(parseMythicalUniques('')).toEqual([]);
  });

  it('should return empty array for HTML with no tables', () => {
    expect(parseMythicalUniques('<html><body><p>No tables here</p></body></html>')).toEqual([]);
  });

  it('should skip rows with fewer than 4 cells', () => {
    const html = `
      <table>
        <tr><td colspan="4" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td><td>Notes</td></tr>
        <tr><td>Only one cell</td></tr>
        <tr>
          <td><b>Valid Item<br><a href="test.htm#t1">Mythical Test</a></b></td>
          <td>Item Level: 100<br>Required Level: 90</td>
          <td><font color=4850B8>+1 to All Skills</font></td>
          <td>A note</td>
        </tr>
      </table>`;
    const result = parseMythicalUniques(html);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Valid Item');
    expect(result[0].baseItem).toBe('Mythical Test');
    expect(result[0].baseItemLink).toBe('test.htm#t1');
    expect(result[0].notes).toEqual(['A note']);
  });

  it('should skip rows where name cell has no <b> tag', () => {
    const html = `
      <table>
        <tr><td colspan="4" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td><td>Notes</td></tr>
        <tr><td>No bold tag here</td><td>Item Level: 1</td><td>+1 to Life</td><td></td></tr>
      </table>`;
    const result = parseMythicalUniques(html);
    expect(result).toHaveLength(0);
  });

  it('should default levels to 0 for non-numeric values', () => {
    const html = `
      <table>
        <tr><td colspan="4" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td><td>Notes</td></tr>
        <tr>
          <td><b>Test Item<br><a href="t.htm">Base</a></b></td>
          <td>Item Level: N/A<br>Required Level: ???</td>
          <td>+1 to All Skills</td>
          <td></td>
        </tr>
      </table>`;
    const result = parseMythicalUniques(html);
    expect(result).toHaveLength(1);
    expect(result[0].itemLevel).toBe(0);
    expect(result[0].reqLevel).toBe(0);
  });

  it('should correctly classify orange properties as special', () => {
    const html = `
      <table>
        <tr><td colspan="4" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td><td>Notes</td></tr>
        <tr>
          <td><b>Test Item<br><a href="t.htm">Base</a></b></td>
          <td>Item Level: 100<br>Required Level: 90</td>
          <td><font color=4850B8><FONT COLOR="ORANGE">Special Effect</FONT><br>Regular Effect</font></td>
          <td></td>
        </tr>
      </table>`;
    const result = parseMythicalUniques(html);
    expect(result).toHaveLength(1);
    expect(result[0].specialProperties).toContain('Special Effect');
    expect(result[0].properties).toContain('Regular Effect');
  });
});
