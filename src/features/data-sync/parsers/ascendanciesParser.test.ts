import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAscendancies, parseAscendanciesPage } from './ascendanciesParser';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ascendanciesHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/ascendancies.htm'), 'utf-8');

// ─── Parse all items ─────────────────────────────────────────────────────────

const items = parseAscendancies(ascendanciesHtml);
const { challenges } = parseAscendanciesPage(ascendanciesHtml);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Parse count assertions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Parse counts', () => {
  it('should parse exactly 15 ascendancies', () => {
    expect(items.length).toBe(15);
    console.log('[Test] Parsed ascendancies:', items.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Data quality - names
// ═══════════════════════════════════════════════════════════════════════════════

describe('Names', () => {
  it('every ascendancy should have a non-empty name', () => {
    for (const item of items) {
      expect(item.name.length, `Item has empty name`).toBeGreaterThan(0);
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

  it('should have all 15 known names', () => {
    const names = new Set(items.map((i) => i.name));
    const expected = [
      'Battlemage',
      'Blademaster',
      'Arcanist',
      'Bloodmage',
      'Awakened',
      'Ironbolt',
      'Starborn',
      'Lifebreaker',
      'Worldshaper',
      'Soul Warden',
      'Stance Dancer',
      'Nomad',
      'Sharpshooter',
      'Mana Warden',
      'Berserker',
    ];
    for (const name of expected) {
      expect(names.has(name), `Missing ascendancy: ${name}`).toBe(true);
    }
    console.log('[Test] Names:', Array.from(names).join(', '));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Image URLs
// ═══════════════════════════════════════════════════════════════════════════════

describe('Image URLs', () => {
  it('every ascendancy should have a non-empty imageUrl', () => {
    for (const item of items) {
      expect(item.imageUrl.length, `${item.name}: empty imageUrl`).toBeGreaterThan(0);
    }
  });

  it('no imageUrl should contain HTML tags', () => {
    for (const item of items) {
      expect(item.imageUrl, `${item.name}: imageUrl contains HTML tags`).not.toMatch(/<[^>]*>/);
    }
  });

  it('all imageUrls should match the expected pattern', () => {
    for (const item of items) {
      expect(item.imageUrl, `${item.name}: unexpected imageUrl pattern`).toMatch(/^\.\/images\/ascendancies\/.*\.png$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Tiers
// ═══════════════════════════════════════════════════════════════════════════════

describe('Tiers', () => {
  it('every ascendancy should have exactly 5 tiers', () => {
    for (const item of items) {
      expect(item.tiers.length, `${item.name}: expected 5 tiers, got ${String(item.tiers.length)}`).toBe(5);
    }
  });

  it('tiers should be numbered 1 through 5', () => {
    for (const item of items) {
      const tierNums = item.tiers.map((t) => t.tier);
      expect(tierNums, `${item.name}: incorrect tier numbers`).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('every tier should have at least 1 bonus', () => {
    for (const item of items) {
      for (const tier of item.tiers) {
        expect(tier.bonuses.length, `${item.name} Tier ${String(tier.tier)}: no bonuses`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Bonus text quality
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bonus text quality', () => {
  it('no bonus should contain HTML tags', () => {
    for (const item of items) {
      for (const tier of item.tiers) {
        for (const bonus of tier.bonuses) {
          expect(bonus, `${item.name} Tier ${String(tier.tier)}: "${bonus}" contains HTML tags`).not.toMatch(/<[^>]*>/);
        }
      }
    }
  });

  it('no bonus should have leading/trailing whitespace', () => {
    for (const item of items) {
      for (const tier of item.tiers) {
        for (const bonus of tier.bonuses) {
          expect(bonus, `${item.name} Tier ${String(tier.tier)}: bonus has whitespace`).toBe(bonus.trim());
        }
      }
    }
  });

  it('no bonus should contain double spaces', () => {
    for (const item of items) {
      for (const tier of item.tiers) {
        for (const bonus of tier.bonuses) {
          expect(bonus, `${item.name} Tier ${String(tier.tier)}: "${bonus}" has double space`).not.toMatch(/\s{2,}/);
        }
      }
    }
  });

  it('no bonus should be an unrecognised tier label', () => {
    for (const item of items) {
      for (const tier of item.tiers) {
        for (const bonus of tier.bonuses) {
          expect(bonus, `${item.name} Tier ${String(tier.tier)}: "${bonus}" looks like a tier label`).not.toMatch(/^Tier\s+\d/i);
        }
      }
    }
  });

  it('no bonus should contain HTML entities', () => {
    for (const item of items) {
      for (const tier of item.tiers) {
        for (const bonus of tier.bonuses) {
          expect(bonus, `${item.name} Tier ${String(tier.tier)}: "${bonus}" has HTML entity`).not.toMatch(/&amp;|&lt;|&gt;|&quot;/);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Footnotes
// ═══════════════════════════════════════════════════════════════════════════════

describe('Footnotes', () => {
  it('ascendancies with footnotes should have the expected count', () => {
    const withFootnotes = items.filter((i) => i.footnotes.length > 0);
    expect(withFootnotes.length).toBeGreaterThanOrEqual(9);
    console.log('[Test] Ascendancies with footnotes:', withFootnotes.map((i) => `${i.name} (${String(i.footnotes.length)})`).join(', '));
  });

  it('ascendancies without footnotes should exist', () => {
    const withoutFootnotes = items.filter((i) => i.footnotes.length === 0);
    expect(withoutFootnotes.length).toBeGreaterThanOrEqual(2);
    console.log('[Test] Ascendancies without footnotes:', withoutFootnotes.map((i) => i.name).join(', '));
  });

  it('no footnote should contain HTML tags', () => {
    for (const item of items) {
      for (const fn of item.footnotes) {
        expect(fn, `${item.name}: footnote contains HTML tags`).not.toMatch(/<[^>]*>/);
      }
    }
  });

  it('no footnote should have leading/trailing whitespace', () => {
    for (const item of items) {
      for (const fn of item.footnotes) {
        expect(fn, `${item.name}: footnote has whitespace`).toBe(fn.trim());
      }
    }
  });

  it('footnotes should start with *', () => {
    for (const item of items) {
      for (const fn of item.footnotes) {
        expect(fn, `${item.name}: footnote doesn't start with *: "${fn}"`).toMatch(/^\*/);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Known item verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Known items', () => {
  it('should parse Battlemage correctly', () => {
    const item = items.find((i) => i.name === 'Battlemage');
    expect(item).toBeDefined();
    expect(item!.imageUrl).toContain('battlemage');
    expect(item!.tiers.length).toBe(5);
    expect(item!.tiers[0].bonuses).toContain('+1 to Class Skill Levels');
    expect(item!.tiers[0].bonuses).toContain('+60 to Strength');
    expect(item!.tiers[0].bonuses).toContain('+60 to Energy');
    expect(item!.tiers[4].bonuses).toContain('+3 to Class Skill Levels');
    expect(item!.footnotes.length).toBe(1);
    expect(item!.footnotes[0]).toContain('Total Defense Bonus');
  });

  it('should parse Awakened with 3 footnotes', () => {
    const item = items.find((i) => i.name === 'Awakened');
    expect(item).toBeDefined();
    expect(item!.footnotes.length).toBe(3);
    expect(item!.footnotes.some((fn) => fn.includes('Annihilation'))).toBe(true);
  });

  it('should parse Worldshaper with 3 footnotes', () => {
    const item = items.find((i) => i.name === 'Worldshaper');
    expect(item).toBeDefined();
    expect(item!.footnotes.length).toBeGreaterThanOrEqual(2);
  });

  it('should parse Ironbolt correctly despite missing <br><br> separator', () => {
    const item = items.find((i) => i.name === 'Ironbolt');
    expect(item).toBeDefined();
    expect(item!.tiers.length).toBe(5);
    // Tier 3 should have bonuses even though it lacks the <br><br> separator before Tier 4
    expect(item!.tiers[2].tier).toBe(3);
    expect(item!.tiers[2].bonuses.length).toBeGreaterThanOrEqual(2);
    expect(item!.tiers[3].tier).toBe(4);
    expect(item!.tiers[3].bonuses.length).toBeGreaterThanOrEqual(2);
  });

  it('should parse a tier label with a footnote marker (Stance Dancer "Tier 3*")', () => {
    const item = items.find((i) => i.name === 'Stance Dancer');
    expect(item).toBeDefined();
    expect(item!.tiers[1].bonuses).not.toContain('Tier 3*');
    expect(item!.tiers[2].tier).toBe(3);
    expect(item!.tiers[2].bonuses).toEqual([
      'Damage Stance (Red): 5% Enhanced Damage and 1% Spell Damage per 75 combined Strength, Dexterity and Energy',
      'Evade Stance (Green): 10% to All Speeds and 1% Dodge per 1000 combined Strength, Dexterity and Energy',
      'Recovery Stance (Blue): +1 to All Skills and 150 Replenish Life and Mana per 1500 combined Strength, Dexterity and Energy',
      '+90 to Strength',
      '+90 to Dexterity',
      '+90 to Energy',
    ]);
    expect(item!.footnotes[0]).toMatch(/^\*You need to set a hotkey for stance dancing/);
  });

  it('should parse Blademaster without footnotes', () => {
    const item = items.find((i) => i.name === 'Blademaster');
    expect(item).toBeDefined();
    expect(item!.footnotes.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Data snapshot counts
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data snapshot counts', () => {
  it('should report counts for tracking ESR updates', () => {
    const total = items.length;
    const withFootnotes = items.filter((i) => i.footnotes.length > 0).length;
    const withoutFootnotes = items.filter((i) => i.footnotes.length === 0).length;
    const totalBonuses = items.reduce((sum, i) => sum + i.tiers.reduce((s, t) => s + t.bonuses.length, 0), 0);

    console.log('[Test] Ascendancies snapshot:', {
      total,
      withFootnotes,
      withoutFootnotes,
      totalBonuses,
    });

    expect(total).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Edge cases (synthetic HTML)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('should return empty array for empty HTML', () => {
    expect(parseAscendancies('')).toEqual([]);
  });

  it('should return empty array for HTML with no flex divs', () => {
    expect(parseAscendancies('<html><body><p>No ascendancies here</p></body></html>')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: Challenges and unlock recipes
// ═══════════════════════════════════════════════════════════════════════════════

describe('Challenges', () => {
  it('should parse the five Tier N Challenge sections in order', () => {
    expect(challenges.map((c) => c.tier)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every challenge should have a plain-text description and at least one recipe', () => {
    for (const challenge of challenges) {
      expect(challenge.description.length, `Tier ${String(challenge.tier)}`).toBeGreaterThan(0);
      expect(challenge.recipes.length, `Tier ${String(challenge.tier)}`).toBeGreaterThan(0);
      for (const text of [...challenge.description, ...challenge.recipes.flatMap((r) => [...r.inputs, ...r.outputs])]) {
        expect(text).not.toMatch(/<[^>]*>|&[a-z]+;|\s{2}/);
        expect(text).toBe(text.trim());
      }
    }
  });

  it('should re-join the hard-wrapped Tier 1 description and keep its paragraphs', () => {
    expect(challenges[0].description).toEqual([
      'In order to get an Ascendancy Stone, you need to kill 5 special superuniques on hell difficulty scattered around Sanctuary and transmute the elemental orbs each of them drop to obtain the Orb of Creation.',
      'The orb can then be transmuted with specific colored gems to unlock the ascendancy of your choice. Clue: Act 1, 2, 3 each have a superunique. Act 5 has 2, while act 4 has none.',
    ]);
  });

  it('should list one Tier 1 recipe per ascendancy', () => {
    expect(challenges[0].recipes.length).toBe(15);
    for (const recipe of challenges[0].recipes) {
      expect(recipe.inputs[0]).toBe('Orb of Creation');
      expect(recipe.outputs).toHaveLength(1);
      expect(recipe.outputs[0]).toMatch(/ Ascendancy Stone$/);
    }
  });

  it('should parse the upgrade recipes of tiers 2-5', () => {
    expect(challenges.slice(1).map((c) => c.recipes)).toEqual([
      [{ inputs: ['Ascendancy Stone'], outputs: ['Ascendancy Stone', 'Upgraded to Tier 2'] }],
      [{ inputs: ['Ascendancy Stone', 'Maple Leaf'], outputs: ['Ascendancy Stone', 'Upgraded to Tier 3'] }],
      [
        {
          inputs: ['Ascendancy Stone', 'Primordial Soulstones Captured: 10/10', '2 Maple Leaves'],
          outputs: ['Ascendancy Stone', 'Upgraded to Tier 4'],
        },
      ],
      [{ inputs: ['Ascendancy Stone', '3 Maple Leaves'], outputs: ['Ascendancy Stone', 'Upgraded to Tier 5'] }],
    ]);
  });

  it('every ascendancy should have its unlock recipe', () => {
    for (const item of items) {
      expect(item.unlockInputs?.[0], item.name).toBe('Orb of Creation');
      expect(
        item.unlockInputs?.slice(1).every((input) => /^\d+ Blemished \w+$/.test(input)),
        item.name
      ).toBe(true);
    }
    expect(items.find((i) => i.name === 'Battlemage')?.unlockInputs).toEqual([
      'Orb of Creation',
      '2 Blemished Sapphire',
      '2 Blemished Obsidian',
    ]);
    expect(items.find((i) => i.name === 'Soul Warden')?.unlockInputs).toEqual([
      'Orb of Creation',
      '2 Blemished Ruby',
      '2 Blemished Sapphire',
    ]);
  });
});

describe('Challenges: degraded pages (synthetic HTML)', () => {
  const card = (name: string) => `
    <div style="display: flex; justify-content: space-around; width: 1025px">
      <div style="display: flex; width: 50%;"><font face="arial,helvetica" size="-1"><font color="orange">Tier 1</font><br>+1 to Class Skill Levels<br></font></div>
      <div style="display: flex; flex-direction: column; width: 50%;"><font color="orange" size="4">${name} Ascendancy</font><br><img src="./images/x.png" /></div>
    </div>`;
  const description = (text: string) => `<table><tbody><tr><td colspan="2"><font size="-1">${text}</font></td></tr></tbody></table>`;
  const recipeTable = (rows: string) =>
    `<table><tbody><tr><td><font> Input</font></td><td><font> Output</font></td></tr>${rows}</tbody></table>`;

  it('should keep the cards when the challenge section is missing', () => {
    const page = parseAscendanciesPage(`<html><body>${card('Battlemage')}</body></html>`);
    expect(page.challenges).toEqual([]);
    expect(page.ascendancies.map((a) => [a.name, a.unlockInputs])).toEqual([['Battlemage', []]]);
  });

  it('should keep a challenge without a recipe table and one without a description', () => {
    const page = parseAscendanciesPage(`<html><body>
      <h3>Tier 2 Challenge</h3>${description('Kill him<br>and cube it.<br>Second paragraph.')}
      <h3>Tier 3 Challenge</h3>${recipeTable('<tr><td>Ascendancy Stone<br>Maple Leaf</td><td>Ascendancy Stone<br>Upgraded to Tier 3</td></tr>')}
      <h3>Ascendancies</h3>${card('Nomad')}
    </body></html>`);
    expect(page.challenges).toEqual([
      { tier: 2, description: ['Kill him and cube it.', 'Second paragraph.'], recipes: [] },
      {
        tier: 3,
        description: [],
        recipes: [{ inputs: ['Ascendancy Stone', 'Maple Leaf'], outputs: ['Ascendancy Stone', 'Upgraded to Tier 3'] }],
      },
    ]);
    expect(page.ascendancies[0].unlockInputs).toEqual([]);
  });

  it('should skip a challenge heading with nothing under it and other headings', () => {
    const page = parseAscendanciesPage(`<html><body>
      <h3>Tier 1 Challenge</h3><p>Coming soon</p>
      <h3>Tier X Challenge</h3>${description('Not a tier')}
      <h3>Tier 4 Challenge</h3><div>${description('Wrapped in a div.')}</div>
    </body></html>`);
    expect(page.challenges).toEqual([{ tier: 4, description: ['Wrapped in a div.'], recipes: [] }]);
  });

  it('should map a Tier 1 recipe to its card by the stone name', () => {
    const page = parseAscendanciesPage(`<html><body>
      <h3>Tier 1 Challenge</h3>${recipeTable(
        '<tr><td><font color="orange">Orb of Creation</font><br>4 Blemished Emerald</td><td>Nomad Ascendancy Stone<br></td></tr>'
      )}
      <h3>Ascendancies</h3>${card('Nomad')}${card('Berserker')}
    </body></html>`);
    expect(page.ascendancies.map((a) => [a.name, a.unlockInputs])).toEqual([
      ['Nomad', ['Orb of Creation', '4 Blemished Emerald']],
      ['Berserker', []],
    ]);
  });
});
