/**
 * Walks every item of a real ESR Modern shared stash with the committed stash.json. Skipped without the save file:
 * copy ModernSharedStashSoftCoreV2.d2i (and optionally the legacy SharedStashSoftCoreV2.d2i) from
 * "Saved Games/Diablo II Resurrected/mods/Eastern_Sun_Resurrected" into test-fixtures/stash/ (gitignored, never
 * committed: it is a personal save).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { StashBundle } from '../../game-data/engine/schema.ts';
import { UnsupportedStashError } from './errors.ts';
import { parseStash, SECTION_HEADER_BYTES } from './parseStash.ts';
import { createStashData } from './stashData.ts';
import type { StashItem } from './types.ts';

const FIXTURE_DIR = resolve(__dirname, '../../../../test-fixtures/stash');
const MODERN = resolve(FIXTURE_DIR, 'ModernSharedStashSoftCoreV2.d2i');
const LEGACY = resolve(FIXTURE_DIR, 'SharedStashSoftCoreV2.d2i');
const BUNDLE = resolve(__dirname, '../../../../public/game-data/stash.json');

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

describe.skipIf(!existsSync(LEGACY) || !existsSync(BUNDLE))('ESR legacy shared stash fixture', () => {
  it('is rejected as the legacy stash', () => {
    const bundle = JSON.parse(readFileSync(BUNDLE, 'utf-8')) as StashBundle;
    expect(() => parseStash(readBytes(LEGACY), createStashData(bundle))).toThrow(UnsupportedStashError);
  });
});
