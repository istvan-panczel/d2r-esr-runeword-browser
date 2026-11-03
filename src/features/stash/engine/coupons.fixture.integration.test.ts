/**
 * The Ancient Coupons of a real ESR Modern shared stash. Skipped without the save file (test-fixtures/stash/, gitignored;
 * see ../parser/stashFixture.integration.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { StashBundle } from '../../game-data/engine/schema.ts';
import { collectCoupons, formatLocation, sortCouponRows } from './coupons.ts';
import { readStash } from './readStash.ts';

const MODERN = resolve(__dirname, '../../../../test-fixtures/stash/ModernSharedStashSoftCoreV2.d2i');
const BUNDLE = resolve(__dirname, '../../../../public/game-data/stash.json');

describe.skipIf(!existsSync(MODERN) || !existsSync(BUNDLE))('Ancient Coupons in the stash fixture', () => {
  const bundle = JSON.parse(readFileSync(BUNDLE, 'utf-8')) as StashBundle;
  const result = readStash(new Uint8Array(readFileSync(MODERN)), bundle);
  if (!result.ok) throw new Error(result.error.message);
  const { rows, summary } = collectCoupons(result.stash, bundle);

  it('finds 541 coupons of 217 codes, every one with a recipe', () => {
    expect(summary.total).toBe(541);
    expect(summary.distinct).toBe(217);
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
});
