import type { Diagnostic, LootFilter } from '../engine/types';

export type LootFilterSource = 'blank' | 'upload' | 'template';

/**
 * Where a filter came from: a shared filter it was copied from (`id`, `revision`) or a bundled template (`template`,
 * `version`). `label` ("Sully's QoL Filter v0.6.11", "X by Y#1234") stays when the source is gone. Mirrors the
 * `based_on_*` columns of `loot_filters`.
 */
export interface LootFilterBasedOn {
  readonly id?: string;
  readonly revision?: number;
  readonly template?: string;
  readonly version?: string;
  readonly label: string;
}

/**
 * One draft in this browser (the localStorage library). `text` (the filter file as serialized) is the source of truth;
 * the editor's model is derived from it. A draft is a new, never-saved filter (no `savedId`) or the unsaved edits of a
 * saved filter (`savedId`). The `saved*` and `basedOn` fields are optional so that older tabs still read the library.
 */
export interface LootFilterEntry {
  readonly id: string;
  /** The library name (not the file's `title`). */
  readonly name: string;
  readonly source: LootFilterSource;
  /** Epoch milliseconds */
  readonly createdAt: number;
  /** Epoch milliseconds */
  readonly updatedAt: number;
  readonly text: string;
  /** The saved filter (`loot_filters.id`) this draft edits. */
  readonly savedId?: string;
  /** That filter's owner: drafts of another account are hidden while it is signed in. */
  readonly savedOwnerId?: string;
  /** The saved filter's revision the draft started from (Save compares and swaps on it). */
  readonly savedRevision?: number;
  readonly basedOn?: LootFilterBasedOn;
}

export interface LootFilterLibraryState {
  /** False until the saga has read the library from localStorage. */
  readonly hydrated: boolean;
  readonly entries: readonly LootFilterEntry[];
}

/**
 * What the editor is editing:
 * - `draft`: a library entry (a new filter, or any entry opened from the library list); the flush writes the entry.
 * - `saved`: the signed-in owner's saved filter. Edits go to the draft `draftId` (created on the first flush, removed
 *   when the model serializes to `baseCanonical` again); `baseText` is the saved `content`.
 * - `sandbox`: someone else's filter or the bundled template, on a temporary copy; nothing is ever written.
 */
export type EditorTarget =
  | { readonly kind: 'draft'; readonly entryId: string }
  | {
      readonly kind: 'saved';
      readonly savedId: string;
      /** The saved filter's current revision (what a draft created from now on starts from). */
      readonly revision: number;
      readonly ownerId: string;
      /** The saved filter's name (a server field); a draft created for it takes this name. */
      readonly name: string;
      /** The saved content, verbatim. */
      readonly baseText: string;
      /** `serializeLootFilter(parse(baseText))`, computed once; null when the content cannot be read. */
      readonly baseCanonical: string | null;
      /** The draft holding the unsaved edits: the existing one, or the id a new one gets. */
      readonly draftId: string;
      /** The saved filter's `based_on_*`, which a new draft records (Replace with the latest moves it on). */
      readonly basedOn: LootFilterBasedOn | null;
    }
  | {
      readonly kind: 'sandbox';
      /** The shared filter shown, or null for the bundled template. */
      readonly savedId: string | null;
      readonly revision: number | null;
      readonly ownerId: string | null;
      readonly name: string;
      readonly baseText: string;
      /** What Copy to my filters records: set only for someone else's public filter, or the template. */
      readonly basedOn: LootFilterBasedOn | null;
    };

export type EditorTargetKind = EditorTarget['kind'];

export interface LootFilterEditorState {
  /** What is open, or null when no filter is open. */
  readonly target: EditorTarget | null;
  /** The parsed model; null when nothing is open or the entry's text is not valid JSON. */
  readonly filter: LootFilter | null;
  /** Diagnostics from the last parse (open or JSON-tab apply); a syntax error is one error with an empty path. */
  readonly parseDiagnostics: readonly Diagnostic[];
  /**
   * Warnings about the entry's text itself (accepted trailing commas and block comments, comments after the opening
   * brace that are dropped), from `textNotes`. Kept until the model is serialized back into the entry: the written text
   * no longer has them. Not set for template entries.
   */
  readonly textNotes: readonly Diagnostic[];
  readonly selectedRule: number | null;
  /**
   * True when the model has edits not yet written back (draft: to the entry's `text`; saved: to its draft). The
   * sandbox never writes, so there it means "edited since it was opened".
   */
  readonly dirty: boolean;
}

export interface LootFilterState {
  readonly library: LootFilterLibraryState;
  readonly editor: LootFilterEditorState;
}
