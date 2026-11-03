export interface StashParseErrorDetails {
  /** Stash section (tab), 0-based; null when the file header itself is wrong */
  section: number | null;
  /** Item index in the section; null for section-level errors */
  item: number | null;
  /** Where in the item tree: "item 12", "item 12 › socket 1" */
  path: string | null;
  /** Item code when it was read before the failure */
  code: string | null;
  /** Bit offset of the failing item's first bit (or of the section), from the start of the file */
  itemBitOffset: number | null;
  /** Bit offset where reading failed */
  bitOffset: number;
}

/** Any failure to read a stash file, with where it happened. */
export class StashParseError extends Error {
  readonly details: StashParseErrorDetails;

  constructor(reason: string, details: StashParseErrorDetails) {
    const where = [
      details.section === null ? null : `section ${String(details.section)}`,
      details.path,
      details.code === null ? null : `(${details.code})`,
      `bit ${String(details.bitOffset)}`,
    ]
      .filter((part) => part !== null)
      .join(' ');
    super(`${where}: ${reason}`);
    this.name = 'StashParseError';
    this.details = details;
  }
}

export type UnsupportedStashReason = 'not-a-stash' | 'legacy' | 'retail' | 'unknown-version';

/** The file is not a stash the parser supports (wrong magic, the legacy stash, a retail D2R save, …). */
export class UnsupportedStashError extends Error {
  readonly reason: UnsupportedStashReason;

  constructor(reason: UnsupportedStashReason, message: string) {
    super(message);
    this.name = 'UnsupportedStashError';
    this.reason = reason;
  }
}
