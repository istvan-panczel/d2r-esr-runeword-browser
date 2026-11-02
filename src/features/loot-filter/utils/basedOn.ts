import type { LootFilterInsert, LootFilterRow } from '@/core/supabase/types';
import { parseLootFilter } from '../engine/parse';
import type { LootFilterBasedOn, LootFilterEntry } from '../store/types';
import { TEMPLATE_ID, TEMPLATE_NAME, TEMPLATE_VERSION } from './template';

type BasedOnColumns = Pick<
  LootFilterInsert,
  'based_on_id' | 'based_on_revision' | 'based_on_template' | 'based_on_version' | 'based_on_label'
>;

// The `loot_filters_based_on_len` check constraint (characters, as Postgres' char_length counts them).
export const BASED_ON_VERSION_MAX_LENGTH = 50;
export const BASED_ON_LABEL_MAX_LENGTH = 200;

/** A template version as the bundled files write it ("0.6.11", optionally "v0.6.11"): one to four numeric parts. */
const TEMPLATE_VERSION_PATTERN = /^v?\d{1,10}(\.\d{1,10}){0,3}$/i;

/** `text` cut to `max` characters (code points, so a surrogate pair is never split). */
function clip(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length <= max ? text : characters.slice(0, max).join('');
}

/** `basedOn` of a filter started from the bundled template at `version` (default: the bundled one; null: unknown). */
export function templateBasedOn(version: string | null = TEMPLATE_VERSION): LootFilterBasedOn {
  return version === null
    ? { template: TEMPLATE_ID, label: TEMPLATE_NAME }
    : { template: TEMPLATE_ID, version, label: `${TEMPLATE_NAME} v${version}` };
}

/**
 * A file's `version` as a template version ("v0.6.3" → "0.6.3"), or null when it does not look like one (a file can
 * hold any text there; only a dotted number is compared with the bundled version and saved as `based_on_version`).
 */
export function templateVersionOf(version: string | undefined): string | null {
  const trimmed = version?.trim() ?? '';
  if (trimmed.length > BASED_ON_VERSION_MAX_LENGTH || !TEMPLATE_VERSION_PATTERN.test(trimmed)) return null;
  return trimmed.replace(/^v/i, '');
}

/**
 * `basedOn` for an old `source: 'template'` draft written before drafts recorded it: the template at the file's own
 * `version` when that looks like a template version (else of unknown version, as when the text cannot be read).
 */
export function inferTemplateBasedOn(text: string): LootFilterBasedOn {
  let version: string | undefined;
  try {
    version = parseLootFilter(text).filter.version;
  } catch {
    version = undefined;
  }
  return templateBasedOn(templateVersionOf(version));
}

/** A draft's `basedOn`, inferred for old template drafts that do not record one. */
export function entryBasedOn(entry: LootFilterEntry): LootFilterBasedOn | null {
  if (entry.basedOn) return entry.basedOn;
  return entry.source === 'template' ? inferTemplateBasedOn(entry.text) : null;
}

/** What a copy of a shared filter records: "name by author". */
export function sharedBasedOn(row: Pick<LootFilterRow, 'id' | 'revision' | 'name'>, authorLabel: string): LootFilterBasedOn {
  return { id: row.id, revision: row.revision, label: `${row.name} by ${authorLabel}` };
}

/** A saved filter's `based_on_*` columns as `basedOn`; null when it was not based on anything. */
export function basedOnFromRow(row: Pick<LootFilterRow, keyof BasedOnColumns>): LootFilterBasedOn | null {
  if (row.based_on_label === null) return null;
  return {
    ...(row.based_on_id === null ? {} : { id: row.based_on_id }),
    ...(row.based_on_revision === null ? {} : { revision: row.based_on_revision }),
    ...(row.based_on_template === null ? {} : { template: row.based_on_template }),
    ...(row.based_on_version === null ? {} : { version: row.based_on_version }),
    label: row.based_on_label,
  };
}

/**
 * `basedOn` as the `based_on_*` columns (all null for none), within the column limits: the label is clipped and a
 * version longer than its column is left out (a cut version would compare wrongly).
 */
export function basedOnColumns(basedOn: LootFilterBasedOn | null): Required<BasedOnColumns> {
  const version = basedOn?.version ?? null;
  return {
    based_on_id: basedOn?.id ?? null,
    based_on_revision: basedOn?.revision ?? null,
    based_on_template: basedOn?.template ?? null,
    based_on_version: version !== null && Array.from(version).length <= BASED_ON_VERSION_MAX_LENGTH ? version : null,
    based_on_label: basedOn ? clip(basedOn.label, BASED_ON_LABEL_MAX_LENGTH) : null,
  };
}
