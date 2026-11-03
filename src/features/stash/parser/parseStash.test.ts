import { describe, expect, it } from 'vitest';
import { StashParseError, UnsupportedStashError } from './errors.ts';
import { detectStash, ESR_EXTENDED_VERSION, parseStash, SECTION_HEADER_BYTES } from './parseStash.ts';
import { createStashData } from './stashData.ts';
import { BitWriter, writeItem, type TestItem } from './testItems.ts';

const data = createStashData({
  stats: [],
  items: [['01c', 0, 1, 1]],
});

function section(version: number, tabType: number, body: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(SECTION_HEADER_BYTES + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0xaa55aa55, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, version, true);
  view.setUint32(12, 1234, true);
  view.setUint16(16, bytes.length, true);
  view.setUint8(20, tabType);
  bytes.set(body, SECTION_HEADER_BYTES);
  return bytes;
}

function itemList(items: TestItem[], count = items.length): Uint8Array {
  const writer = new BitWriter().write(0x4d4a, 16).write(count, 16);
  for (const item of items) writeItem(writer, data, item);
  return writer.bytes();
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

describe('detectStash', () => {
  it('tells the ESR extended stash from the legacy and retail ones', () => {
    expect(detectStash(section(ESR_EXTENDED_VERSION, 0, new Uint8Array(4))).kind).toBe('esr-extended');
    expect(detectStash(section(0x63, 0, new Uint8Array(4)))).toEqual({ kind: 'legacy', version: 0x63 });
    expect(detectStash(section(0x69, 0, new Uint8Array(4))).kind).toBe('retail');
    expect(detectStash(section(0x44520006, 0, new Uint8Array(4))).kind).toBe('loader-unknown');
    expect(detectStash(new Uint8Array(100)).kind).toBe('not-a-stash');
  });
});

describe('parseStash', () => {
  it('reads pages, an empty page and a chronicle tab', () => {
    const chronicle = new Uint8Array(20 + 10);
    new DataView(chronicle.buffer).setUint32(0, 0xc0eaedc0, true);
    new DataView(chronicle.buffer).setUint16(6, 1, true);
    const stash = parseStash(
      concat(
        section(
          ESR_EXTENDED_VERSION,
          0,
          itemList([
            { code: '01c', x: 2, y: 5 },
            { code: '01c', compact: true, x: 3 },
          ])
        ),
        section(ESR_EXTENDED_VERSION, 0, itemList([])),
        section(ESR_EXTENDED_VERSION, 2, chronicle)
      ),
      data
    );
    expect(stash.sections.map((s) => [s.index, s.tabType, s.items.length])).toEqual([
      [0, 'normal', 2],
      [1, 'normal', 0],
      [2, 'chronicle', 0],
    ]);
    expect(stash.sections[0]?.gold).toBe(1234);
    expect(stash.sections[0]?.items.map((item) => [item.code, item.x, item.y, item.compact])).toEqual([
      ['01c', 2, 5, false],
      ['01c', 3, 0, true],
    ]);
    expect(stash.sections[2]?.chronicle).toEqual({ sets: 1, uniques: 0, runewords: 0 });
  });

  it('rejects the legacy stash', () => {
    expect(() => parseStash(section(0x63, 0, itemList([])), data)).toThrow(UnsupportedStashError);
  });

  it('reports a section whose items do not end at the section end', () => {
    const body = concat(itemList([{ code: '01c' }]), new Uint8Array(3));
    let error: unknown;
    try {
      parseStash(section(ESR_EXTENDED_VERSION, 0, body), data);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(StashParseError);
    expect((error as StashParseError).details.section).toBe(0);
    expect((error as StashParseError).message).toMatch(/items end at byte/);
  });

  it('reports the section, item index and code of an item that cannot be read', () => {
    // The header claims two items but only one follows: the second read runs into zero padding
    const body = concat(itemList([{ code: '01c' }], 2), new Uint8Array(40));
    let error: unknown;
    try {
      parseStash(section(ESR_EXTENDED_VERSION, 0, body), data);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(StashParseError);
    expect((error as StashParseError).details).toMatchObject({ section: 0, item: 1, path: 'item 1' });
    expect((error as StashParseError).details.itemBitOffset).toBeGreaterThan(SECTION_HEADER_BYTES * 8);
  });
});
