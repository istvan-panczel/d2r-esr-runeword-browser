/**
 * The modifier templates against the real item lines: the HTM fixtures (npm run test:fixtures) parsed as the app parses
 * them, plus the game-data bundles' lines. Pins coverage (lower bounds), that prose lines stay plain text and the cost.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SetsBundle } from '@/features/game-data/engine/schema';
import { parseAscendancies } from '@/features/data-sync/parsers/ascendanciesParser';
import { parseHtmUniqueItems } from '@/features/data-sync/parsers/htmUniqueItemsParser';
import { parseMythicalUniques } from '@/features/data-sync/parsers/mythicalUniquesParser';
import { parseRunewordsHtml } from '@/features/data-sync/parsers/runewordsParser';
import { buildModifierRefIndex, findModifierRef, type ModifierRefsData } from './modifierRefs';

const root = resolve(__dirname, '../../../..');
const fixture = (name: string) => readFileSync(resolve(root, 'test-fixtures', name), 'utf-8');
const index = buildModifierRefIndex(
  JSON.parse(readFileSync(resolve(root, 'src/features/modifiers/data/modifierRefs.json'), 'utf-8')) as ModifierRefsData
);

const runewordLines = parseRunewordsHtml(fixture('runewords.htm')).flatMap((runeword) =>
  [...runeword.columnAffixes.weaponsGloves, ...runeword.columnAffixes.helmsBoots, ...runeword.columnAffixes.armorShieldsBelts].map(
    (affix) => affix.rawText
  )
);
const uniqueLines = (
  [
    ['unique_weapons.htm', 'weapons'],
    ['unique_armors.htm', 'armors'],
    ['unique_others.htm', 'other'],
  ] as const
).flatMap(([file, page]) => parseHtmUniqueItems(fixture(file), page).flatMap((item) => item.properties));
const mythicals = parseMythicalUniques(fixture('unique_mythicals.htm'));
const ascendancyLines = parseAscendancies(fixture('ascendancies.htm')).flatMap((ascendancy) =>
  ascendancy.tiers.flatMap((tier) => tier.bonuses)
);
const sets = JSON.parse(readFileSync(resolve(root, 'public/game-data/sets.json'), 'utf-8')) as SetsBundle;
const setLines = sets.sets.flatMap((set) => set.items.flatMap((item) => [...item.lines, ...item.partial.flatMap((part) => part.lines)]));

const linked = (lines: readonly string[]) => lines.filter((line) => findModifierRef(line, index) !== null).length;

describe('modifier lines on the item pages (ESR 3.2.24 fixtures)', () => {
  it('links the modifier lines of every surface', () => {
    // ESR 3.2.24: runewords 2000 / 3939, uniques 4848 / 9763, mythicals 208 / 415, ascendancies 110 / 226, sets 1030 / 2197
    expect(linked(runewordLines)).toBeGreaterThan(1900);
    expect(linked(uniqueLines)).toBeGreaterThan(4600);
    expect(linked(mythicals.flatMap((item) => item.properties))).toBeGreaterThan(190);
    expect(linked(ascendancyLines)).toBeGreaterThan(100);
    expect(linked(setLines)).toBeGreaterThan(950);
  });

  it('leaves prose plain: mythical special properties and sentences that name a modifier', () => {
    const special = mythicals.flatMap((item) => item.specialProperties);
    // One special property is a plain stat line ("+(1 to 2) to Non-Unique Summons Limit")
    expect(linked(special)).toBeLessThanOrEqual(1);
    const modifierWords =
      /deadly|crushing|leech|resist|faster|attack speed|magic items|gold|cooldown|absorb|block|dodge|damage reduced|frozen|freez|slow|knockback|pierc|curse|skill|spell damage|enhanced damage|attack rating|on striking/i;
    const sentence =
      /\b(you|your|gain|gains|for every|per|when|while|whenever|if|but|instead|up to|for each|stack|nearby|enemies)\b|\.\s|\.$/i;
    const prose = [...new Set([...runewordLines, ...uniqueLines, ...ascendancyLines, ...special])].filter(
      (line) => modifierWords.test(line) && sentence.test(line)
    );
    expect(prose.length).toBeGreaterThan(200);
    expect(prose.filter((line) => findModifierRef(line, index) !== null)).toEqual([]);
  });

  it('costs about a microsecond per line', () => {
    const lines = [...runewordLines, ...uniqueLines];
    const start = performance.now();
    for (let round = 0; round < 3; round++) for (const line of lines) findModifierRef(line, index);
    const perLine = (performance.now() - start) / (3 * lines.length);
    // ~0.9 µs measured (13.7k lines in ~12 ms); generous for slow CI machines
    expect(perLine).toBeLessThan(0.02);
  });
});
