/**
 * Reads a D2R ESR character save (.d2s, D2RLoader's extended format, revision 0x44520005). Every section is walked to
 * its boundary and the file must end exactly there; anything else throws CharacterParseError naming the failure point.
 * Format notes and what is verified vs inferred: docs/features/CHARACTER-SAVE.md.
 */
import { BitReader, BitReaderEofError } from '../../stash/parser/bitReader.ts';
import { ESR_EXTENDED_LAYOUT, ITEM_FLAG, ItemReadError, readItem } from '../../stash/parser/parseItem.ts';
import type { StashItem } from '../../stash/parser/types.ts';
import type { CharacterClassDef, CharacterData } from './characterData.ts';
import { CharacterParseError, type CharacterParseErrorDetails, type CharacterParseReason, type CharacterSectionName } from './errors.ts';
import { equippedGear, toCharacterItem } from './location.ts';
import type {
  BaseAttributes,
  CharacterFile,
  CharacterItem,
  CharacterSectionRange,
  CharacterSkillPoints,
  CharacterStat,
  CorpseItems,
  HandSkills,
  MercenaryHeader,
  SavedSummon,
  SkillBinding,
} from './types.ts';

const FILE_MAGIC = 0xaa55aa55;
/** D2RLoader's extended save revision: the same on every save from ESR 3.2.10 to 3.3.02 */
export const SAVE_FORMAT_VERSION = 0x44520005;
const CHECKSUM_OFFSET = 12;
const QUESTS_OFFSET = 0x193;

const QUEST_MAGIC = 0x216f6f57; // Woo!
const WAYPOINT_MARKER = 0x5357; // WS
const NPC_MARKER = 0x7701; // 01 77
const ATTRIBUTES_MARKER = 0x6667; // gf
const SKILLS_MARKER = 0x6669; // if
const ITEM_LIST_MARKER = 0x4d4a; // JM
const MERC_ITEMS_MARKER = 0x666a; // jf
const GOLEM_MARKER = 0x666b; // kf
const DEMON_MARKER = 0x666c; // lf, after a u16 version of 1
const SUMMON_MAGIC = 0x4e4d5553; // SUMN

const STAT_ID_BITS = 16;
const STAT_TERMINATOR = 0xffff;
const CORPSE_HEADER_BYTES = 12;

/** The rotate-left-1 + byte checksum of a save, with bytes 12-15 (the checksum itself) read as zero. */
export function computeCharacterChecksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = i >= CHECKSUM_OFFSET && i < CHECKSUM_OFFSET + 4 ? 0 : (bytes[i] ?? 0);
    sum = (((sum << 1) | (sum >>> 31)) + byte) >>> 0;
  }
  return sum;
}

const hex = (bytes: Uint8Array, offset: number, count: number): string =>
  Array.from(bytes.subarray(offset, offset + count), (byte) => byte.toString(16).padStart(2, '0')).join(' ');

/** Bounds-checked reads over the file, and the sections walked so far. */
class SaveWalker {
  readonly bytes: Uint8Array;
  readonly data: CharacterData;
  readonly #view: DataView;
  /** The section being read; a failure is reported against it */
  section: CharacterSectionName = 'header';
  readonly ranges: CharacterSectionRange[] = [];

  constructor(bytes: Uint8Array, data: CharacterData) {
    this.bytes = bytes;
    this.data = data;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  fail(reason: CharacterParseReason, message: string, details: Partial<CharacterParseErrorDetails> = {}): never {
    throw new CharacterParseError(reason, message, { section: this.section, ...details });
  }

  #check(offset: number, count: number): void {
    if (offset + count > this.bytes.length) {
      this.fail('truncated', `read of ${String(count)} bytes runs past the end of the file (${String(this.bytes.length)} bytes)`, {
        byteOffset: offset,
      });
    }
  }

  u8(offset: number): number {
    this.#check(offset, 1);
    return this.#view.getUint8(offset);
  }

  u16(offset: number): number {
    this.#check(offset, 2);
    return this.#view.getUint16(offset, true);
  }

  u32(offset: number): number {
    this.#check(offset, 4);
    return this.#view.getUint32(offset, true);
  }

  /** Is `count` bytes at `offset` inside the file? */
  available(offset: number, count: number): boolean {
    return offset + count <= this.bytes.length;
  }

  /** Closes the current section and moves on to the next one. */
  close(start: number, end: number, next: CharacterSectionName): void {
    this.ranges.push({ name: this.section, start, end });
    this.section = next;
  }

  /** The section that just ended must be followed by this 2-byte marker. */
  requireMarker(offset: number, marker: number, label: string, unverified: CharacterParseErrorDetails['unverified'] = null): void {
    if (this.u16(offset) !== marker) {
      this.fail('section-boundary', `${this.section} did not end on its boundary: expected ${label}, found ${hex(this.bytes, offset, 8)}`, {
        byteOffset: offset,
        unverified,
      });
    }
  }
}

function checkFileHeader(walker: SaveWalker): void {
  const { bytes } = walker;
  if (!walker.available(0, 4) || walker.u32(0) !== FILE_MAGIC) {
    walker.fail('bad-magic', 'not a D2R character save (no 0xAA55AA55 magic)', { byteOffset: 0 });
  }
  const version = walker.u32(4);
  if (version !== SAVE_FORMAT_VERSION) {
    walker.fail(
      'unsupported-version',
      `save format revision 0x${version.toString(16)} is not ESR's extended format 0x${SAVE_FORMAT_VERSION.toString(16)}`,
      { byteOffset: 4 }
    );
  }
  const declared = walker.u32(8);
  if (declared !== bytes.length) {
    walker.fail('size-mismatch', `header declares ${String(declared)} bytes, the file has ${String(bytes.length)}`, { byteOffset: 8 });
  }
  const stored = walker.u32(CHECKSUM_OFFSET);
  const computed = computeCharacterChecksum(bytes);
  if (stored !== computed) {
    walker.fail('checksum-mismatch', `checksum 0x${stored.toString(16)} does not match the computed 0x${computed.toString(16)}`, {
      byteOffset: CHECKSUM_OFFSET,
    });
  }
  if (bytes.length < QUESTS_OFFSET + 4)
    walker.fail('truncated', `the header needs ${String(QUESTS_OFFSET + 4)} bytes`, { byteOffset: bytes.length });
}

function skillBinding(raw: number): SkillBinding {
  const low = raw & 0xffff;
  return { raw, skillId: low === 0xffff ? null : low & 0x7fff, leftHand: (low & 0x8000) !== 0 };
}

function readName(bytes: Uint8Array, offset: number, max: number): string {
  let end = offset;
  while (end < offset + max && bytes[end] !== 0) end++;
  return new TextDecoder().decode(bytes.subarray(offset, end));
}

type HeaderFields = Pick<
  CharacterFile,
  | 'version'
  | 'fileSize'
  | 'checksum'
  | 'name'
  | 'classId'
  | 'className'
  | 'level'
  | 'lastSavedAt'
  | 'activeWeapon'
  | 'status'
  | 'progression'
  | 'gameVersion'
  | 'hotkeys'
  | 'handSkills'
  | 'mercenary'
>;

interface HeaderResult {
  header: HeaderFields;
  classDef: CharacterClassDef;
  /** Number of skills in the `if` section */
  skillCount: number;
}

function readHeader(walker: SaveWalker): HeaderResult {
  const activeWeapon = walker.u32(0x10);
  if (activeWeapon !== 0 && activeWeapon !== 1) {
    walker.fail('invalid-value', `active weapon ${String(activeWeapon)} is neither 0 nor 1`, { byteOffset: 0x10 });
  }

  const classId = walker.u8(0x18);
  const classDef = walker.data.characterClass(classId);
  if (classDef === undefined) walker.fail('unknown-class', `class id ${String(classId)} is not in the game data`, { byteOffset: 0x18 });

  const hotkeys = Array.from({ length: 16 }, (_, i) => skillBinding(walker.u32(0x28 + 4 * i)));
  const handSkills: HandSkills = {
    left: skillBinding(walker.u32(0x68)),
    right: skillBinding(walker.u32(0x6c)),
    swapLeft: skillBinding(walker.u32(0x70)),
    swapRight: skillBinding(walker.u32(0x74)),
  };

  const mercSeed = walker.u32(0xa3);
  const mercFlags = walker.u32(0x9f);
  const mercenary: MercenaryHeader | null =
    mercSeed === 0
      ? null
      : {
          flags: mercFlags,
          dead: (mercFlags & 0x10000) !== 0,
          seed: mercSeed,
          nameIndex: walker.u16(0xa7),
          typeId: walker.u16(0xa9),
          experience: walker.u32(0xab),
        };

  return {
    header: {
      version: walker.u32(4),
      fileSize: walker.u32(8),
      checksum: walker.u32(CHECKSUM_OFFSET),
      name: readName(walker.bytes, 0x12b, 96),
      classId,
      className: classDef.name,
      level: walker.u8(0x1b),
      lastSavedAt: walker.u32(0x20),
      activeWeapon,
      status: walker.u8(0x14),
      progression: walker.u8(0x15),
      gameVersion: walker.u8(0xf8),
      hotkeys,
      handSkills,
      mercenary,
    },
    classDef,
    skillCount: walker.u8(0x1a),
  };
}

/** `Woo!` quests, `WS` waypoints and the NPC block: walked by their declared sizes, the bytes are not interpreted. */
function walkFixedSections(walker: SaveWalker): number {
  let offset = QUESTS_OFFSET;
  if (walker.u32(offset) !== QUEST_MAGIC) {
    walker.fail('section-boundary', `header did not end on its boundary: expected "Woo!", found ${hex(walker.bytes, offset, 8)}`, {
      byteOffset: offset,
    });
  }
  walker.close(0, offset, 'quests');

  const questsEnd = offset + walker.u16(offset + 8);
  walker.requireMarker(questsEnd, WAYPOINT_MARKER, '"WS"');
  walker.close(offset, questsEnd, 'waypoints');
  offset = questsEnd;

  const waypointsEnd = offset + walker.u16(offset + 6);
  walker.requireMarker(waypointsEnd, NPC_MARKER, '01 77');
  walker.close(offset, waypointsEnd, 'npc');
  offset = waypointsEnd;

  const npcEnd = offset + walker.u16(offset + 2);
  walker.requireMarker(npcEnd, ATTRIBUTES_MARKER, '"gf"');
  walker.close(offset, npcEnd, 'attributes');
  return npcEnd;
}

function readAttributes(walker: SaveWalker, start: number): { stats: CharacterStat[]; end: number } {
  const reader = new BitReader(walker.bytes, (start + 2) * 8);
  const stats: CharacterStat[] = [];
  try {
    for (;;) {
      const id = reader.read(STAT_ID_BITS);
      if (id === STAT_TERMINATOR) break;
      const def = walker.data.characterStat(id);
      if (def === undefined) {
        walker.fail('unknown-stat', `stat ${String(id)} has no CSvBits in the game data`, { bitOffset: reader.position - STAT_ID_BITS });
      }
      const raw = reader.read(def.bits);
      stats.push({ id, raw, value: raw / 2 ** def.shift });
    }
  } catch (error) {
    if (error instanceof BitReaderEofError) walker.fail('truncated', error.message, { bitOffset: reader.position });
    throw error;
  }
  reader.alignToByte();
  return { stats, end: reader.position / 8 };
}

function baseAttributes(stats: readonly CharacterStat[]): BaseAttributes {
  const value = (id: number) => stats.find((stat) => stat.id === id)?.value ?? 0;
  return {
    strength: value(0),
    energy: value(1),
    dexterity: value(2),
    vitality: value(3),
    statPoints: value(4),
    skillPoints: value(5),
    life: value(6),
    maxLife: value(7),
    mana: value(8),
    maxMana: value(9),
    stamina: value(10),
    maxStamina: value(11),
    level: value(12),
    experience: value(13),
    gold: value(14),
    goldBank: value(15),
  };
}

/** `if` section: one byte per skill of the class, in skills.txt row order, so the row is `firstSkillId + index`. */
function readSkills(walker: SaveWalker, start: number, classDef: CharacterClassDef, count: number): CharacterSkillPoints[] {
  if (count !== classDef.skillCount) {
    walker.fail(
      'skill-count-mismatch',
      `the save lists ${String(count)} skills, the game data ${String(classDef.skillCount)} for ${classDef.name}`,
      {
        byteOffset: start,
      }
    );
  }
  return Array.from({ length: count }, (_, i): CharacterSkillPoints => ({
    skillId: classDef.firstSkillId + i,
    points: walker.u8(start + 2 + i),
  }));
}

interface ListOptions {
  /** Set for sections no real save has exercised: failures say so */
  unverified?: CharacterParseErrorDetails['unverified'];
}

function isEar(item: StashItem): boolean {
  return (item.flags & ITEM_FLAG.ear) !== 0;
}

/** Wraps a failure inside an item with the section, the list index and, when an ear is involved, that fact. */
function itemFailure(walker: SaveWalker, error: ItemReadError, index: number, listHasEar: boolean, options: ListOptions): never {
  const failingFlags = new BitReader(walker.bytes, error.itemBitOffset).peek(32);
  const failedOnEar = (failingFlags & ITEM_FLAG.ear) !== 0;
  const path = [`item ${String(index)}`, ...error.socketPath.map((socket) => `socket ${String(socket)}`)].join(' › ');
  walker.fail('item', error.message, {
    item: index,
    path,
    code: error.code,
    bitOffset: error.bitOffset,
    unverified: options.unverified ?? (failedOnEar || listHasEar ? 'ear' : null),
  });
}

/** A `JM` + count item list; the caller has checked the marker. */
function readItemList(walker: SaveWalker, start: number, options: ListOptions = {}): { items: StashItem[]; end: number } {
  const count = walker.u16(start + 2);
  const reader = new BitReader(walker.bytes, (start + 4) * 8);
  const items: StashItem[] = [];
  let listHasEar = false;
  for (let index = 0; index < count; index++) {
    try {
      const item = readItem(reader, walker.data, { section: 0, index }, ESR_EXTENDED_LAYOUT);
      if (isEar(item)) listHasEar = true;
      items.push(item);
    } catch (error) {
      if (error instanceof ItemReadError) itemFailure(walker, error, index, listHasEar, options);
      throw error;
    }
  }
  return { items, end: reader.position / 8 };
}

/** The list's end must be followed by `marker`; an ear in the list is the first suspect when it is not. */
function requireAfterList(
  walker: SaveWalker,
  offset: number,
  marker: number,
  label: string,
  items: readonly StashItem[],
  options: ListOptions = {}
): void {
  walker.requireMarker(offset, marker, label, options.unverified ?? (items.some(isEar) ? 'ear' : null));
}

/** Bound-demon block (`01 00 'lf'` + hasDemon + padding). A demon's block has an unknown layout under the extended format. */
function readDemonBlock(walker: SaveWalker, start: number): number {
  const present = walker.u8(start + 4);
  if (present !== 0) {
    walker.fail('unsupported-block', `a bound demon is saved here (flag ${String(present)}) and its block layout is unknown`, {
      byteOffset: start,
      unverified: 'bound-demon',
    });
  }
  return start + 6;
}

function readSummons(walker: SaveWalker, start: number): { summons: SavedSummon[]; end: number } {
  const count = walker.u16(start + 6);
  const summons: SavedSummon[] = [];
  for (let i = 0; i < count; i++) {
    summons.push({ skillId: walker.u16(start + 8 + 4 * i), monsterId: walker.u16(start + 10 + 4 * i) });
  }
  return { summons, end: start + 8 + 4 * count };
}

/**
 * Parses a .d2s. Throws CharacterParseError on a structural problem: bad magic, a checksum mismatch, a section not ending
 * on its boundary, an unknown stat id, or a part of the format no real save has exercised (corpses, golem, bound demon,
 * ears) failing to parse.
 */
export function parseCharacter(bytes: Uint8Array, data: CharacterData): CharacterFile {
  const walker = new SaveWalker(bytes, data);
  checkFileHeader(walker);
  const { header, classDef, skillCount } = readHeader(walker);

  let offset = walkFixedSections(walker);

  const attributesStart = offset;
  const { stats, end: attributesEnd } = readAttributes(walker, attributesStart);
  walker.requireMarker(attributesEnd, SKILLS_MARKER, '"if"');
  walker.close(attributesStart, attributesEnd, 'skills');
  offset = attributesEnd;

  const skills = readSkills(walker, offset, classDef, skillCount);
  const skillsEnd = offset + 2 + skillCount;
  walker.requireMarker(skillsEnd, ITEM_LIST_MARKER, '"JM"');
  walker.close(offset, skillsEnd, 'player-items');
  offset = skillsEnd;

  const player = readItemList(walker, offset);
  requireAfterList(walker, player.end, ITEM_LIST_MARKER, '"JM" (corpse list)', player.items);
  walker.close(offset, player.end, 'corpses');
  offset = player.end;

  const corpseStart = offset;
  const corpseCount = walker.u16(offset + 2);
  const corpseOptions: ListOptions = corpseCount > 0 ? { unverified: 'corpse' } : {};
  offset += 4;
  const corpses: CorpseItems[] = [];
  for (let i = 0; i < corpseCount; i++) {
    const headerBytes = bytes.subarray(offset, offset + CORPSE_HEADER_BYTES);
    offset += CORPSE_HEADER_BYTES;
    walker.requireMarker(offset, ITEM_LIST_MARKER, `"JM" (corpse ${String(i)} items)`, 'corpse');
    const list = readItemList(walker, offset, corpseOptions);
    corpses.push({ headerBytes, items: list.items.map((item) => toCharacterItem(item, false)) });
    offset = list.end;
  }
  walker.requireMarker(offset, MERC_ITEMS_MARKER, '"jf"', corpseCount > 0 ? 'corpse' : null);
  walker.close(corpseStart, offset, 'merc-items');

  const mercStart = offset;
  offset += 2;
  let mercItems: StashItem[] = [];
  if (walker.u16(offset) === ITEM_LIST_MARKER) {
    const list = readItemList(walker, offset);
    mercItems = list.items;
    offset = list.end;
  }
  requireAfterList(walker, offset, GOLEM_MARKER, '"kf"', mercItems);
  walker.close(mercStart, offset, 'golem');

  const golemStart = offset;
  const golemPresent = walker.u8(offset + 2) !== 0;
  offset += 3;
  let golem: CharacterItem | null = null;
  if (golemPresent) {
    const reader = new BitReader(bytes, offset * 8);
    try {
      golem = toCharacterItem(readItem(reader, data, { section: 0, index: 0 }, ESR_EXTENDED_LAYOUT), false);
    } catch (error) {
      if (error instanceof ItemReadError) itemFailure(walker, error, 0, false, { unverified: 'golem' });
      throw error;
    }
    offset = reader.position / 8;
  }
  if (walker.u16(offset) !== 1 || walker.u16(offset + 2) !== DEMON_MARKER) {
    walker.fail('section-boundary', `golem did not end on its boundary: expected 01 00 "lf", found ${hex(bytes, offset, 8)}`, {
      byteOffset: offset,
      unverified: golemPresent ? 'golem' : null,
    });
  }
  walker.close(golemStart, offset, 'bound-demon');

  const demonStart = offset;
  offset = readDemonBlock(walker, offset);
  walker.close(demonStart, offset, 'summons');

  let summons: SavedSummon[] = [];
  if (walker.available(offset, 4) && walker.u32(offset) === SUMMON_MAGIC) {
    const start = offset;
    ({ summons, end: offset } = readSummons(walker, offset));
    walker.ranges.push({ name: 'summons', start, end: offset });
  }

  if (offset !== bytes.length) {
    walker.fail('trailing-bytes', `${String(bytes.length - offset)} bytes left over after the last section`, { byteOffset: offset });
  }

  const swapped = header.activeWeapon === 1;
  const playerItems = player.items.map((item) => toCharacterItem(item, swapped));
  const merc = mercItems.map((item) => toCharacterItem(item, false));
  return {
    ...header,
    attributes: stats,
    baseAttributes: baseAttributes(stats),
    skills,
    items: { player: playerItems, corpses, merc, golem },
    gear: equippedGear(playerItems),
    mercGear: equippedGear(merc),
    summons,
    sections: walker.ranges,
  };
}
