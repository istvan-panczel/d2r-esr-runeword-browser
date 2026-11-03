export type ItemQuality = 'inferior' | 'normal' | 'superior' | 'magic' | 'set' | 'rare' | 'unique' | 'crafted' | 'tempered';

/** The 4-bit quality field, by value (0 is unused) */
export const QUALITY_BY_ID: readonly (ItemQuality | undefined)[] = [
  undefined,
  'inferior',
  'normal',
  'superior',
  'magic',
  'set',
  'rare',
  'unique',
  'crafted',
  'tempered',
];

/** One saved stat: `value` is the stored value minus Save Add (ValShift is not applied) */
export interface StashStat {
  id: number;
  /** Save Param Bits value (skill, level, tab, …); 0 for stats without a param */
  param: number;
  value: number;
}

/** Item location mode (the 3-bit "mode" field) */
export const ITEM_MODE = { stored: 0, equipped: 1, belt: 2, ground: 3, cursor: 4, dropping: 5, socketed: 6 } as const;

export interface StashItem {
  /** Stash section (tab) the item is in, 0-based; the page shown in game is section + 1 */
  section: number;
  /** Index in the section's item list (socketed items: the socket index in their parent) */
  index: number;
  /** Bit offset of the item's first bit from the start of the file */
  bitOffset: number;
  /** Raw 32-bit item flags */
  flags: number;
  /** Location mode (ITEM_MODE) */
  mode: number;
  /** Grid column (socketed items: the socket) */
  x: number;
  /** Grid row */
  y: number;
  /** Inventory size from the item tables; null for a code the game data does not know */
  width: number | null;
  height: number | null;
  /** Item code without padding ("jew", "01c") */
  code: string;
  /** Compact (simple) item: no quality, level, stats … */
  compact: boolean;
  identified: boolean;
  ethereal: boolean;
  /** null for compact items */
  quality: ItemQuality | null;
  /** Item level; null for compact items */
  level: number | null;
  /** uniqueitems.txt row (unique quality) */
  uniqueId: number | null;
  /** setitems.txt row (set quality) */
  setId: number | null;
  /** Raw runeword field (runeword flag) */
  runewordId: number | null;
  /** Stack quantity (arrows, bolts, keys, tomes …) */
  quantity: number | null;
  /** Stack size in the advanced (materials) stash tab */
  stackSize: number | null;
  /** Number of sockets (socketed flag) */
  sockets: number | null;
  /** Items in the sockets; they are not part of the section's item count */
  socketed: StashItem[];
  stats: StashStat[];
  /** Set bonus stat lists, one per bit of the set mask */
  setBonusStats: StashStat[][];
  runewordStats: StashStat[];
}

export type StashTabType = 'normal' | 'advanced' | 'chronicle';

export interface StashSection {
  /** 0-based; the in-game page is index + 1 */
  index: number;
  /** Byte offset of the section header */
  offset: number;
  /** Section size in bytes, header included */
  byteSize: number;
  tabType: StashTabType;
  gold: number;
  /** Items listed in the section (socketed items not counted) */
  items: StashItem[];
  /** Chronicle tab only: number of recorded set items, uniques and runewords */
  chronicle: { sets: number; uniques: number; runewords: number } | null;
}

export interface StashFile {
  /** `stash format` field of the section headers (2 for the Reign of the Warlock era stash) */
  stashFormat: number;
  /** Raw save version field */
  version: number;
  sections: StashSection[];
}
