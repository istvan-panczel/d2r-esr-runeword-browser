import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { HtmUniqueItem } from '@/core/db';
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

  it('keeps the weapon mastery as a property line since ESR 3.3 (the Notes cell is empty for it)', () => {
    // ESR 3.3 prints "Weapon Mastery (Blessed Edge Variant)" in the properties; 3.2 had "Weapon Mastery Applied"
    // there and "Blessed Edge Variant" in the Notes cell
    const item = weapons.find((w) => w.name === "Koth's Cudgel");
    expect(item?.properties[0]).toBe('Weapon Mastery (Blessed Edge Variant)');
    expect(item?.notes).toBe('');
  });

  it('names the mastery of every mastery unique in its property line (18 in ESR 3.3.03)', () => {
    const masteryLines = weapons.flatMap((item) => item.properties.filter((line) => /^Weapon Mastery \(.+\)$/.test(line)));
    expect(masteryLines).toHaveLength(18);
    expect(masteryLines).toContain('Weapon Mastery (Sorceress Orb: Tripled Cooldowns)');
    expect(weapons.some((item) => item.properties.includes('Weapon Mastery Applied'))).toBe(false);
  });

  it('still reads other notes (Notes column kept in ESR 3.3)', () => {
    expect(withNotes.length / allItems.length).toBeLessThan(0.1);
    expect(withNotes.length).toBeGreaterThan(0);
    expect(withNotes.every((item) => item.page === 'other')).toBe(true);
  });

  it('reads the ESR 3.2 "... Variant" notes from the 3.2.24 pages', () => {
    const previousWeapons = parseHtmUniqueItems(
      readFileSync(resolve(__dirname, '../../../../test-fixtures/layout-3.2.24/unique_weapons.htm'), 'utf-8'),
      'weapons'
    );
    const item = previousWeapons.find((w) => w.name === 'Barbaric Devastator');
    expect(item?.notes).toBe('Blessed Edge Variant');
    expect(item?.properties).toContain('Weapon Mastery Applied');
    expect(previousWeapons.filter((w) => w.notes.endsWith('Variant'))).toHaveLength(15);
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

  it('should parse Wilting Petal (Warlock ring, added in ESR 3.2)', () => {
    const item = others.find((o) => o.name === 'Wilting Petal');
    expect(item).toBeDefined();
    expect(item!.category).toBe('War Ring');
    expect(item!.baseItem).toBe("Warlock's Sigil");
    expect(item!.baseItemCode).toBe('wrn');
    expect(item!.gambleItem).toBe("Warlock's Sigil");
    expect(item!.properties).toContain('+1 to Warlock Skills');
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

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: Hard-wrapped properties
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hard-wrapped properties', () => {
  const findIn = (list: readonly HtmUniqueItem[], name: string): HtmUniqueItem => {
    const item = list.find((i) => i.name === name);
    if (!item) throw new Error(`${name} not found in fixture`);
    return item;
  };

  it('Death Cleaver: a 3-line orange property becomes one entry', () => {
    expect(findIn(weapons, 'Death Cleaver').properties).toContain(
      // ESR 3.3 added "for 2 seconds"
      'On melee attack, gain 150% base attack speed. Every attack lowers your base attack speed by 10% and increases your total physical attack damage by 2% for 2 seconds. Maximum stacks: 25'
    );
  });

  it("Nord's Tenderizer: wrapped sentence is joined, the following statement stays separate", () => {
    const props = findIn(weapons, "Nord's Tenderizer").properties;
    expect(props).toContain(
      'You have a 35% chance to release icy bolts on melee attack that seek enemies, dealing 25% weapon damage as cold and return to you'
    );
    expect(props).toContain("Reduce enemies' cold resist by 0.5% on striking, up to 50%");
  });

  it("Kaija's Gown: line ending with a comma is continued", () => {
    expect(findIn(armors, "Kaija's Gown").properties).toContain(
      'While casting or channeling, you have 50% dodge, physical and magic resist and 500% mana regeneration bonus'
    );
  });

  it('no property should start with a lowercase letter (missed wrap), except known upstream data errors', () => {
    // Upstream lists these lines in reversed order (ESR 3.2), and "descfunc23 ..." is an
    // unrendered placeholder in the source page — left as they are, not fixed in-app
    const upstreamErrors = new Set([
      "Artemis' Wrath: but lose 50% while not running",
      'Fangs of the King Cobra: to gain 500% poison spell damage',
      'Boots of Aether: descfunc23 descval 2 not implemented',
      'Wraithstep: descfunc23 descval 2 not implemented',
    ]);
    for (const item of [...weapons, ...armors, ...others]) {
      for (const prop of item.properties) {
        if (upstreamErrors.has(`${item.name}: ${prop}`)) continue;
        expect(prop, `${item.name}: "${prop}"`).not.toMatch(/^[a-z]/);
      }
    }
  });

  it("Artemis' Wrath: the docs hard-wrap after 'while', so the two lines are re-joined (the game string is still reversed)", () => {
    const props = findIn(weapons, "Artemis' Wrath").properties;
    expect(props.slice(0, 2)).toEqual([
      'Gain 75% total physical attack damage while running, but lose 50% while not running',
      '+(200 to 300)% Enhanced Damage',
    ]);
  });

  it('synthetic: joins wrapped lines without crossing the orange boundary', () => {
    const html = `
      <table>
        <tr><td colspan="4" bgcolor="#402040"><b>TestCategory</b></td></tr>
        <tr><td>Name</td><td>Stats</td><td>Properties</td><td>Notes</td></tr>
        <tr>
          <td><b>Test Item<br>Base (tst)</b></td>
          <td>Item Level: 1<br>Required Level: 1</td>
          <td><font color=4850B8><FONT COLOR="ORANGE">Gain 1% damage for<br>every kill</FONT><br>enhanced stats<br>+1 to Life</font></td>
          <td></td>
        </tr>
      </table>`;
    const [item] = parseHtmUniqueItems(html, 'weapons');
    expect(item.properties).toEqual(['Gain 1% damage for every kill', 'enhanced stats', '+1 to Life']);
  });
});
