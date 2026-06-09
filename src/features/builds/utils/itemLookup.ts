import { db } from '@/core/db';
import type { HtmUniqueItem, MythicalUnique } from '@/core/db';
import type { MythicalItemRef, UniqueItemRef } from '../buildData';

// htmUniqueItems / mythicalUniques use an auto-increment primary key (`++id`) that is
// reassigned on every data re-parse: the sync clears each table and bulk-puts the
// freshly parsed rows, and IndexedDB's key generator is NOT reset by clear(), so the
// id range shifts each sync (and differs per device). A build therefore can't rely on
// the stored ref.id to find its item again — after any re-sync every id is orphaned.
// Resolve by the stable item name from the saved snapshot instead, disambiguating by
// base item + category when a name is shared by more than one item. (Runewords/gemwords
// are unaffected — they use a natural [name+variant] key that survives re-parses.)

function pickBestMatch<T extends { baseItem: string; category: string }>(
  matches: readonly T[],
  baseItem: string,
  category: string
): T | null {
  if (matches.length <= 1) return matches[0] ?? null;
  return (
    matches.find((m) => m.baseItem === baseItem && m.category === category) ?? matches.find((m) => m.baseItem === baseItem) ?? matches[0]
  );
}

/** The current htmUniqueItems record behind a unique ref, matched by stable name. */
export async function findUniqueRecord(ref: UniqueItemRef): Promise<HtmUniqueItem | null> {
  const matches = await db.htmUniqueItems.where('name').equals(ref.snapshot.name).toArray();
  return pickBestMatch(matches, ref.snapshot.baseItem, ref.snapshot.category);
}

/** The current mythicalUniques record behind a mythical ref, matched by stable name. */
export async function findMythicalRecord(ref: MythicalItemRef): Promise<MythicalUnique | null> {
  const matches = await db.mythicalUniques.where('name').equals(ref.snapshot.name).toArray();
  return pickBestMatch(matches, ref.snapshot.baseItem, ref.snapshot.category);
}
