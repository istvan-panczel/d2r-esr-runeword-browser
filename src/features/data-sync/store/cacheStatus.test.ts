import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '@/core/db';
import { checkCacheCompleteness, hasAnyCachedData } from './cacheStatus';

// cacheStatus only counts rows, so minimal stand-in rows with just the
// primary key are enough for these tests.
async function populateRequiredTables(except?: string) {
  if (except !== 'runewords') await db.runewords.put({ name: 'Test', variant: 1 } as never);
  if (except !== 'gemwords') await db.gemwords.put({ name: 'Test', variant: 1 } as never);
  if (except !== 'htmUniqueItems') await db.htmUniqueItems.put({ name: 'Test' } as never);
  if (except !== 'mythicalUniques') await db.mythicalUniques.put({ name: 'Test' } as never);
  if (except !== 'ascendancies') await db.ascendancies.put({ name: 'Test' } as never);
}

describe('cacheStatus', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('reports an empty database as incomplete with no cached data', async () => {
    const completeness = await checkCacheCompleteness();
    expect(completeness.isComplete).toBe(false);
    expect(completeness.emptyTable).toBe('runewords');
    expect(await hasAnyCachedData()).toBe(false);
  });

  it('reports a fully populated database as complete', async () => {
    await populateRequiredTables();
    const completeness = await checkCacheCompleteness();
    expect(completeness.isComplete).toBe(true);
    expect(completeness.emptyTable).toBeNull();
    expect(await hasAnyCachedData()).toBe(true);
  });

  it('names the empty table when one required table is missing data', async () => {
    await populateRequiredTables('ascendancies');
    const completeness = await checkCacheCompleteness();
    expect(completeness.isComplete).toBe(false);
    expect(completeness.emptyTable).toBe('ascendancies');
    // Offline fallback still counts this partial cache as usable
    expect(await hasAnyCachedData()).toBe(true);
  });
});
