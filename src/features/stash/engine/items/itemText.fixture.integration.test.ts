/**
 * The item text of the owner's real stash against the committed itemtext.json: every page item renders without an
 * unknown stat or an unresolved string, the uniques' lines have the shape of the ESR docs pages (unique_*.htm, numbers
 * masked), the runeword lines that of runewords.json, and the render time of the whole stash is logged. Skipped
 * without the fixture (test-fixtures/stash/, gitignored) or the docs fixtures (`npm run test:fixtures`).
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { expect, it } from 'vitest';
import type { HtmUniqueItemPage } from '@/core/db';
import { parseHtmUniqueItems } from '@/features/data-sync/parsers/htmUniqueItemsParser';
import type { ItemTextBundle, SetsBundle, TxtRunewordsBundle } from '@/features/game-data/engine/schema';
import { describeWithFixture } from '../../testing/stashFixture.mock';
import { stashCatalog } from '../catalog';
import { walkStashItems } from '../walk';
import { createItemTextContext, renderItemText, statValues, type ItemTextGroups } from './itemText';

const ROOT = resolve(__dirname, '../../../../..');
const ITEM_TEXT = resolve(ROOT, 'public/game-data/itemtext.json');
const RUNEWORDS = resolve(ROOT, 'public/game-data/runewords.json');
const SETS = resolve(ROOT, 'public/game-data/sets.json');
const UNIQUE_PAGES: [string, HtmUniqueItemPage][] = [
  ['unique_weapons.htm', 'weapons'],
  ['unique_armors.htm', 'armors'],
  ['unique_others.htm', 'other'],
];
const hasDocs = UNIQUE_PAGES.every(([file]) => existsSync(resolve(ROOT, 'test-fixtures', file)));

/** Lowercase, numbers and ranges as `#`, dashes / whitespace normalised: the shape of a line */
export function shapeOf(line: string): string {
  return (
    line
      .replace(/ÿc./g, '')
      .replace(/[‐‑‒–—−]/g, '-')
      .replace(/[‘’‛`´′]/g, "'")
      .toLowerCase()
      // ESR 3.3's docs pages print the bleed string's "%.2f" unformatted (the item text writes "2.00")
      .replace(/%\.2f/g, '#')
      .replace(/\(\s*[-+]?\d+(\.\d+)?\s*to\s*[-+]?\d+(\.\d+)?\s*\)/g, '#')
      .replace(/\d+(\.\d+)?/g, '#')
      .replace(/#\s*(to|-)\s*[-+]?#/g, '#')
      .replace(/[-+]#/g, '#')
      // the generator appends the cold duration (docs style, runewords.json); the tooltip has none
      .replace(/cold damage to attacks over # seconds/, 'cold damage to attacks')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.$/, '')
  );
}

function allLines(groups: ItemTextGroups): string[] {
  return [
    ...groups.base,
    ...groups.stats,
    ...groups.runeword,
    ...groups.setBonuses.flatMap((bonus) => bonus.lines),
    ...groups.socketed.flatMap((entry) => entry.lines),
  ];
}

/** The share of `lines` whose shape is among `reference` (as a multiset), and the lines that are not */
function shapeMatch(lines: readonly string[], reference: readonly string[]): { matched: number; missing: string[] } {
  const pool = new Map<string, number>();
  for (const line of reference) pool.set(shapeOf(line), (pool.get(shapeOf(line)) ?? 0) + 1);
  let matched = 0;
  const missing: string[] = [];
  const take = (line: string) => {
    const shape = shapeOf(line);
    const left = pool.get(shape) ?? 0;
    if (left > 0) pool.set(shape, left - 1);
    return left > 0;
  };
  for (let i = 0; i < lines.length; i++) {
    // a multi-line description ("\n" in the string) is one line on the docs pages
    const joined = [1, 2, 3, 4].find((count) => i + count <= lines.length && take(lines.slice(i, i + count).join(' ')));
    if (joined === undefined) missing.push(lines[i] ?? '');
    else {
      matched += joined;
      i += joined - 1;
    }
  }
  return { matched, missing };
}

/** Mismatch categories for the log: the line's shape with the item-specific words kept */
function topShapes(lines: readonly string[], count: number): string {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(shapeOf(line), (counts.get(shapeOf(line)) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([shape, n]) => `  ${String(n)} × ${shape}`)
    .join('\n');
}

describeWithFixture('item text of the stash fixture', (fixture) => {
  const load = () => {
    const { stash, bundle } = fixture();
    const text = JSON.parse(readFileSync(ITEM_TEXT, 'utf-8')) as ItemTextBundle;
    const catalog = stashCatalog(bundle);
    return { stash, catalog, ctx: createItemTextContext(text, catalog), text };
  };

  it('renders every page item and its sockets without unknown stats or unresolved strings, and logs the time', () => {
    const { stash, ctx, text } = load();
    const items = walkStashItems(stash, { socketed: false }).map(({ item }) => item);
    const start = performance.now();
    const rendered = items.map((item) => ({ item, groups: renderItemText(item, ctx), values: statValues(item, ctx) }));
    const ms = performance.now() - start;
    const lines = rendered.flatMap(({ groups }) => allLines(groups));
    const values = rendered.reduce((sum, { values: entries }) => sum + entries.length, 0);
    console.log(
      `Item text: ${String(items.length)} page items, ${String(lines.length)} lines, ${String(values)} stat values in ${ms.toFixed(0)} ms`
    );
    const missingKeys = new Set(
      text.stats.flatMap((def) =>
        def === null ? [] : [def.descstrpos, def.descstrneg, def.descstr2].filter((key) => key !== undefined && !(key in text.strings))
      )
    );
    const bad = lines.filter((line) => line.startsWith('Unknown stat') || /%[+]?[dis0-9]/.test(line) || missingKeys.has(line));
    expect(bad).toEqual([]);
    for (const { values: entries } of rendered) {
      const keys = entries.map((entry) => entry.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const entry of entries) {
        expect(entry.key).toMatch(/^[A-Za-z0-9.-]+$/);
        expect(entry.label, entry.key).not.toMatch(/\d{3,}/);
        expect(entry.label.split('#').length - 1, entry.key).toBeLessThanOrEqual(entry.range === undefined ? 1 : 2);
        expect(Number.isFinite(entry.value), entry.key).toBe(true);
      }
    }
    expect(ms).toBeLessThan(5000);
  });

  it.skipIf(!hasDocs)('writes the owned uniques like the docs pages (numbers masked)', () => {
    const { stash, catalog, ctx } = load();
    const docs = UNIQUE_PAGES.flatMap(([file, page]) =>
      parseHtmUniqueItems(readFileSync(resolve(ROOT, 'test-fixtures', file), 'utf-8'), page)
    );
    const byName = new Map<string, (typeof docs)[number][]>();
    for (const entry of docs) byName.set(entry.name.toLowerCase(), [...(byName.get(entry.name.toLowerCase()) ?? []), entry]);

    let total = 0;
    let matched = 0;
    let unmatchedItems = 0;
    const mismatches: string[] = [];
    for (const { item } of walkStashItems(stash, { socketed: true })) {
      if (item.quality !== 'unique' || item.uniqueId === null) continue;
      const unique = catalog.unique(item.uniqueId);
      const candidates = unique === undefined ? [] : (byName.get(unique.name.toLowerCase()) ?? []);
      if (candidates.length === 0) {
        unmatchedItems++;
        continue;
      }
      const lines = renderItemText(item, ctx).stats;
      // same-name uniques on other bases: the docs entry of the item's base, else the closest one
      const best = candidates
        .map((entry) => ({ entry, result: shapeMatch(lines, entry.properties) }))
        .sort(
          (a, b) =>
            Number(b.entry.baseItemCode === item.code) - Number(a.entry.baseItemCode === item.code) || b.result.matched - a.result.matched
        )[0];
      if (best === undefined) continue;
      total += lines.length;
      matched += best.result.matched;
      mismatches.push(...best.result.missing.map((line) => `${unique?.name ?? ''}: ${line}`));
    }
    const share = (matched / Math.max(1, total)) * 100;
    console.log(
      `Item text vs unique docs: ${String(matched)} of ${String(total)} lines (${share.toFixed(1)} %), ${String(unmatchedItems)} uniques not on the docs pages\n` +
        `Top mismatches:\n${topShapes(
          mismatches.map((line) => line.slice(line.indexOf(': ') + 2)),
          25
        )}\n` +
        `Examples:\n${mismatches
          .slice(0, 40)
          .map((line) => `  ${line}`)
          .join('\n')}`
    );
    expect(total).toBeGreaterThan(1000);
    expect(share).toBeGreaterThanOrEqual(95);
  });

  it.skipIf(!existsSync(RUNEWORDS))('writes the runeword lines like runewords.json (numbers masked)', () => {
    const { stash, catalog, ctx } = load();
    const txt = JSON.parse(readFileSync(RUNEWORDS, 'utf-8')) as TxtRunewordsBundle;
    const byKey = new Map(txt.runewords.map((runeword) => [runeword.key, runeword]));
    let total = 0;
    let matched = 0;
    const mismatches: string[] = [];
    for (const { item } of walkStashItems(stash, { socketed: true })) {
      if (item.runewordId === null) continue;
      const runeword = byKey.get(catalog.runeword(item.runewordId)?.key ?? '');
      if (runeword === undefined) continue;
      const lines = renderItemText(item, ctx).runeword;
      const best = runeword.rows.map((row) => shapeMatch(lines, row.text)).sort((a, b) => b.matched - a.matched)[0];
      if (best === undefined) continue;
      total += lines.length;
      matched += best.matched;
      mismatches.push(...best.missing.map((line) => `${runeword.name}: ${line}`));
    }
    const share = (matched / Math.max(1, total)) * 100;
    console.log(
      `Item text vs runewords.json: ${String(matched)} of ${String(total)} lines (${share.toFixed(1)} %)\n${mismatches.map((line) => `  ${line}`).join('\n')}`
    );
    expect(total).toBeGreaterThan(5);
    expect(share).toBeGreaterThanOrEqual(95);
  });

  it.skipIf(!existsSync(SETS))('writes the set items and their bonus lists like sets.json (numbers masked)', () => {
    const { stash, catalog, ctx } = load();
    const { sets } = JSON.parse(readFileSync(SETS, 'utf-8')) as SetsBundle;
    const byName = new Map(sets.flatMap((set) => set.items.map((entry) => [`${set.id}|${entry.name}`, entry] as const)));
    const counts = { own: [0, 0], bonus: [0, 0], pieces: [0, 0] };
    const mismatches: string[] = [];
    for (const { item } of walkStashItems(stash, { socketed: true })) {
      const setItem = item.setId === null ? undefined : catalog.setItem(item.setId);
      const reference = setItem === undefined ? undefined : byName.get(`${setItem.set}|${setItem.name}`);
      if (setItem === undefined || reference === undefined) continue;
      const groups = renderItemText(item, ctx);
      const own = shapeMatch(groups.stats, reference.lines);
      counts.own[0] += own.matched;
      counts.own[1] += groups.stats.length;
      mismatches.push(...own.missing.map((line) => `${setItem.name}: ${line}`));
      for (const bonus of groups.setBonuses) {
        const partial = reference.partial.find((group) => group.pieces === bonus.pieces);
        counts.pieces[0] += partial === undefined ? 0 : 1;
        counts.pieces[1]++;
        const result = shapeMatch(bonus.lines, partial?.lines ?? []);
        counts.bonus[0] += result.matched;
        counts.bonus[1] += bonus.lines.length;
        mismatches.push(...result.missing.map((line) => `${setItem.name} (${String(bonus.pieces)} items): ${line}`));
      }
    }
    const share = ([matched, total]: number[]) => ((matched ?? 0) / Math.max(1, total ?? 0)) * 100;
    console.log(
      `Item text vs sets.json: own lines ${share(counts.own).toFixed(1)} % of ${String(counts.own[1])}, bonus lines ` +
        `${share(counts.bonus).toFixed(1)} % of ${String(counts.bonus[1])}, bonus lists with a sets.json group of the same pieces ` +
        `${share(counts.pieces).toFixed(1)} % of ${String(counts.pieces[1])}\nTop mismatches:\n${topShapes(
          mismatches.map((line) => line.slice(line.indexOf(': ') + 2)),
          15
        )}`
    );
    expect(counts.own[1]).toBeGreaterThan(500);
    expect(share(counts.own)).toBeGreaterThanOrEqual(95);
    expect(share(counts.bonus)).toBeGreaterThanOrEqual(95);
    expect(share(counts.pieces)).toBe(100);
  });

  it.skipIf(!hasDocs)("gives the uniques the docs pages' required level, and socket fillers their gems.txt column", () => {
    const { stash, catalog, ctx } = load();
    const docs = UNIQUE_PAGES.flatMap(([file, page]) =>
      parseHtmUniqueItems(readFileSync(resolve(ROOT, 'test-fixtures', file), 'utf-8'), page)
    );
    let total = 0;
    let matched = 0;
    const mismatches: string[] = [];
    for (const { item } of walkStashItems(stash, { socketed: true })) {
      if (item.quality !== 'unique' || item.uniqueId === null) continue;
      const name = catalog.unique(item.uniqueId)?.name ?? '';
      const entry = docs.find((doc) => doc.name === name && doc.baseItemCode === item.code) ?? docs.find((doc) => doc.name === name);
      if (entry === undefined) continue;
      const level = statValues(item, ctx).find((value) => value.key === 'b.reqlvl')?.value ?? 0;
      total++;
      if (level === entry.reqLevel) matched++;
      else
        mismatches.push(
          `${name} (${item.code}${item.socketed.length > 0 ? ', socketed' : ''}): ${String(level)} vs docs ${String(entry.reqLevel)}`
        );
    }
    const share = (matched / Math.max(1, total)) * 100;
    console.log(
      `Required level vs unique docs: ${String(matched)} of ${String(total)} (${share.toFixed(1)} %)\n${mismatches
        .slice(0, 30)
        .map((line) => `  ${line}`)
        .join('\n')}`
    );
    expect(share).toBeGreaterThanOrEqual(95);

    // gloves take the weapon column (ESR: "Weapons / Gloves"), a runeword's runes their own bonuses
    const rendered = walkStashItems(stash, { socketed: false }).map(({ item }) => ({ item, groups: renderItemText(item, ctx) }));
    const darkflight = rendered.find(({ item }) => item.uniqueId !== null && catalog.unique(item.uniqueId)?.name === 'Darkflight Hand');
    expect(darkflight?.groups.socketed.map((entry) => [entry.item.code, entry.lines])).toEqual([['r05', ['-25% Target Defense']]]);
    const cow = rendered.find(({ item }) => item.runewordId !== null && catalog.runeword(item.runewordId)?.name === 'Cow');
    expect(cow?.groups.socketed.flatMap((entry) => entry.lines)).toContain('+75% Damage to Undead');
    // every socket filler of the fixture has its gems.txt stats
    const fillers = rendered.flatMap(({ groups }) => groups.socketed.filter((entry) => entry.item.compact));
    expect(fillers.length).toBeGreaterThan(5);
    expect(fillers.filter((entry) => entry.lines.length === 0).map((entry) => entry.item.code)).toEqual([]);
  });
});
