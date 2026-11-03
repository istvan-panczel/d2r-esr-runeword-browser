/**
 * Walks every item of a real ESR Modern shared stash with the committed stash.json. Skipped without the save file:
 * copy ModernSharedStashSoftCoreV2.d2i (and optionally the legacy SharedStashSoftCoreV2.d2i) from
 * "Saved Games/Diablo II Resurrected/mods/Eastern_Sun_Resurrected" into test-fixtures/stash/ (gitignored, never
 * committed: it is a personal save).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parseTsv, type TsvTable } from '../../game-data/build/tsv.ts';
import type { StashBundle } from '../../game-data/engine/schema.ts';
import { UnsupportedStashError } from './errors.ts';
import { parseStash, SECTION_HEADER_BYTES } from './parseStash.ts';
import { createStashData } from './stashData.ts';
import type { StashItem } from './types.ts';

const FIXTURE_DIR = resolve(__dirname, '../../../../test-fixtures/stash');
const MODERN = resolve(FIXTURE_DIR, 'ModernSharedStashSoftCoreV2.d2i');
const LEGACY = resolve(FIXTURE_DIR, 'SharedStashSoftCoreV2.d2i');
const BUNDLE = resolve(__dirname, '../../../../public/game-data/stash.json');
const EXCEL = resolve(
  __dirname,
  '../../../../',
  process.env.ESR_SOURCE_DIR ?? '../Eastern_Sun_Resurrected',
  'Eastern_Sun_Resurrected.mpq/data/global/excel'
);

const readBytes = (path: string) => new Uint8Array(readFileSync(path));

describe.skipIf(!existsSync(MODERN) || !existsSync(BUNDLE))('ESR Modern shared stash fixture', () => {
  const bundle = JSON.parse(readFileSync(BUNDLE, 'utf-8')) as StashBundle;
  const bytes = readBytes(MODERN);
  const stash = parseStash(bytes, createStashData(bundle));
  const flat = (items: readonly StashItem[]): StashItem[] => items.flatMap((item) => [item, ...flat(item.socketed)]);

  it('parses every section, each item list matching its JM count and ending at the section end', () => {
    // parseStash throws on a list that does not end exactly at its section's end; the counts come from the headers
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (const section of stash.sections) {
      if (section.tabType === 'chronicle') continue;
      expect(section.items.length, `section ${String(section.index)}`).toBe(
        view.getUint16(section.offset + SECTION_HEADER_BYTES + 2, true)
      );
    }
    expect(stash.sections.reduce((sum, section) => sum + section.byteSize, 0)).toBe(bytes.length);
    const counts = { normal: 0, advanced: 0, chronicle: 0 };
    for (const section of stash.sections) counts[section.tabType]++;
    console.log(
      `Stash fixture: ${String(stash.sections.length)} sections ${JSON.stringify(counts)}, ` +
        `${String(flat(stash.sections.flatMap((section) => section.items)).length)} items incl. socketed`
    );
    expect(counts.chronicle).toBe(1);
    expect(counts.advanced).toBe(1);
  });

  it('places every page item inside the grid without overlaps', () => {
    for (const section of stash.sections.filter((entry) => entry.tabType === 'normal')) {
      const cells = new Map<string, string>();
      for (const item of section.items) {
        const where = `section ${String(section.index)} ${item.code} at ${String(item.x)},${String(item.y)}`;
        expect(item.width, where).not.toBeNull();
        const width = item.width ?? 1;
        const height = item.height ?? 1;
        expect(item.x + width, where).toBeLessThanOrEqual(bundle.grid.width);
        expect(item.y + height, where).toBeLessThanOrEqual(bundle.grid.height);
        for (let dx = 0; dx < width; dx++) {
          for (let dy = 0; dy < height; dy++) {
            const cell = `${String(item.x + dx)},${String(item.y + dy)}`;
            expect(cells.get(cell), `${where} overlaps`).toBeUndefined();
            cells.set(cell, item.code);
          }
        }
      }
    }
  });

  it('reads socketed items in socket mode and never more of them than sockets', () => {
    for (const item of flat(stash.sections.flatMap((section) => section.items))) {
      for (const child of item.socketed) expect(child.mode).toBe(6);
      expect(item.socketed.length).toBeLessThanOrEqual(item.sockets ?? 0);
    }
  });

  it('finds the Ancient Coupons', () => {
    const coupons = new Set(bundle.coupons.filter((coupon) => coupon.wildCard !== true).map((coupon) => coupon.code));
    const found = stash.sections.flatMap((section) => section.items).filter((item) => coupons.has(item.code));
    console.log(
      `Stash fixture: ${String(found.length)} Ancient Coupons on ${String(new Set(found.map((item) => item.section)).size)} pages`
    );
    expect(found.length).toBeGreaterThan(0);
    for (const item of found) expect([item.width, item.height]).toEqual([1, 1]);
  });
});

describe.skipIf(!existsSync(MODERN) || !existsSync(BUNDLE) || !existsSync(EXCEL))(
  'ESR Modern shared stash fixture vs the ESR tables',
  () => {
    const bundle = JSON.parse(readFileSync(BUNDLE, 'utf-8')) as StashBundle;
    const stash = parseStash(readBytes(MODERN), createStashData(bundle));
    const flat = (items: readonly StashItem[]): StashItem[] => items.flatMap((item) => [item, ...flat(item.socketed)]);
    const items = flat(stash.sections.flatMap((section) => section.items));
    const table = (name: string) => parseTsv(readFileSync(resolve(EXCEL, `${name}.txt`), 'utf-8'), name, { keepExpansionRows: true });
    const statIds = new Map(table('itemstatcost').rows.map((row, id) => [row.str('Stat'), id]));
    const propertyStats = new Map(
      table('properties').rows.map((row) => [
        row.str('code'),
        [1, 2, 3, 4, 5, 6, 7].flatMap((i) => statIds.get(row.str(`stat${String(i)}`)) ?? []),
      ])
    );
    /** The stat ids an affix row's mods write; [] when a mod's property picks its stats itself (damage funcs …) */
    const affixStats = (rows: TsvTable, id: number): number[] | null => {
      const row = rows.rows.at(id - 1);
      if (row === undefined) return null;
      return [1, 2, 3].flatMap((i) => propertyStats.get(row.str(`mod${String(i)}code`)) ?? []);
    };
    const prefixes = table('magicprefix');
    const suffixes = table('magicsuffix');

    it('reads magic and rare affix ids as 1-based magicprefix / magicsuffix rows that match the item stats', () => {
      let checked = 0;
      let matched = 0;
      for (const item of items.filter((entry) => entry.quality === 'magic' || entry.quality === 'rare')) {
        for (const [rows, ids] of [
          [prefixes, item.prefixIds],
          [suffixes, item.suffixIds],
        ] as const) {
          for (const id of ids.filter((entry) => entry !== 0)) {
            const stats = affixStats(rows, id);
            expect(stats, `${item.code} affix ${String(id)}`).not.toBeNull();
            if (stats === null || stats.length === 0) continue;
            checked++;
            if (stats.some((stat) => item.stats.some((own) => own.id === stat))) matched++;
          }
        }
      }
      console.log(`Stash fixture: ${String(matched)} of ${String(checked)} magic / rare affixes found in the item stats`);
      expect(checked).toBeGreaterThan(100);
      expect(matched / checked).toBeGreaterThan(0.95);
    });

    it('reads rare names as a prefix-block id then a suffix-block id, and auto affixes as automagic rows', () => {
      const rares = items.filter((item) => item.quality === 'rare');
      expect(rares.length).toBeGreaterThan(0);
      // The combined vanilla rare name table: 155 suffixes (1-155), then the prefixes (156 on)
      for (const item of rares) {
        const [first, second] = item.rareNameIds ?? [0, 0];
        expect(first, item.code).toBeGreaterThanOrEqual(156);
        expect(second, item.code).toBeGreaterThanOrEqual(1);
        expect(second, item.code).toBeLessThanOrEqual(155);
        expect(item.prefixIds).toHaveLength(3);
        expect(item.suffixIds).toHaveLength(3);
      }
      const automagic = table('automagic');
      for (const item of items.filter((entry) => entry.autoAffixId !== null)) {
        expect(automagic.rows.at((item.autoAffixId ?? 0) - 1), `${item.code} auto affix ${String(item.autoAffixId)}`).toBeDefined();
      }
    });

    it('reads defense, durability and the runeword ids of the fixture', () => {
      const armor = items.filter((item) => item.defense !== null);
      expect(armor.length).toBeGreaterThan(0);
      for (const item of armor) {
        expect(item.defense, item.code).toBeGreaterThanOrEqual(0);
        expect(item.maxDurability, item.code).not.toBeNull();
      }
      for (const item of items.filter((entry) => entry.durability !== null)) {
        expect(item.durability ?? 0, item.code).toBeLessThanOrEqual(item.maxDurability ?? 0);
      }
      const runewordIds = new Set(bundle.runewords.map((entry) => entry.id));
      const runewords = items.filter((item) => item.runewordId !== null);
      expect(runewords.length).toBeGreaterThan(0);
      expect(runewords.filter((item) => !runewordIds.has(item.runewordId ?? -1)).map((item) => item.runewordId)).toEqual([]);
    });
  }
);

describe.skipIf(!existsSync(LEGACY) || !existsSync(BUNDLE))('ESR legacy shared stash fixture', () => {
  it('is rejected as the legacy stash', () => {
    const bundle = JSON.parse(readFileSync(BUNDLE, 'utf-8')) as StashBundle;
    expect(() => parseStash(readBytes(LEGACY), createStashData(bundle))).toThrow(UnsupportedStashError);
  });
});
