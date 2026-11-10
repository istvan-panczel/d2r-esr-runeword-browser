import type { LootFilterInsert, LootFilterRow } from '@/core/supabase/types';
import { parseLootFilter } from '../engine/parse';
import type { LootFilterBasedOn, LootFilterEntry } from '../store/types';
import { checkFilterText } from './readFilterText';
import { BUNDLED_TEMPLATES, EXAMPLE_TEMPLATE, SULLYS_QOL_TEMPLATE, type BundledTemplateId } from './template';

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

/** `basedOn` of a filter started from a bundled template at `version` (the version of the text it started from; null: unknown). */
export function templateBasedOn(id: BundledTemplateId, version: string | null): LootFilterBasedOn {
  const { name } = BUNDLED_TEMPLATES[id];
  return version === null ? { template: id, label: name } : { template: id, version, label: `${name} v${version}` };
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

/** Folds case and outer spaces for comparing a file's title or author. */
function fold(text: string | undefined): string {
  return text?.trim().toLowerCase() ?? '';
}

/** The bundled template a file is, by its `title` (or Sully's `author`); null when it names none of them. */
export function templateOfFile(title: string | undefined, author: string | undefined): BundledTemplateId | null {
  if (fold(title) === fold(SULLYS_QOL_TEMPLATE.name) || fold(author) === fold(SULLYS_QOL_TEMPLATE.author)) return SULLYS_QOL_TEMPLATE.id;
  if (fold(title) === fold(EXAMPLE_TEMPLATE.name)) return EXAMPLE_TEMPLATE.id;
  return null;
}

/**
 * `basedOn` for an old `source: 'template'` draft written before drafts recorded it (only Sully's filter was bundled
 * then): the template the file names (Sully's by its title or author, the example by its title; null for neither or
 * when the text cannot be read), at the file's own `version` when that looks like a template version (else of unknown
 * version).
 */
export function inferTemplateBasedOn(text: string): LootFilterBasedOn | null {
  let file: { readonly title?: string; readonly author?: string; readonly version?: string };
  try {
    file = parseLootFilter(text).filter;
  } catch {
    return null;
  }
  const id = templateOfFile(file.title, file.author);
  return id === null ? null : templateBasedOn(id, templateVersionOf(file.version));
}

/** What Start from a bundled template adds to the library (`importText`'s input). */
export interface TemplateStartInput {
  readonly name: string;
  readonly text: string;
  readonly source: 'template';
  readonly basedOn: LootFilterBasedOn;
}

/**
 * The draft that Start from a bundled template adds: named after the template, recording it at the version of the
 * text it starts from (a `TemplateSource` of `loadTemplate`). Throws when the text cannot be read as a filter (a broken
 * deploy or an HTML error page).
 */
export function templateStartInput(source: {
  readonly id: BundledTemplateId;
  readonly text: string;
  readonly version: string | null;
}): TemplateStartInput {
  const check = checkFilterText(source.text);
  if (!check.ok) throw new Error(check.message);
  return {
    name: BUNDLED_TEMPLATES[source.id].name,
    text: source.text,
    source: 'template',
    basedOn: templateBasedOn(source.id, source.version),
  };
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
