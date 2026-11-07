/**
 * The Ancient Coupons of a real ESR Modern shared stash. Skipped without the save file (test-fixtures/stash/, gitignored;
 * see ../parser/stashFixture.integration.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { StashBundle, TypesBundle } from '../../game-data/engine/schema.ts';
import { collectCoupons, DEFAULT_COUPONS_STATE, filterCouponRows, formatLocation, sortCouponRows } from './coupons.ts';
import { buildItemTypeIndex } from './itemTypes.ts';
import { readStash } from './readStash.ts';

const MODERN = resolve(__dirname, '../../../../test-fixtures/stash/ModernSharedStashSoftCoreV2.d2i');
const BUNDLE = resolve(__dirname, '../../../../public/game-data/stash.json');
const TYPES = resolve(__dirname, '../../../../public/game-data/types.json');

describe.skipIf(!existsSync(MODERN) || !existsSync(BUNDLE) || !existsSync(TYPES))('Ancient Coupons in the stash fixture', () => {
  const bundle = JSON.parse(readFileSync(BUNDLE, 'utf-8')) as StashBundle;
  const result = readStash(new Uint8Array(readFileSync(MODERN)), bundle);
  if (!result.ok) throw new Error(result.error.message);
  const types = buildItemTypeIndex((JSON.parse(readFileSync(TYPES, 'utf-8')) as TypesBundle).types);
  const { rows, summary } = collectCoupons(result.stash, bundle, types);
  const search = (text: string) => filterCouponRows(rows, { ...DEFAULT_COUPONS_STATE, search: text }, types);

  it('finds 696 coupons of 281 codes, every one with a recipe', () => {
    expect(summary.total).toBe(696);
    expect(summary.distinct).toBe(281);
    expect(summary.blanks).toBe(0);
    for (const row of rows) {
      expect(row.locations, row.code).toHaveLength(row.have);
      expect(row.need, row.code).toBeGreaterThan(0);
    }
    const top = sortCouponRows(rows, 'status', 'asc').slice(0, 5);
    console.log(
      `Stash fixture coupons: ${String(summary.craftable)} craftable (${String(summary.crafts)} crafts), ` +
        `${String(summary.wildCards)} Wild Cards; top: ` +
        top
          .map((row) => `${row.unique.name} ${String(row.have)}/${String(row.need)} @ ${row.locations.map(formatLocation).join('; ')}`)
          .join(' | ')
    );
  });

  it('finds every belt coupon by item type, whatever the base is called, and "sash" only the sashes', () => {
    const belts = rows.filter((row) => row.base?.type !== undefined && types.byCode.get(row.base.type)?.ancestors.includes('belt'));
    const found = search('belt');
    console.log(`Stash fixture belt coupons: ${found.map((row) => `${row.unique.name} (${row.base?.name ?? '?'})`).join(', ')}`);
    expect(belts.length).toBeGreaterThan(0);
    expect(found.map((row) => row.code).sort()).toEqual(belts.map((row) => row.code).sort());
    expect(found).toHaveLength(10);
    expect(found.some((row) => !(row.base?.name ?? '').toLowerCase().includes('belt'))).toBe(true);
    // "sash" is no type name, so it matches as text: the Sash and the Demonhide Sash, not the other belts
    const sashes = search('sash');
    expect(sashes.map((row) => row.base?.name).sort()).toEqual(['Demonhide Sash', 'Sash']);
  });

  it('finds rings by type and not the Ring Mail armor', () => {
    for (const row of search('ring')) expect(row.typeCodes, row.unique.name).toContain('ring');
    for (const row of search('helmet')) expect(row.typeCodes, row.unique.name).toContain('helm');
  });
});
