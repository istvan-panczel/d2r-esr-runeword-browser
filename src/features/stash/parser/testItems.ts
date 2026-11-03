/**
 * Test helpers: a little-endian bit writer and a builder for hand-made items in ESR's extended layout (the mirror of
 * parseItem.ts for the fields the tests use).
 */
import { HUFFMAN_ENCODE } from './huffman.ts';
import { ESR_EXTENDED_LAYOUT, ITEM_FLAG, PAIRED_STATS } from './parseItem.ts';
import type { StashData } from './stashData.ts';

export class BitWriter {
  readonly #bits: number[] = [];

  get length(): number {
    return this.#bits.length;
  }

  write(value: number, count: number): this {
    for (let i = 0; i < count; i++) this.#bits.push(Math.floor(value / 2 ** i) % 2);
    return this;
  }

  alignToByte(): this {
    while (this.#bits.length % 8 !== 0) this.#bits.push(0);
    return this;
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.#bits.length / 8));
    this.#bits.forEach((bit, i) => {
      out[i >> 3] = (out[i >> 3] ?? 0) | (bit << (i & 7));
    });
    return out;
  }
}

export function writeItemCode(writer: BitWriter, code: string): void {
  for (const symbol of code.padEnd(4, ' ')) {
    const entry = HUFFMAN_ENCODE.get(symbol);
    if (entry === undefined) throw new Error(`cannot encode "${symbol}"`);
    writer.write(entry.value, entry.length);
  }
}

export interface TestStat {
  id: number;
  param?: number;
  value: number;
}

export interface TestItem {
  code: string;
  x?: number;
  y?: number;
  /** ITEM_MODE; default stored */
  mode?: number;
  compact?: boolean;
  /** Quality id (2 normal, 5 set, 7 unique …); complete items only */
  quality?: number;
  level?: number;
  /** Unique / set row */
  fileIndex?: number;
  quantity?: number;
  stackSize?: number;
  sockets?: number;
  socketed?: TestItem[];
  stats?: TestStat[];
  extraFlags?: number;
}

const L = ESR_EXTENDED_LAYOUT;

/** Partner stats (PAIRED_STATS) are written right after their lead stat without an id, like the game does. */
function writeStats(writer: BitWriter, data: StashData, stats: readonly TestStat[]): void {
  const partners = new Set([...PAIRED_STATS.values()].flat());
  for (const stat of stats) {
    const def = data.stat(stat.id);
    if (def === undefined) throw new Error(`no stat ${String(stat.id)}`);
    const partner = partners.has(stat.id);
    if (!partner) writer.write(stat.id, L.statIdBits);
    if (def.hasParam && !partner) writer.write(stat.param ?? 0, L.statParamBits);
    writer.write(stat.value + def.saveAdd, def.saveBits);
  }
  writer.write(2 ** L.statIdBits - 1, L.statIdBits);
}

/** Writes an item (and its socketed items), byte-aligned like the game does. */
export function writeItem(writer: BitWriter, data: StashData, item: TestItem): void {
  const compact = item.compact === true;
  const socketed = item.socketed ?? [];
  let flags = ITEM_FLAG.identified | 0x800000 | (item.extraFlags ?? 0);
  if (compact) flags |= ITEM_FLAG.compact;
  if (item.sockets !== undefined) flags |= ITEM_FLAG.socketed;
  writer.write(flags, 32);
  writer.write(0b101, 3); // item format 101
  writer.write(160, L.headerExtraBits);
  writer.write(item.mode ?? 0, 3);
  writer.write(0, 4);
  writer.write(item.x ?? 0, 4);
  writer.write(item.y ?? 0, 4);
  writer.write(item.mode === 6 ? 0 : 5, 3);
  writeItemCode(writer, item.code);
  const def = data.item(item.code);
  if (def === undefined) throw new Error(`no item ${item.code}`);
  if (compact) {
    writer.write(1, 1).write(0, 128); // realm data
    writer.write(item.stackSize === undefined ? 0 : 1, 1);
    if (item.stackSize !== undefined) writer.write(item.stackSize, 8);
  } else {
    const quality = item.quality ?? 2;
    writer.write(socketed.length, 3);
    writer.write(0x12345678, 32); // seed
    writer.write(item.level ?? 1, 7);
    writer.write(quality, 4);
    writer.write(0, 1).write(0, 1); // no gfx, no auto affix
    if (quality === 5 || quality === 7) writer.write(item.fileIndex ?? 0, L.setUniqueBits);
    writer.write(1, 1).write(0, 128); // realm data
    const statValue = (id: number, value: number) => {
      const stat = data.stat(id);
      if (stat === undefined) throw new Error(`no stat ${String(id)}`);
      writer.write(value + stat.saveAdd, stat.saveBits);
    };
    if (def.armor) statValue(31, 10);
    if (def.armor || def.weapon) {
      statValue(73, 20);
      statValue(72, 15);
    }
    writer.write(item.quantity === undefined ? 0 : 1, 1);
    if (item.quantity !== undefined) writer.write(item.quantity, 9);
    if (item.sockets !== undefined) statValue(194, item.sockets);
    if (quality === 5) writer.write(0, 5); // set bonus mask
    writeStats(writer, data, item.stats ?? []);
    writer.write(item.stackSize === undefined ? 0 : 1, 1);
    if (item.stackSize !== undefined) writer.write(item.stackSize, 8);
  }
  writer.alignToByte();
  for (const child of socketed) writeItem(writer, data, { ...child, mode: 6 });
}
