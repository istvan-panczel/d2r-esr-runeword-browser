/**
 * Reads one item (and the items in its sockets) of a D2R save written with D2RLoader's "extended" save format, which
 * ESR uses (`[d2rcore.save_format] mode = "extended"` in d2rloader/config/d2rloader.toml). Items carry no length, so
 * every field has to be read to find where the next item starts.
 *
 * The field order follows the retail D2R 3.x item format as implemented by ResurrectedTrader/d2s-rs
 * (src/model/item.rs, MIT; save version 105). The extended format widens some fields; the widths in
 * ESR_EXTENDED_LAYOUT were measured on a real ESR 3.2.24 stash (every item of 1001 sections ends exactly on its
 * section's byte boundary), not taken from a spec, since D2RLoader's format is undocumented.
 */
import { BitReader } from './bitReader.ts';
import { readItemCode } from './huffman.ts';
import type { StashData, StashItemDef } from './stashData.ts';
import { ITEM_MODE, QUALITY_BY_ID, type ItemQuality, type StashItem, type StashStat } from './types.ts';

export interface ItemLayout {
  /** Extra bits between the 3-bit item format and the mode (retail: none) */
  headerExtraBits: number;
  /** Stat id width (retail 9); the list ends with an id of all ones */
  statIdBits: number;
  /** Width of the param of every stat with Save Param Bits > 0 (retail: that column) */
  statParamBits: number;
  /** Magic prefix / suffix ids: magic items, rare and crafted affixes, normal charms (retail 11) */
  affixBits: number;
  /** automagic.txt id (retail 11) */
  autoAffixBits: number;
  /** Rare / crafted / tempered name ids (retail 8) */
  rareNameBits: number;
  /** uniqueitems.txt / setitems.txt row (retail 12) */
  setUniqueBits: number;
  /** Runeword field (retail 16: a 12-bit id + 4 bits) */
  runewordBits: number;
}

/**
 * Measured on ESR 3.2.24 (save version field 0x44520005). Verified by the fixture: header extra bits (always 160),
 * stat ids, params, magic / rare / auto affixes, rare names, set / unique ids. Not seen in the sample, so assumed:
 * normal charm affixes (affixBits), tempered names (rareNameBits), the runeword field width.
 */
export const ESR_EXTENDED_LAYOUT: ItemLayout = {
  headerExtraBits: 8,
  statIdBits: 16,
  statParamBits: 32,
  affixBits: 16,
  autoAffixBits: 16,
  rareNameBits: 17,
  setUniqueBits: 16,
  runewordBits: 16,
};

export const ITEM_FLAG = {
  identified: 0x10,
  socketed: 0x800,
  ear: 0x10000,
  compact: 0x200000,
  ethereal: 0x400000,
  personalized: 0x1000000,
  /** Gamble preview item: only the code follows */
  lowQuality: 0x2000000,
  runeword: 0x4000000,
  chronicle: 0x10000000,
  chronicleCompact: 0x20000000,
} as const;

/** itemstatcost.txt rows the item header reads directly (the same in vanilla and ESR) */
export const STAT = { armorClass: 31, durability: 72, maxDurability: 73, numSockets: 194, questDifficulty: 356 } as const;

/**
 * Stats followed by their partner stats without ids of their own (engine-hardcoded, as in d2s-rs `paired_stats`):
 * max% → min% damage, and the min damage of fire / lightning / magic / cold / poison → max (+ length for cold, poison).
 */
export const PAIRED_STATS: ReadonlyMap<number, readonly number[]> = new Map([
  [17, [18]],
  [48, [49]],
  [50, [51]],
  [52, [53]],
  [54, [55, 56]],
  [57, [58, 59]],
]);

/** Ear and personalized names: 8-bit characters up to a 0 (save version > 97) */
const MAX_NAME_LENGTH = 16;

/** A failure inside an item: where it happened, and the code when it was already read. */
export class ItemReadError extends Error {
  readonly code: string | null;
  /** Bit offset of the failing item's first bit */
  readonly itemBitOffset: number;
  /** Bit offset where reading failed */
  readonly bitOffset: number;
  /** Socket indexes from the top-level item down to the failing one ([] for the top-level item itself) */
  readonly socketPath: readonly number[];

  constructor(
    message: string,
    details: { code: string | null; itemBitOffset: number; bitOffset: number; socketPath?: number[] },
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = 'ItemReadError';
    this.code = details.code;
    this.itemBitOffset = details.itemBitOffset;
    this.bitOffset = details.bitOffset;
    this.socketPath = details.socketPath ?? [];
  }
}

export interface ItemContext {
  section: number;
  index: number;
}

interface Reading {
  reader: BitReader;
  data: StashData;
  layout: ItemLayout;
}

function readStatList({ reader, data, layout }: Reading): StashStat[] {
  const terminator = 2 ** layout.statIdBits - 1;
  const stats: StashStat[] = [];
  for (;;) {
    const id = reader.read(layout.statIdBits);
    if (id === terminator) return stats;
    const read = (statId: number, withParam: boolean) => {
      const def = data.stat(statId);
      if (def === undefined) throw new Error(`stat ${String(statId)} is not saved on items (Save Bits 0 or unknown)`);
      const param = withParam && def.hasParam ? reader.read(layout.statParamBits) : 0;
      stats.push({ id: statId, param, value: reader.read(def.saveBits) - def.saveAdd });
    };
    read(id, true);
    for (const paired of PAIRED_STATS.get(id) ?? []) read(paired, false);
  }
}

function readName(reader: BitReader): string {
  let name = '';
  for (let i = 0; i < MAX_NAME_LENGTH; i++) {
    const char = reader.read(8);
    if (char === 0) return name;
    name += String.fromCharCode(char);
  }
  return name;
}

function readStatValue(reader: BitReader, data: StashData, id: number): number {
  const def = data.stat(id);
  if (def === undefined) throw new Error(`stat ${String(id)} missing from the game data`);
  return reader.read(def.saveBits) - def.saveAdd;
}

/** Realm data: a flag, then four 32-bit values (present on every item of the ESR sample) */
function skipRealmData(reader: BitReader): void {
  if (reader.readBool()) reader.skip(4 * 32);
}

/** Quality-specific fields, stored on the item; returns the unique / set id. */
function readQualityData(reading: Reading, quality: ItemQuality, def: StashItemDef, item: StashItem): number | null {
  const { reader, layout } = reading;
  switch (quality) {
    case 'inferior':
    case 'superior':
      item.qualityVariant = reader.read(3);
      return null;
    case 'magic':
      item.prefixIds = [reader.read(layout.affixBits)];
      item.suffixIds = [reader.read(layout.affixBits)];
      return null;
    case 'set':
    case 'unique':
      return reader.read(layout.setUniqueBits);
    case 'rare':
    case 'crafted':
      item.rareNameIds = [reader.read(layout.rareNameBits), reader.read(layout.rareNameBits)];
      // Three slots, each a prefix then a suffix: a presence flag + id
      for (let slot = 0; slot < 3; slot++) {
        item.prefixIds.push(reader.readBool() ? reader.read(layout.affixBits) : 0);
        item.suffixIds.push(reader.readBool() ? reader.read(layout.affixBits) : 0);
      }
      return null;
    case 'tempered':
      item.rareNameIds = [reader.read(layout.rareNameBits), reader.read(layout.rareNameBits)];
      return null;
    case 'normal':
      if (def.charm) {
        reader.skip(1 + layout.affixBits);
      } else if (def.bodyPart) {
        reader.skip(10);
      } else if (def.scrollOrBook) {
        reader.skip(5);
      }
      return null;
  }
}

const EMPTY_DEF: StashItemDef = {
  armor: false,
  weapon: false,
  gold: false,
  charm: false,
  bodyPart: false,
  scrollOrBook: false,
  questDifficulty: false,
  width: 1,
  height: 1,
};

interface ItemFields {
  item: StashItem;
  /** Filled sockets: this many items follow, after the byte padding */
  filled: number;
}

function readFields(reading: Reading, item: StashItem): ItemFields {
  const { reader, data, layout } = reading;
  const flags = reader.read(32);
  item.flags = flags;
  item.compact = (flags & ITEM_FLAG.compact) !== 0;
  item.identified = (flags & ITEM_FLAG.identified) !== 0;
  item.ethereal = (flags & ITEM_FLAG.ethereal) !== 0;

  // Item format (1 + 2 bits), the extended format's extra bits, mode, position
  reader.skip(3 + layout.headerExtraBits);
  item.mode = reader.read(3);
  if (item.mode === ITEM_MODE.ground || item.mode === ITEM_MODE.dropping) {
    item.x = reader.read(16);
    item.y = reader.read(16);
  } else {
    item.bodyLocation = reader.read(4);
    item.x = reader.read(4);
    item.y = reader.read(4);
    item.storePage = reader.read(3);
  }

  const isEar = (flags & ITEM_FLAG.ear) !== 0;
  if (isEar && item.compact) {
    item.code = 'ear';
    reader.skip(3 + 7); // class, level
    readName(reader);
  } else {
    item.code = readItemCode(reader);
  }
  const def = data.item(item.code);
  item.width = def?.width ?? null;
  item.height = def?.height ?? null;
  if (def === undefined && !(isEar && item.compact)) throw new Error(`unknown item code "${item.code}"`);
  const known: StashItemDef = def ?? EMPTY_DEF;

  if (item.compact) {
    if (known.gold) readGold(reader);
    if (known.questDifficulty) readStatValue(reader, data, STAT.questDifficulty);
    skipRealmData(reader);
    if (reader.readBool()) item.stackSize = reader.read(8);
    return { item, filled: 0 };
  }

  if ((flags & ITEM_FLAG.lowQuality) !== 0) return { item, filled: 0 };

  const filled = reader.read(3);
  reader.skip(32); // seed
  item.level = reader.read(7);
  const qualityId = reader.read(4);
  const quality = QUALITY_BY_ID[qualityId];
  if (quality === undefined) throw new Error(`invalid quality ${String(qualityId)}`);
  item.quality = quality;
  if (reader.readBool()) item.gfx = reader.read(3);
  if (reader.readBool()) item.autoAffixId = reader.read(layout.autoAffixBits);
  const fileIndex = readQualityData(reading, quality, known, item);
  if (quality === 'unique') item.uniqueId = fileIndex;
  if (quality === 'set') item.setId = fileIndex;
  if ((flags & ITEM_FLAG.runeword) !== 0) item.runewordId = reader.read(layout.runewordBits);
  if (isEar) {
    reader.skip(3 + 7);
    readName(reader);
  } else if ((flags & ITEM_FLAG.personalized) !== 0) {
    item.personalizedName = readName(reader);
  }
  skipRealmData(reader);

  if (known.armor) item.defense = readStatValue(reader, data, STAT.armorClass);
  if (known.armor || known.weapon) {
    item.maxDurability = readStatValue(reader, data, STAT.maxDurability);
    if (item.maxDurability > 0) item.durability = readStatValue(reader, data, STAT.durability);
  } else if (known.gold) {
    readGold(reader);
  }
  // Save version > 104: a presence flag for every item
  if (reader.readBool()) item.quantity = reader.read(9);
  if ((flags & ITEM_FLAG.socketed) !== 0) {
    item.sockets = readStatValue(reader, data, STAT.numSockets);
    if (item.sockets < filled) throw new Error(`${String(filled)} socketed items but only ${String(item.sockets)} sockets`);
  }
  const setMask = quality === 'set' ? reader.read(5) : 0;

  item.stats = readStatList(reading);
  for (let i = 0; i < 5; i++) if ((setMask & (1 << i)) !== 0) item.setBonusStats.push(readStatList(reading));
  if ((flags & ITEM_FLAG.runeword) !== 0) item.runewordStats = readStatList(reading);

  if ((flags & ITEM_FLAG.chronicle) !== 0) {
    const compact = (flags & ITEM_FLAG.chronicleCompact) !== 0;
    reader.skip(16); // source string id
    if (!compact) reader.skip(32); // timestamp
    const recipients = compact ? 1 : Math.min(reader.read(4), 8);
    reader.skip(recipients * 64);
  }
  if (reader.readBool()) item.stackSize = reader.read(8);
  return { item, filled };
}

function readGold(reader: BitReader): void {
  reader.skip(reader.readBool() ? 32 : 12);
  reader.skip(1); // player gold flag (save version > 96)
}

/** An item with every field at its "not read" value (the parser fills it in; tests build items from it). */
export function emptyItem(context: ItemContext, bitOffset: number): StashItem {
  return {
    section: context.section,
    index: context.index,
    bitOffset,
    flags: 0,
    mode: 0,
    bodyLocation: 0,
    storePage: 0,
    x: 0,
    y: 0,
    width: null,
    height: null,
    code: '',
    compact: false,
    identified: false,
    ethereal: false,
    quality: null,
    level: null,
    uniqueId: null,
    setId: null,
    runewordId: null,
    prefixIds: [],
    suffixIds: [],
    rareNameIds: null,
    autoAffixId: null,
    qualityVariant: null,
    gfx: null,
    defense: null,
    durability: null,
    maxDurability: null,
    personalizedName: null,
    quantity: null,
    stackSize: null,
    sockets: null,
    socketed: [],
    stats: [],
    setBonusStats: [],
    runewordStats: [],
  };
}

/**
 * Reads the item at the reader's position and the items in its sockets, leaving the reader on the byte after them.
 * Throws ItemReadError with the failing item's offset, the bit where reading failed and the code when it was read.
 */
export function readItem(reader: BitReader, data: StashData, context: ItemContext, layout: ItemLayout = ESR_EXTENDED_LAYOUT): StashItem {
  const item = emptyItem(context, reader.position);
  let filled: number;
  try {
    ({ filled } = readFields({ reader, data, layout }, item));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ItemReadError(
      message,
      { code: item.code === '' ? null : item.code, itemBitOffset: item.bitOffset, bitOffset: reader.position },
      error
    );
  }
  // Every item is written into its own byte buffer
  reader.alignToByte();
  for (let socket = 0; socket < filled; socket++) {
    try {
      item.socketed.push(readItem(reader, data, { section: context.section, index: socket }, layout));
    } catch (error) {
      if (!(error instanceof ItemReadError)) throw error;
      throw new ItemReadError(
        error.message,
        { code: error.code, itemBitOffset: error.itemBitOffset, bitOffset: error.bitOffset, socketPath: [socket, ...error.socketPath] },
        error.cause
      );
    }
  }
  return item;
}
