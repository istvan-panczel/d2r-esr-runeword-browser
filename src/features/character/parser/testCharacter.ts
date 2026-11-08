/** Test helpers: builds a minimal synthetic .d2s around hand-made items (the mirror of parseCharacter.ts). */
import { STASH_ITEM_FLAGS } from '../../game-data/engine/schema.ts';
import type { StashStatInfo } from '../../game-data/engine/schema.ts';
import { BitWriter, writeItem, type TestItem } from '../../stash/parser/testItems.ts';
import { createCharacterData, type CharacterData } from './characterData.ts';
import { computeCharacterChecksum } from './parseCharacter.ts';

/** The item stats writeItem needs (armor class, durability, sockets), and gf stats 0, 6 (fixed-point) and 926 (ESR) */
const itemStats: Record<number, StashStatInfo> = {
  31: [12, 1000, 0],
  72: [9, 0, 0],
  73: [8, 0, 0],
  194: [4, 0, 0],
};

export const testData: CharacterData = createCharacterData({
  stats: Array.from({ length: 200 }, (_, id) => itemStats[id] ?? null),
  items: [
    ['hax', STASH_ITEM_FLAGS.weapon, 1, 3],
    ['xlm', STASH_ITEM_FLAGS.armor, 2, 2],
    ['jew', 0, 1, 1],
    ['hdm', 0, 2, 3],
  ],
  characterStats: [
    [0, 24, 0],
    [4, 16, 0],
    [6, 32, 8],
    [926, 8, 0],
  ],
  characterClasses: [
    ['Amazon', 418, 35],
    ['Barbarian', 558, 2],
    ['Warlock', 663, 2],
  ],
});

export interface TestSave {
  activeWeapon?: number;
  classId?: number;
  level?: number;
  name?: string;
  lastSavedAt?: number;
  stats?: { id: number; value: number }[];
  /** Points per skill; length is the header's skill count */
  skills?: number[];
  hotkeys?: number[];
  handSkills?: [number, number, number, number];
  mercSeed?: number;
  mercFlags?: number;
  player?: TestItem[];
  corpses?: { header?: number; items: TestItem[] }[];
  /** undefined: no merc item list */
  merc?: TestItem[];
  golem?: TestItem;
  demonFlag?: number;
  summons?: { skill: number; monster: number }[];
  /** Overrides applied to the finished header bytes, before the checksum */
  patch?: (bytes: Uint8Array, view: DataView) => void;
  /** Bytes appended to the file */
  trailing?: number[];
}

function u16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}

function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));

function itemListBytes(items: readonly TestItem[]): number[] {
  const writer = new BitWriter();
  for (const item of items) writeItem(writer, testData, item);
  return [...u16(0x4d4a), ...u16(items.length), ...writer.bytes()];
}

/** The save's skill-bytes section for the class's skill count of the header. */
export function buildSave(save: TestSave = {}): Uint8Array {
  const skills = save.skills ?? [1, 0];
  const header = new Uint8Array(0x193);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0xaa55aa55, true);
  view.setUint32(4, 0x44520005, true);
  view.setUint32(0x10, save.activeWeapon ?? 0, true);
  view.setUint8(0x18, save.classId ?? 1);
  view.setUint8(0x19, 16);
  view.setUint8(0x1a, skills.length);
  view.setUint8(0x1b, save.level ?? 12);
  view.setUint32(0x20, save.lastSavedAt ?? 1_794_169_893, true);
  const hotkeys = save.hotkeys ?? [];
  for (let i = 0; i < 16; i++) view.setUint32(0x28 + 4 * i, hotkeys[i] ?? 0xffff, true);
  const handSkills = save.handSkills ?? [0, 0, 0, 0];
  handSkills.forEach((value, i) => {
    view.setUint32(0x68 + 4 * i, value, true);
  });
  view.setUint32(0x9f, save.mercFlags ?? 0, true);
  view.setUint32(0xa3, save.mercSeed ?? 0, true);
  view.setUint16(0xa7, 7, true);
  view.setUint16(0xa9, 24, true);
  view.setUint32(0xab, 12345, true);
  view.setUint8(0xf8, 3);
  ascii(save.name ?? 'Tester').forEach((byte, i) => {
    view.setUint8(0x12b + i, byte);
  });
  save.patch?.(header, view);

  const statWriter = new BitWriter();
  for (const { id, value } of save.stats ?? []) {
    const def = testData.characterStat(id);
    statWriter.write(id, 16);
    statWriter.write(value, def === undefined ? 8 : def.bits);
  }
  statWriter.write(0xffff, 16);
  statWriter.alignToByte();

  const body: number[] = [
    ...ascii('Woo!'),
    ...u32(6),
    ...u16(298),
    ...new Array<number>(298 - 10).fill(0),
    ...u16(0x5357),
    ...u32(1),
    ...u16(80),
    ...new Array<number>(80 - 8).fill(0),
    ...u16(0x7701),
    ...u16(52),
    ...new Array<number>(52 - 4).fill(0),
    ...u16(0x6667),
    ...statWriter.bytes(),
    ...u16(0x6669),
    ...skills,
    ...itemListBytes(save.player ?? []),
    ...u16(0x4d4a),
    ...u16(save.corpses?.length ?? 0),
    ...(save.corpses ?? []).flatMap((corpse) => [...new Array<number>(12).fill(corpse.header ?? 0), ...itemListBytes(corpse.items)]),
    ...u16(0x666a),
    ...(save.merc === undefined ? [] : itemListBytes(save.merc)),
    ...u16(0x666b),
    save.golem === undefined ? 0 : 1,
  ];
  if (save.golem !== undefined) {
    const writer = new BitWriter();
    writeItem(writer, testData, save.golem);
    body.push(...writer.bytes());
  }
  body.push(...u16(1), ...u16(0x666c), save.demonFlag ?? 0, 0);
  if (save.summons !== undefined) {
    body.push(...ascii('SUMN'), ...u16(1), ...u16(save.summons.length));
    for (const { skill, monster } of save.summons) body.push(...u16(skill), ...u16(monster));
  }
  body.push(...(save.trailing ?? []));

  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header, 0);
  bytes.set(body, header.length);
  const finalView = new DataView(bytes.buffer);
  finalView.setUint32(8, bytes.length, true);
  finalView.setUint32(12, computeCharacterChecksum(bytes), true);
  return bytes;
}

/** Rewrites the checksum after a test changed bytes on purpose. */
export function withChecksum(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(12, computeCharacterChecksum(copy), true);
  return copy;
}

export function indexOfMarker(bytes: Uint8Array, marker: string): number {
  const codes = ascii(marker);
  for (let i = 0; i < bytes.length - codes.length; i++) {
    if (codes.every((code, j) => bytes[i + j] === code)) return i;
  }
  return -1;
}
