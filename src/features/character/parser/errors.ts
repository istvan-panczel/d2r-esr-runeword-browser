/** A section of a character save, in file order. */
export type CharacterSectionName =
  | 'header'
  | 'quests'
  | 'waypoints'
  | 'npc'
  | 'attributes'
  | 'skills'
  | 'player-items'
  | 'corpses'
  | 'merc-items'
  | 'golem'
  | 'bound-demon'
  | 'summons';

/** Parts of the format no real save has exercised yet (see docs/features/CHARACTER-SAVE.md) */
export type UnverifiedFeature = 'corpse' | 'golem' | 'bound-demon' | 'ear';

export type CharacterParseReason =
  | 'bad-magic'
  | 'unsupported-version'
  | 'size-mismatch'
  | 'checksum-mismatch'
  | 'truncated'
  | 'section-boundary'
  | 'unknown-stat'
  | 'unknown-class'
  | 'skill-count-mismatch'
  | 'invalid-value'
  | 'item'
  | 'unsupported-block'
  | 'trailing-bytes';

export interface CharacterParseErrorDetails {
  section: CharacterSectionName;
  /** Byte offset of the failure from the start of the file; null when the failure is in an item's bits (see `bitOffset`) */
  byteOffset: number | null;
  /** Bit offset where reading failed, for failures inside the bit-packed `gf` section and items */
  bitOffset: number | null;
  /** Index of the failing item in its list; null outside an item list */
  item: number | null;
  /** Where in the item tree: "item 12", "item 12 › socket 1" */
  path: string | null;
  /** Item code when it was read before the failure */
  code: string | null;
  /** Set when the failure is in, or right after, a part of the format no real save has exercised yet */
  unverified: UnverifiedFeature | null;
}

/** A structural failure reading a .d2s, with the failure point. parseCharacter turns some into `incomplete` (see there). */
export class CharacterParseError extends Error {
  readonly reason: CharacterParseReason;
  readonly details: CharacterParseErrorDetails;

  constructor(
    reason: CharacterParseReason,
    message: string,
    details: Partial<CharacterParseErrorDetails> & { section: CharacterSectionName }
  ) {
    const full: CharacterParseErrorDetails = {
      byteOffset: null,
      bitOffset: null,
      item: null,
      path: null,
      code: null,
      unverified: null,
      ...details,
    };
    const where = [
      full.section,
      full.path,
      full.code === null ? null : `(${full.code})`,
      full.byteOffset === null ? null : `byte ${String(full.byteOffset)}`,
      full.bitOffset === null ? null : `bit ${String(full.bitOffset)}`,
    ]
      .filter((part) => part !== null)
      .join(' ');
    const suffix = full.unverified === null ? '' : ` [${full.unverified}: no real save has exercised this part of the format]`;
    super(`${where}: ${message}${suffix}`);
    this.name = 'CharacterParseError';
    this.reason = reason;
    this.details = full;
  }
}

export type D2rlParseReason = 'bad-magic' | 'unsupported-version' | 'size-mismatch' | 'truncated' | 'invalid-string';

/** The optional `.d2rl` sidecar could not be read. Callers ignore the sidecar then: it must never block a save. */
export class D2rlParseError extends Error {
  readonly reason: D2rlParseReason;
  readonly byteOffset: number;

  constructor(reason: D2rlParseReason, message: string, byteOffset: number) {
    super(`.d2rl byte ${String(byteOffset)}: ${message}`);
    this.name = 'D2rlParseError';
    this.reason = reason;
    this.byteOffset = byteOffset;
  }
}
