import { descendingKeysetFilter, type KeysetColumn } from '@/core/supabase/query';
import type { Json, LootFilterRow } from '@/core/supabase/types';
import { LANGUAGES, type FilterText } from '../engine/types';
import type { SharedFilterDetail, SharedFilterLevel, SharedFilterSort, SharedFilterSummary } from './types';

export { isUuid } from '@/core/supabase/query';

// Embeds the author profile. The FK hint is required: loot_filter_likes gives PostgREST a second (many-to-many) path
// from loot_filters to profiles, so a bare `profiles` embed errors with PGRST201.
const AUTHOR_EMBED = 'profiles!loot_filters_user_id_fkey(display_name, discriminator, avatar_url)';

/** Every column the cards show. Never `content`: a file is up to 2 MB and only the detail page needs it. */
export const SHARED_FILTER_LIST_COLUMNS = [
  'id',
  'user_id',
  'name',
  'description',
  'is_private',
  'title',
  'author',
  'file_version',
  'rule_count',
  'levels',
  'esr_version',
  'plugin_version',
  'esr_version_updated',
  'plugin_version_updated',
  'change_note',
  'based_on_id',
  'based_on_revision',
  'based_on_template',
  'based_on_version',
  'based_on_label',
  'revision',
  'likes_count',
  'download_count',
  'created_at',
  'updated_at',
] as const satisfies readonly (keyof LootFilterRow)[];

/** The list select: the card columns and the author. */
export const SHARED_FILTER_LIST_SELECT = `${SHARED_FILTER_LIST_COLUMNS.join(', ')}, ${AUTHOR_EMBED}`;

/** The detail select: the list columns, the file and the author. */
export const SHARED_FILTER_DETAIL_SELECT = `${SHARED_FILTER_LIST_COLUMNS.join(', ')}, content, ${AUTHOR_EMBED}`;

/** The source-revision lookup behind "Update available" on copies. */
export const SOURCE_REVISION_SELECT = 'id, revision, change_note, name';

/** Keyset cursor: the sort-relevant fields of the last filter on the current page. */
export interface SharedFilterCursor {
  readonly likesCount: number;
  readonly downloadCount: number;
  readonly createdAt: string;
  readonly id: string;
}

export function cursorFromSummary(item: SharedFilterSummary): SharedFilterCursor {
  return { likesCount: item.likes_count, downloadCount: item.download_count, createdAt: item.created_at, id: item.id };
}

type SortColumn = 'likes_count' | 'download_count' | 'created_at' | 'id';

/** The `order by` columns of a sort, all descending. Newest is `(created_at, id)`; the others put their count first. */
export function sortColumns(sort: SharedFilterSort): readonly SortColumn[] {
  if (sort === 'most_liked') return ['likes_count', 'created_at', 'id'];
  if (sort === 'most_downloaded') return ['download_count', 'created_at', 'id'];
  return ['created_at', 'id'];
}

/** The PostgREST `.or()` condition for the page after `cursor` in the order of `sort`. */
export function sharedFilterCursorFilter(sort: SharedFilterSort, cursor: SharedFilterCursor): string {
  const values: Readonly<Record<SortColumn, string | number>> = {
    likes_count: cursor.likesCount,
    download_count: cursor.downloadCount,
    created_at: cursor.createdAt,
    id: cursor.id,
  };
  return descendingKeysetFilter(sortColumns(sort).map((column): KeysetColumn => ({ column, value: values[column] })));
}

/** The `ilike` pattern of a name search (a substring match, as on the builds list), or null when the box is empty. */
export function nameSearchPattern(searchText: string): string | null {
  const trimmed = searchText.trim();
  return trimmed.length > 0 ? `%${trimmed}%` : null;
}

/** A level name as stored: a string, or a per-language object of strings (non-string entries dropped). */
function readLevelName(name: Json | undefined): FilterText | undefined {
  if (typeof name === 'string') return name;
  if (typeof name !== 'object' || name === null || Array.isArray(name)) return undefined;
  const text: Record<string, string> = {};
  for (const [language, value] of Object.entries(name)) {
    if (typeof value === 'string' && (LANGUAGES as readonly string[]).includes(language)) text[language] = value;
  }
  return Object.keys(text).length > 0 ? text : undefined;
}

/**
 * Reads the `levels` column defensively: rows are written by clients, so anything that is not a list of `{ id: number,
 * name: string | { enUS: string, … } }` is dropped (a list left empty becomes null) rather than reaching the cards.
 */
export function readLevels(value: Json | null | undefined): SharedFilterLevel[] | null {
  if (!Array.isArray(value)) return null;
  const levels: SharedFilterLevel[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const { id } = entry;
    const name = readLevelName(entry.name);
    if (typeof id === 'number' && Number.isFinite(id) && name !== undefined) levels.push({ id, name });
  }
  return levels.length > 0 ? levels : null;
}

/** A level as the `levels` column stores it (a per-language name as an object). */
export function levelJson(level: SharedFilterLevel): Json {
  return { id: level.id, name: typeof level.name === 'string' ? level.name : { ...level.name } };
}

/** A list row as PostgREST returns it (levels still raw JSON). */
export type SharedFilterListRow = Omit<SharedFilterSummary, 'levels'> & { readonly levels: Json | null };
/** A detail row as PostgREST returns it. */
export type SharedFilterDetailRow = SharedFilterListRow & { readonly content: string };

export function toSharedFilterSummary(row: SharedFilterListRow): SharedFilterSummary {
  return { ...row, levels: readLevels(row.levels) };
}

export function toSharedFilterDetail(row: SharedFilterDetailRow): SharedFilterDetail {
  return { ...row, levels: readLevels(row.levels) };
}

/** The table row of a fetched filter (without the embedded author), as the editor's `openSaved` / `saveSucceeded` take it. */
export function detailToRow(detail: SharedFilterDetail): LootFilterRow {
  const { profiles: _profiles, levels, ...row } = detail;
  return { ...row, levels: levels === null ? null : levels.map(levelJson) };
}
