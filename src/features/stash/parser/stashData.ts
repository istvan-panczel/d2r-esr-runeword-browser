import { STASH_ITEM_FLAGS, type StashBundle } from '../../game-data/engine/schema.ts';

export interface StashStatDef {
  saveBits: number;
  saveAdd: number;
  hasParam: boolean;
}

export interface StashItemDef {
  armor: boolean;
  weapon: boolean;
  gold: boolean;
  charm: boolean;
  bodyPart: boolean;
  scrollOrBook: boolean;
  questDifficulty: boolean;
  width: number;
  height: number;
}

/** Game data lookups for the item parser (built from stash.json). */
export interface StashData {
  stat(id: number): StashStatDef | undefined;
  item(code: string): StashItemDef | undefined;
}

export function createStashData(bundle: Pick<StashBundle, 'stats' | 'items'>): StashData {
  const stats = bundle.stats.map((entry) =>
    entry === null ? undefined : { saveBits: entry[0], saveAdd: entry[1], hasParam: entry[2] === 1 }
  );
  const items = new Map<string, StashItemDef>(
    bundle.items.map(([code, flags, width, height]) => [
      code,
      {
        armor: (flags & STASH_ITEM_FLAGS.armor) !== 0,
        weapon: (flags & STASH_ITEM_FLAGS.weapon) !== 0,
        gold: (flags & STASH_ITEM_FLAGS.gold) !== 0,
        charm: (flags & STASH_ITEM_FLAGS.charm) !== 0,
        bodyPart: (flags & STASH_ITEM_FLAGS.bodyPart) !== 0,
        scrollOrBook: (flags & STASH_ITEM_FLAGS.scrollOrBook) !== 0,
        questDifficulty: (flags & STASH_ITEM_FLAGS.questDifficulty) !== 0,
        width,
        height,
      },
    ])
  );
  return {
    stat: (id) => stats[id],
    item: (code) => items.get(code),
  };
}
