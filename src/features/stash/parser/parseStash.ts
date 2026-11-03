/**
 * Shared stash (.d2i) reader for ESR's "Modern" shared stash (ModernSharedStashSoftCoreV2.d2i): a run of sections,
 * one per stash tab, each a 64-byte header (d2s-rs `D2StashTab`, MIT) followed by the tab's items:
 *
 *   0x00 u32 0xAA55AA55   0x04 u32 stash format (2)   0x08 u32 save version   0x0C u32 gold
 *   0x10 u16 section size in bytes (header included)   0x12 u16 season   0x14 u8 tab type   0x15… zero
 *
 * Tab types: 0 normal page ("JM" + u16 item count + items), 1 advanced stash (materials, same item list), 2 Chronicle
 * (0xC0EAEDC0 + u16 version + u16 set / unique / runeword counts + 8 reserved bytes + 10-byte entries).
 *
 * ESR saves with D2RLoader's extended format, whose save version field reads 0x44520005 ("\x05\x00RD"); retail
 * Reign of the Warlock saves have 0x69 (105) and the old ESR stash (SharedStashSoftCoreV2.d2i) 0x63 (99).
 */
import { BitReader } from './bitReader.ts';
import { StashParseError, UnsupportedStashError } from './errors.ts';
import { ESR_EXTENDED_LAYOUT, ItemReadError, readItem, type ItemLayout } from './parseItem.ts';
import type { StashData } from './stashData.ts';
import type { StashFile, StashItem, StashSection, StashTabType } from './types.ts';

export const STASH_MAGIC = 0xaa55aa55;
export const SECTION_HEADER_BYTES = 64;
/** D2RLoader extended save format: "RD" in the high half of the version field, the format revision in the low half */
export const ESR_EXTENDED_VERSION = 0x44520005;
const LOADER_VERSION_TAG = 0x4452;
const ITEM_LIST_MAGIC = 0x4d4a; // "JM"
const CHRONICLE_MAGIC = 0xc0eaedc0;
/** "JM" + u16 item count */
const ITEM_LIST_HEADER_BYTES = 4;
/** Magic + u16 version + u16 set / unique / runeword counts + reserved bytes; the counts end at byte 12 */
const CHRONICLE_HEADER_BYTES = 12;
const TAB_TYPES: readonly StashTabType[] = ['normal', 'advanced', 'chronicle'];

export type StashKind = 'esr-extended' | 'legacy' | 'retail' | 'loader-unknown' | 'not-a-stash';

/** What kind of stash file this is, from the first section header. */
export function detectStash(bytes: Uint8Array): { kind: StashKind; version: number | null } {
  if (bytes.length < SECTION_HEADER_BYTES) return { kind: 'not-a-stash', version: null };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== STASH_MAGIC) return { kind: 'not-a-stash', version: null };
  const version = view.getUint32(8, true);
  if (version === ESR_EXTENDED_VERSION) return { kind: 'esr-extended', version };
  if (version >>> 16 === LOADER_VERSION_TAG) return { kind: 'loader-unknown', version };
  // Before Reign of the Warlock (save version 100) the stash had no tab types; ESR's pre-3.2 stash is one of these
  if (version < 100) return { kind: 'legacy', version };
  return { kind: 'retail', version };
}

function hex(value: number): string {
  return `0x${value.toString(16)}`;
}

function assertSupported(bytes: Uint8Array): void {
  const { kind, version } = detectStash(bytes);
  const v = version === null ? '' : ` (save version ${hex(version)})`;
  switch (kind) {
    case 'esr-extended':
      return;
    case 'not-a-stash':
      throw new UnsupportedStashError('not-a-stash', 'Not a D2R shared stash file (no 0xAA55AA55 section header).');
    case 'legacy':
      throw new UnsupportedStashError(
        'legacy',
        `This is the old shared stash${v}. Upload ModernSharedStashSoftCoreV2.d2i (or the HardCore one) instead.`
      );
    case 'retail':
      throw new UnsupportedStashError('retail', `A retail D2R stash${v}, not one saved by ESR through D2RLoader.`);
    case 'loader-unknown':
      throw new UnsupportedStashError('unknown-version', `An unknown D2RLoader save format revision${v}.`);
  }
}

function readItemList(
  bytes: Uint8Array,
  view: DataView,
  section: number,
  start: number,
  sectionEnd: number,
  data: StashData,
  layout: ItemLayout
): { items: StashItem[]; end: number } {
  assertBodyFits(section, start, ITEM_LIST_HEADER_BYTES, sectionEnd, 'an item list header');
  if (view.getUint16(start, true) !== ITEM_LIST_MAGIC) {
    throw new StashParseError('item list does not start with "JM"', sectionDetails(section, start));
  }
  const count = view.getUint16(start + 2, true);
  const reader = new BitReader(bytes, (start + 4) * 8);
  const items: StashItem[] = [];
  for (let index = 0; index < count; index++) {
    try {
      items.push(readItem(reader, data, { section, index }, layout));
    } catch (error) {
      if (!(error instanceof ItemReadError)) throw error;
      const path = [`item ${String(index)}`, ...error.socketPath.map((socket) => `socket ${String(socket)}`)].join(' › ');
      throw new StashParseError(`${error.message} (item ${String(index + 1)} of ${String(count)})`, {
        section,
        item: index,
        path,
        code: error.code,
        itemBitOffset: error.itemBitOffset,
        bitOffset: error.bitOffset,
      });
    }
  }
  return { items, end: reader.position / 8 };
}

function sectionDetails(section: number | null, byte: number) {
  return { section, item: null, path: null, code: null, itemBitOffset: null, bitOffset: byte * 8 };
}

/** A section body shorter than the header it must start with (the DataView reads would throw a RangeError). */
function assertBodyFits(section: number, start: number, bytes: number, sectionEnd: number, what: string): void {
  if (start + bytes > sectionEnd) {
    throw new StashParseError(
      `the section body has ${String(sectionEnd - start)} bytes, too few for ${what} (${String(bytes)} bytes)`,
      sectionDetails(section, start)
    );
  }
}

function readChronicle(view: DataView, section: number, start: number, sectionEnd: number): StashSection['chronicle'] {
  assertBodyFits(section, start, CHRONICLE_HEADER_BYTES, sectionEnd, 'the Chronicle header');
  if (view.getUint32(start, true) !== CHRONICLE_MAGIC) {
    throw new StashParseError(`chronicle tab does not start with ${hex(CHRONICLE_MAGIC)}`, sectionDetails(section, start));
  }
  return { sets: view.getUint16(start + 6, true), uniques: view.getUint16(start + 8, true), runewords: view.getUint16(start + 10, true) };
}

/**
 * Parses every section of an ESR Modern shared stash. Throws UnsupportedStashError for other files and
 * StashParseError (section, item, bit offset) when the items cannot be walked, including an item list that does not
 * end exactly at its section's end.
 */
export function parseStash(bytes: Uint8Array, data: StashData, layout: ItemLayout = ESR_EXTENDED_LAYOUT): StashFile {
  assertSupported(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sections: StashSection[] = [];
  let offset = 0;
  while (offset + SECTION_HEADER_BYTES <= bytes.length) {
    const index = sections.length;
    if (view.getUint32(offset, true) !== STASH_MAGIC) {
      throw new StashParseError(`section header magic missing at byte ${String(offset)}`, sectionDetails(index, offset));
    }
    const version = view.getUint32(offset + 8, true);
    if (version !== ESR_EXTENDED_VERSION) {
      throw new StashParseError(`unexpected save version ${hex(version)}`, sectionDetails(index, offset));
    }
    const byteSize = view.getUint16(offset + 16, true);
    if (byteSize < SECTION_HEADER_BYTES || offset + byteSize > bytes.length) {
      throw new StashParseError(`invalid section size ${String(byteSize)}`, sectionDetails(index, offset));
    }
    const rawType = view.getUint8(offset + 20);
    const tabType = TAB_TYPES.at(rawType);
    if (tabType === undefined) throw new StashParseError(`unknown tab type ${String(rawType)}`, sectionDetails(index, offset));
    const section: StashSection = {
      index,
      offset,
      byteSize,
      tabType,
      gold: view.getUint32(offset + 12, true),
      items: [],
      chronicle: null,
    };
    const body = offset + SECTION_HEADER_BYTES;
    if (tabType === 'chronicle') {
      section.chronicle = readChronicle(view, index, body, offset + byteSize);
    } else {
      const { items, end } = readItemList(bytes, view, index, body, offset + byteSize, data, layout);
      if (end !== offset + byteSize) {
        throw new StashParseError(
          `the ${String(items.length)} items end at byte ${String(end)}, the section at ${String(offset + byteSize)}`,
          sectionDetails(index, end)
        );
      }
      section.items = items;
    }
    sections.push(section);
    offset += byteSize;
  }
  if (offset !== bytes.length) {
    throw new StashParseError(`${String(bytes.length - offset)} trailing bytes after the last section`, sectionDetails(null, offset));
  }
  return { stashFormat: view.getUint32(4, true), version: view.getUint32(8, true), sections };
}
