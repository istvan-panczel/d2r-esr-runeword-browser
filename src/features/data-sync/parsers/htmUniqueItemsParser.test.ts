import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseHtmUniqueItems } from './htmUniqueItemsParser';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const weaponsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/unique_weapons.htm'), 'utf-8');
const armorsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/unique_armors.htm'), 'utf-8');
const othersHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/unique_others.htm'), 'utf-8');

// ─── Parse all pages ─────────────────────────────────────────────────────────

const weapons = parseHtmUniqueItems(weaponsHtml, 'weapons');
const armors = parseHtmUniqueItems(armorsHtml, 'armors');
const others = parseHtmUniqueItems(othersHtml, 'other');

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Parse count assertions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Parse counts', () => {
  it('should parse a significant number of weapons', () => {
    expect(weapons.length).toBeGreaterThanOrEqual(300);
    console.log('[Test] Parsed weapons:', weapons.length);
  });

  it('should parse a significant number of armors', () => {
    expect(armors.length).toBeGreaterThanOrEqual(200);
    console.log('[Test] Parsed armors:', armors.length);
  });

  it('should parse a significant number of others', () => {
    expect(others.length).toBeGreaterThanOrEqual(80);
    console.log('[Test] Parsed others:', others.length);
  });

  it('combined total should be 700+', () => {
    const total = weapons.length + armors.length + others.length;
    expect(total).toBeGreaterThanOrEqual(700);
    console.log('[Test] Total HTM unique items:', total);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Data quality - names
// ═══════════════════════════════════════════════════════════════════════════════

describe('Item names', () => {
  const allItems = [...weapons, ...armors, ...others];

  it('every item should have a non-empty name', () => {
    for (const item of allItems) {
      expect(item.name.length, `Item at index has empty name`).toBeGreaterThan(0);
    }
  });

  it('no name should contain HTML tags', () => {
    for (const item of allItems) {
      expect(item.name, `${item.name} contains HTML tags`).not.toMatch(/<[^>]*>/);
    }
  });

  it('no name should have leading/trailing whitespace', () => {
    for (const item of allItems) {
      expect(item.name).toBe(item.name.trim());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Page field correctness
// ═══════════════════════════════════════════════════════════════════════════════

describe('Page field', () => {
  it('all weapons should have page "weapons"', () => {
    for (const item of weapons) {
      expect(item.page).toBe('weapons');
    }
  });

  it('all armors should have page "armors"', () => {
    for (const item of armors) {
      expect(item.page).toBe('armors');
    }
  });

  it('all others should have page "other"', () => {
    for (const item of others) {
      expect(item.page).toBe('other');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Level data
// ═══════════════════════════════════════════════════════════════════════════════

describe('Level data', () => {
  const allItems = [...weapons, ...armors, ...others];

  it('every item should have reqLevel >= 0', () => {
    for (const item of allItems) {
      expect(item.reqLevel, `${item.name}: reqLevel`).toBeGreaterThanOrEqual(0);
    }
  });

  it('every item should have itemLevel >= 0', () => {
    for (const item of allItems) {
      expect(item.itemLevel, `${item.name}: itemLevel`).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Category extraction
// ═══════════════════════════════════════════════════════════════════════════════

describe('Categories', () => {
  it('every item should have a non-empty category', () => {
    const allItems = [...weapons, ...armors, ...others];
    for (const item of allItems) {
      expect(item.category.length, `${item.name}: empty category`).toBeGreaterThan(0);
    }
  });

  it('weapons should have weapon categories', () => {
    const categories = new Set(weapons.map((w) => w.category));
    expect(categories.has('Axe')).toBe(true);
    expect(categories.has('Sword')).toBe(true);
    expect(categories.has('Bow')).toBe(true);
    console.log('[Test] Weapon categories:', Array.from(categories).sort().join(', '));
  });

  it('armors should have armor categories', () => {
    const categories = new Set(armors.map((a) => a.category));
    expect(categories.has('Helm')).toBe(true);
    console.log('[Test] Armor categories:', Array.from(categories).sort().join(', '));
  });

  it('others should have other categories', () => {
    const categories = new Set(others.map((o) => o.category));
    expect(categories.size).toBeGreaterThan(0);
    console.log('[Test] Other categories:', Array.from(categories).sort().join(', '));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Properties quality
// ═══════════════════════════════════════════════════════════════════════════════

describe('Properties', () => {
  const allItems = [...weapons, ...armors, ...others];

  it('most items should have at least one property', () => {
    const withProps = allItems.filter((item) => item.properties.length > 0);
    expect(withProps.length / allItems.length).toBeGreaterThan(0.95);
  });

  it('no property should contain HTML tags', () => {
    for (const item of allItems) {
      for (const prop of item.properties) {
        expect(prop, `${item.name}: property contains HTML tags`).not.toMatch(/<[^>]*>/);
      }
    }
  });

  it('no property should have leading/trailing whitespace', () => {
    for (const item of allItems) {
      for (const prop of item.properties) {
        expect(prop, `${item.name}: property has whitespace`).toBe(prop.trim());
      }
    }
  });

  it('no property should contain double spaces', () => {
    for (const item of allItems) {
      for (const prop of item.properties) {
        expect(prop, `${item.name}: "${prop}" has double space`).not.toMatch(/\s{2,}/);
      }
    }
  });

  it('no property should contain HTML entities', () => {
    for (const item of allItems) {
      for (const prop of item.properties) {
        expect(prop, `${item.name}: "${prop}" has HTML entity`).not.toMatch(/&amp;|&lt;|&gt;|&quot;/);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Ancient Coupon detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Ancient Coupon items', () => {
  const allItems = [...weapons, ...armors, ...others];

  it('should detect some Ancient Coupon items', () => {
    const couponItems = allItems.filter((item) => item.isAncientCoupon);
    expect(couponItems.length).toBeGreaterThan(0);
    console.log('[Test] Ancient Coupon items:', couponItems.length);
  });

  it('non-coupon items should have isAncientCoupon = false', () => {
    const nonCoupon = allItems.filter((item) => !item.isAncientCoupon);
    expect(nonCoupon.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7b: Notes column (added by ESR 3.12)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Notes column', () => {
  const allItems = [...weapons, ...armors, ...others];
  const withNotes = allItems.filter((item) => item.notes !== '');

  it('every item should have a string notes field', () => {
    for (const item of allItems) {
      expect(typeof item.notes, `${item.name}: notes is not a string`).toBe('string');
    }
  });

  it('should extract notes for a known annotated item', () => {
    const item = weapons.find((w) => w.name === 'Barbaric Devastator');
    expect(item).toBeDefined();
    expect(item?.notes).toBe('Blessed Edge Variant');
  });

  it('should find several "... Variant" notes', () => {
    const variants = withNotes.filter((item) => item.notes.endsWith('Variant'));
    expect(variants.length).toBeGreaterThanOrEqual(5);
    console.log('[Test] Items with notes:', withNotes.length, '| variant notes:', variants.length);
  });

  it('the vast majority of items should have empty notes', () => {
    expect(withNotes.length / allItems.length).toBeLessThan(0.1);
    expect(withNotes.length).toBeGreaterThan(0);
  });

  it('items without a note should have notes === "" (not undefined)', () => {
    const item = weapons.find((w) => w.name === "Krok's Basher");
    expect(item).toBeDefined();
    expect(item?.notes).toBe('');
  });

  it('no note should contain HTML tags, entities, double spaces or edge whitespace', () => {
    for (const item of withNotes) {
      expect(item.notes, `${item.name}: note contains HTML tags`).not.toMatch(/<[^>]*>/);
      expect(item.notes, `${item.name}: note contains HTML entity`).not.toMatch(/&amp;|&lt;|&gt;|&quot;|&nbsp;/);
      expect(item.notes, `${item.name}: note has double space`).not.toMatch(/\s{2,}/);
      expect(item.notes, `${item.name}: note has edge whitespace`).toBe(item.notes.trim());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Known item verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Known items', () => {
  it("should parse Krok's Basher (first weapon)", () => {
    const item = weapons.find((w) => w.name === "Krok's Basher");
    expect(item).toBeDefined();
    expect(item!.baseItem).toBe('Hand Axe');
    expect(item!.baseItemCode).toBe('hax');
    expect(item!.page).toBe('weapons');
    expect(item!.category).toBe('Axe');
    expect(item!.itemLevel).toBe(4);
    expect(item!.reqLevel).toBe(5);
    expect(item!.properties.length).toBeGreaterThan(0);
    expect(item!.isAncientCoupon).toBe(false);
    expect(item!.gambleItem).toBe('Hand Axe');
    expect(item!.notes).toBe('');
  });

  it('should parse The Gnasher (ancient coupon weapon)', () => {
    const item = weapons.find((w) => w.name === 'The Gnasher');
    expect(item).toBeDefined();
    expect(item!.isAncientCoupon).toBe(true);
    expect(item!.baseItemCode).toBe('p01');
    expect(item!.properties.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Data snapshot counts
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data snapshot counts', () => {
  it('should report counts for tracking ESR updates', () => {
    const allItems = [...weapons, ...armors, ...others];
    const total = allItems.length;
    const couponCount = allItems.filter((i) => i.isAncientCoupon).length;
    const withGamble = allItems.filter((i) => i.gambleItem).length;
    const withNotes = allItems.filter((i) => i.notes).length;
    const allCategories = new Set(allItems.map((i) => i.category));

    console.log('[Test] HTM Unique Items snapshot:', {
      total,
      weapons: weapons.length,
      armors: armors.length,
      others: others.length,
      couponItems: couponCount,
      withGamble,
      withNotes,
      categories: allCategories.size,
    });

    expect(total).toBeGreaterThanOrEqual(700);
    expect(couponCount).toBeGreaterThan(0);
    expect(withNotes).toBeGreaterThan(0);
    expect(allCategories.size).toBeGreaterThanOrEqual(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: Edge cases (synthetic HTML)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('should return empty array for empty HTML', () => {
    expect(parseHtmUniqueItems('', 'weapons')).toEqual([]);
  });

  it('should return empty array for HTML with no tables', () => {
    expect(parseHtmUniqueItems('<html><body><p>No tables here</p></body></html>', 'weapons')).toEqual([]);
  });

  it('should skip rows with fewer than 3 cells', () => {
    const html = `
      <table>
        <tr><td colspan="3" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td></tr>
        <tr><td>Only one cell</td></tr>
        <tr><td><b>Valid Item<br>Base (code)</b></td><td>Item Level: 10<br>Required Level: 5</td><td>+1 to All Skills</td></tr>
      </table>`;
    const items = parseHtmUniqueItems(html, 'weapons');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Valid Item');
  });

  it('should skip rows where name cell has no <b> tag', () => {
    const html = `
      <table>
        <tr><td colspan="3" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td></tr>
        <tr><td>No bold tag here</td><td>Item Level: 1</td><td>+1 to Life</td></tr>
      </table>`;
    const items = parseHtmUniqueItems(html, 'armors');
    expect(items).toHaveLength(0);
  });

  it('should parse the 4-column (ESR 3.12+) layout and capture the note', () => {
    const html = `
      <table>
        <tr><td colspan="4" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td><td>Notes</td></tr>
        <tr>
          <td><b>Valid Item<br>Base (code)</b></td>
          <td>Item Level: 10<br>Required Level: 5</td>
          <td>+1 to All Skills</td>
          <td><font face=arial>  Blessed   Edge <br> Variant  </font></td>
        </tr>
        <tr>
          <td><b>Plain Item<br>Base (code)</b></td>
          <td>Item Level: 10<br>Required Level: 5</td>
          <td>+1 to All Skills</td>
          <td><font face=arial>
          </font></td>
        </tr>
      </table>`;
    const items = parseHtmUniqueItems(html, 'weapons');
    expect(items).toHaveLength(2);
    expect(items[0].notes).toBe('Blessed Edge Variant');
    expect(items[1].notes).toBe('');
  });

  it('should still parse the legacy 3-column layout with empty notes', () => {
    const html = `
      <table>
        <tr><td colspan="3" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td></tr>
        <tr><td><b>Legacy Item<br>Base (code)</b></td><td>Item Level: 10<br>Required Level: 5</td><td>+1 to All Skills</td></tr>
      </table>`;
    const items = parseHtmUniqueItems(html, 'weapons');
    expect(items).toHaveLength(1);
    expect(items[0].notes).toBe('');
  });

  it('should default levels to 0 for non-numeric values', () => {
    const html = `
      <table>
        <tr><td colspan="3" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td></tr>
        <tr><td><b>Test Item<br>Base (abc)</b></td><td>Item Level: N/A<br>Required Level: ???</td><td>+1 to All Skills</td></tr>
      </table>`;
    const items = parseHtmUniqueItems(html, 'other');
    expect(items).toHaveLength(1);
    expect(items[0].itemLevel).toBe(0);
    expect(items[0].reqLevel).toBe(0);
  });
});
