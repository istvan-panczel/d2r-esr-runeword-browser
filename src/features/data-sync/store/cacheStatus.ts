import { db } from '@/core/db';

/**
 * Tables that must be populated for the cached dataset to be considered
 * complete. When a new data table is added to the app, listing it here makes
 * existing installs refetch once to populate it (table-level migration).
 */
const REQUIRED_TABLES = [db.runewords, db.gemwords, db.htmUniqueItems, db.mythicalUniques, db.ascendancies];

export interface CacheCompleteness {
  readonly isComplete: boolean;
  /** Name of the first empty required table, for logging. */
  readonly emptyTable: string | null;
}

/** Online startup path: every required table must have data, otherwise refetch. */
export async function checkCacheCompleteness(): Promise<CacheCompleteness> {
  for (const table of REQUIRED_TABLES) {
    const count = await table.count();
    if (count === 0) {
      return { isComplete: false, emptyTable: table.name };
    }
  }
  return { isComplete: true, emptyTable: null };
}

/**
 * Offline fallback paths: any cached data is better than an error screen,
 * so only check the primary table (matches the startup saga's offline path).
 */
export async function hasAnyCachedData(): Promise<boolean> {
  return (await db.runewords.count()) > 0;
}
