/**
 * Shape of `public/patch-notes/index.json`, written by `npm run patch-notes:generate` (also run by game-data:generate).
 *
 * Plain TS with no DOM or `@/` imports: the Node generator imports it too.
 */

export const PATCH_NOTES_SCHEMA = 1;

/** A run of text; `bold` marks `**…**` in the source markdown. */
export interface PatchNoteSpan {
  readonly text: string;
  readonly bold?: true;
}

export interface PatchNoteListItem {
  readonly spans: readonly PatchNoteSpan[];
  /** Indented bullets under this one */
  readonly items?: readonly PatchNoteListItem[];
}

export type PatchNoteBlock =
  /** A line that is bold and nothing else ("**Bug Fixes**"): the author's section headings */
  | { readonly type: 'heading'; readonly text: string }
  | { readonly type: 'list'; readonly items: readonly PatchNoteListItem[] }
  | { readonly type: 'paragraph'; readonly spans: readonly PatchNoteSpan[] };

/** item-changes: our unique and runeword change report; check: our patch notes vs game files check. */
export type PatchNoteReportKind = 'items' | 'check';

export interface PatchNoteReport {
  readonly kind: PatchNoteReportKind;
  /** Paths relative to `public/patch-notes/` */
  readonly html: string;
  /** null when only the HTML file exists */
  readonly pdf: string | null;
}

export interface PatchNoteRelease {
  readonly version: string;
  /** YYYY-MM-DD from the ESR release tag; null when the release has no tag */
  readonly date: string | null;
  /** The markdown file in the ESR repository */
  readonly sourceUrl: string;
  readonly blocks: readonly PatchNoteBlock[];
  /** Our reports for this release, in PATCH_NOTE_REPORT_KINDS order */
  readonly reports: readonly PatchNoteReport[];
}

export interface PatchNotesIndex {
  readonly schema: number;
  /** Newest first */
  readonly releases: readonly PatchNoteRelease[];
}

export const PATCH_NOTE_REPORT_KINDS: readonly PatchNoteReportKind[] = ['items', 'check'];
