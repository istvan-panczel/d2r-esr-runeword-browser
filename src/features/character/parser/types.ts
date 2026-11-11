import type { StashItem } from '../../stash/parser/types.ts';
import type { CharacterSectionName, UnverifiedFeature } from './errors.ts';
import type { CharacterProgress, CharacterQuests } from './progress.ts';

export type { CharacterProgress, CharacterQuests, DifficultyIndex, QuestDifficulty } from './progress.ts';

/** An equipment slot, weapon sets folded into the two hand slots (see `weaponSet` on the location). */
export type EquipSlot = 'head' | 'neck' | 'torso' | 'rightHand' | 'leftHand' | 'rightRing' | 'leftRing' | 'belt' | 'feet' | 'gloves';

export type WeaponSetNumber = 1 | 2;

/** Where an item is. Raw fields stay on the item (`mode`, `bodyLocation`, `storePage`, `x`, `y`). */
export type ItemLocation =
  | {
      kind: 'equipped';
      slot: EquipSlot;
      /** The hand slots only: the weapon set in game, whatever the active set is; null for other slots */
      weaponSet: WeaponSetNumber | null;
      /** The file's body location (1-12), before weapon-set normalisation */
      rawBody: number;
    }
  | { kind: 'inventory' | 'cube' | 'stash' | 'charm'; x: number; y: number }
  /** Belt slot index (the item's `x`), 0-15 */
  | { kind: 'belt'; slot: number }
  /** In the parent's `socketed` list; `socket` is the parent's socket */
  | { kind: 'socketed'; socket: number }
  /** Never seen in a real save, kept so the list stays complete */
  | { kind: 'ground' | 'cursor' | 'dropping' }
  /** A mode / body / store combination no real save has shown (never rejected: the location just cannot be told) */
  | { kind: 'unknown'; mode: number; body: number; store: number };

/** A saved item plus its location. `uniqueId` is null on quest items, which carry the "no row" sentinel (NO_UNIQUE_ROW). */
export interface CharacterItem extends StashItem {
  location: ItemLocation;
  socketed: CharacterItem[];
}

export interface WeaponSet {
  rightHand: CharacterItem | null;
  leftHand: CharacterItem | null;
}

/** The equipped items by slot; weapon set I and II are normalised (see docs/features/CHARACTER-SAVE.md). */
export interface EquippedGear {
  head: CharacterItem | null;
  neck: CharacterItem | null;
  torso: CharacterItem | null;
  rightRing: CharacterItem | null;
  leftRing: CharacterItem | null;
  belt: CharacterItem | null;
  feet: CharacterItem | null;
  gloves: CharacterItem | null;
  /** [set I, set II] */
  weaponSets: [WeaponSet, WeaponSet];
}

/** One `gf` entry. */
export interface CharacterStat {
  /** itemstatcost.txt row */
  id: number;
  /** The stored value */
  raw: number;
  /** `raw` with the stat's ValShift applied (life / mana / stamina are fixed-point) */
  value: number;
}

/** The 16 vanilla stats of `gf`, by name, after ValShift. A stat the save omits (zero values are not written) reads 0. */
export interface BaseAttributes {
  strength: number;
  energy: number;
  dexterity: number;
  vitality: number;
  statPoints: number;
  skillPoints: number;
  life: number;
  maxLife: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  level: number;
  experience: number;
  gold: number;
  goldBank: number;
}

export interface CharacterSkillPoints {
  /** skills.txt row */
  skillId: number;
  points: number;
}

/** A hotkey or hand-skill slot of the header. */
export interface SkillBinding {
  /** skills.txt row (the low 15 bits); null when the slot is unassigned (low 16 bits all ones) */
  skillId: number | null;
  /** Bit 15 of the low half-word, set on some left-hand hotkeys (INFERRED) */
  leftHand: boolean;
  /** The raw 32-bit value */
  raw: number;
}

/** The header's four skill bindings, as stored. Not normalised by the active weapon: see docs/features/CHARACTER-SAVE.md. */
export interface HandSkills {
  left: SkillBinding;
  right: SkillBinding;
  swapLeft: SkillBinding;
  swapRight: SkillBinding;
}

export interface MercenaryHeader {
  /** Bit 16 of the merc flags */
  dead: boolean;
  /** Raw 32-bit flags */
  flags: number;
  seed: number;
  /** Index into the type's name list (INFERRED: needs the per-type name mapping of hireling.txt) */
  nameIndex: number;
  /** hireling.txt `Id` */
  typeId: number;
  experience: number;
}

export interface CorpseItems {
  /** The 12 bytes before the corpse's item list (never seen in a real save, kept raw) */
  headerBytes: Uint8Array;
  items: CharacterItem[];
}

/** A saved summon (INFERRED layout, from one sample): both ids are table rows. */
export interface SavedSummon {
  skillId: number;
  monsterId: number;
}

export interface CharacterSectionRange {
  name: CharacterSectionName;
  /** Byte offset of the section, from the start of the file */
  start: number;
  /** Byte offset right after the section */
  end: number;
}

/** Why the walk stopped early, in a never-seen part after the player items. */
export interface CharacterIncomplete {
  /** The section the walk stopped in */
  section: CharacterSectionName;
  message: string;
  unverified: UnverifiedFeature;
}

export interface CharacterFile {
  /** Save format revision (0x44520005 for every ESR version seen) */
  version: number;
  fileSize: number;
  checksum: number;

  name: string;
  classId: number;
  className: string;
  level: number;
  /** Unix seconds */
  lastSavedAt: number;
  /** 0 set I, 1 set II active; the raw byte */
  activeWeapon: 0 | 1;
  /** Status byte of the flags field (raw) */
  status: number;
  /** Progression byte of the flags field (raw) */
  progression: number;
  /** Game version byte (3 = Reign of the Warlock; ESR saves always carry it) */
  gameVersion: number;
  /** The difficulty and act the character is in (header 0x98), with the progression byte (see progress.ts) */
  progress: CharacterProgress;
  /** The quest words per difficulty with the flags the sheet reads; null when the quest section is too short for them */
  quests: CharacterQuests | null;

  /** Every `gf` entry, in file order */
  attributes: CharacterStat[];
  /** The vanilla stats by name */
  baseAttributes: BaseAttributes;
  /** Hard skill points, one entry per skill of the class, in skills.txt row order */
  skills: CharacterSkillPoints[];
  /** The 16 hotkey slots */
  hotkeys: SkillBinding[];
  handSkills: HandSkills;
  /** Null when no merc was ever hired (merc seed 0) */
  mercenary: MercenaryHeader | null;

  items: {
    player: CharacterItem[];
    corpses: CorpseItems[];
    merc: CharacterItem[];
    golem: CharacterItem | null;
  };
  gear: EquippedGear;
  mercGear: EquippedGear;
  summons: SavedSummon[];

  /** Every section walked, in file order */
  sections: CharacterSectionRange[];
  /** Null on a full parse. Otherwise the walk stopped there: what comes after it (merc gear, golem, summons …) stayed empty */
  incomplete: CharacterIncomplete | null;
}
