import type { LootFilterInsert, LootFilterRow } from '@/core/supabase/types';
import { parseLootFilter } from '../engine/parse';
import type { LootFilterBasedOn, LootFilterEntry } from '../store/types';
import { TEMPLATE_ID, TEMPLATE_NAME, TEMPLATE_VERSION } from './template';

type BasedOnColumns = Pick<
  LootFilterInsert,
  'based_on_id' | 'based_on_revision' | 'based_on_template' | 'based_on_version' | 'based_on_label'
>;

/** `basedOn` of a filter started from the bundled template at `version` (default: the bundled one; null: unknown). */
export function templateBasedOn(version: string | null = TEMPLATE_VERSION): LootFilterBasedOn {
  return version === null
    ? { template: TEMPLATE_ID, label: TEMPLATE_NAME }
    : { template: TEMPLATE_ID, version, label: `${TEMPLATE_NAME} v${version}` };
}

/**
 * `basedOn` for an old `source: 'template'` draft written before drafts recorded it: the template at the file's own
 * `version` (none when the text cannot be read or has no version).
 */
export function inferTemplateBasedOn(text: string): LootFilterBasedOn {
  let version: string | undefined;
  try {
    version = parseLootFilter(text).filter.version;
  } catch {
    version = undefined;
  }
  return templateBasedOn(version === undefined || version === '' ? null : version);
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

/** `basedOn` as the `based_on_*` columns (all null for none). */
export function basedOnColumns(basedOn: LootFilterBasedOn | null): Required<BasedOnColumns> {
  return {
    based_on_id: basedOn?.id ?? null,
    based_on_revision: basedOn?.revision ?? null,
    based_on_template: basedOn?.template ?? null,
    based_on_version: basedOn?.version ?? null,
    based_on_label: basedOn?.label ?? null,
  };
}
