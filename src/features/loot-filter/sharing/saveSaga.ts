/**
 * The editor's writes to Supabase: Save (insert a new filter, or a compare-and-swap update of a saved one), the Details
 * dialog (name, description, Private) and the fetch of a copy's source for "Update available". Forked from
 * `lootFilterSharingSaga`; the editor state (drafts, target) stays in the loot filter slice, which these handlers read
 * and update through its actions.
 */
import { call, put, select } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { toast } from 'sonner';
import { db } from '@/core/db';
import type { Metadata } from '@/core/db';
import { requireSupabase } from '@/core/supabase';
import type { LootFilterInsert, LootFilterUpdate } from '@/core/supabase/types';
import { openSignInDialog, selectAuthUserId, selectNeedsConsent } from '@/features/auth/store/authSlice';
import { parseLootFilter } from '../engine/parse';
import { flushNow, saveSucceeded, savedFilterRenamed } from '../store/lootFilterSlice';
import { selectEditorTarget, selectSaveRequest, type LootFilterSaveRequest } from '../store/selectors';
import type { EditorTarget, LootFilterBasedOn } from '../store/types';
import { basedOnColumns } from '../utils/basedOn';
import { LOOT_FILTER_PLUGIN_VERSION } from '../utils/template';
import { CHANGE_NOTE_MAX_LENGTH, FILTER_CONTENT_MAX_BYTES, FILTER_DESCRIPTION_MAX_LENGTH, FILTER_NAME_MAX_LENGTH } from './constants';
import { filterMetadata } from './filterMetadata';
import {
  SHARED_FILTER_DETAIL_SELECT,
  SHARED_FILTER_LIST_SELECT,
  detailToRow,
  isUuid,
  levelJson,
  toSharedFilterDetail,
  toSharedFilterSummary,
  type SharedFilterDetailRow,
  type SharedFilterListRow,
} from './sharingQuery';
import {
  fetchSourceFilterFailed,
  fetchSourceFilterSucceeded,
  saveFilterCancelled,
  saveFilterFailed,
  saveFilterSucceeded,
  selectSourceRevisions,
  updateFilterDetailsFailed,
  updateFilterDetailsSucceeded,
  type SaveConflict,
  type SaveFilterRequest,
  type SharedFilterDetails,
  type UpdateFilterDetailsRequest,
} from './sharingSlice';
import type { SharedFilterDetail, SourceRevision } from './types';

interface QueryError {
  readonly message: string;
  readonly code?: string;
}

/** Postgres `foreign_key_violation`: here, a `based_on_id` whose row was deleted. */
const FOREIGN_KEY_VIOLATION = '23503';

export const LOOT_FILTER_LIMIT_MESSAGE = 'You have 50 loot filters; delete one to save another.';
export const CONSENT_REQUIRED_MESSAGE = 'Accept the privacy policy first (it opens after signing in).';
export const SAVE_CONFLICT_MESSAGES: Readonly<Record<SaveConflict, string>> = {
  changed: 'This filter was changed in another tab or browser since you opened it.',
  gone: 'This filter no longer exists, or it is not yours any more.',
};

const encoder = new TextEncoder();

/** Characters as Postgres' `char_length` counts them (code points). */
function characterCount(text: string): number {
  return Array.from(text).length;
}

/**
 * Why `text` cannot be saved, or null when it can: it must fit the 512 KB column, the lenient reader must read it and
 * it must be a loot filter object with `formatVersion` 1. Validator errors and warnings do not block a save.
 */
export function checkSaveText(text: string): string | null {
  if (encoder.encode(text).length > FILTER_CONTENT_MAX_BYTES)
    return 'The filter file is larger than 512 KB, the most a saved filter can hold.';
  let diagnostics;
  try {
    diagnostics = parseLootFilter(text).diagnostics;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `The filter cannot be read: ${message}. Fix it in the JSON tab first.`;
  }
  const notAFilter = diagnostics.some((item) => item.severity === 'error' && (item.path === '' || item.path === 'formatVersion'));
  return notAFilter ? 'Only loot filter files with "formatVersion": 1 can be saved. Fix it in the JSON tab first.' : null;
}

/** Why the name or description cannot be saved, or null. */
export function checkDetails(details: Pick<SharedFilterDetails, 'name' | 'description'>): string | null {
  const name = details.name.trim();
  if (name === '') return 'Give the filter a name.';
  if (characterCount(name) > FILTER_NAME_MAX_LENGTH) return `The name can be up to ${String(FILTER_NAME_MAX_LENGTH)} characters.`;
  if (characterCount(details.description.trim()) > FILTER_DESCRIPTION_MAX_LENGTH)
    return `The description can be up to ${String(FILTER_DESCRIPTION_MAX_LENGTH)} characters.`;
  return null;
}

/** Trimmed text, null when empty. */
function textOrNull(text: string | undefined): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Whether a draft's `basedOn` moved on from the saved filter's (an update taken): the columns Save then writes. */
export function basedOnMoved(next: LootFilterBasedOn | null, previous: LootFilterBasedOn | null | undefined): boolean {
  if (next === null) return false;
  if (previous === undefined || previous === null) return true;
  return next.revision !== previous.revision || next.version !== previous.version || next.label !== previous.label;
}

/** The message shown for a failed write: the cap trigger's `loot_filter_limit` reads as the 50-filter limit. */
export function saveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('loot_filter_limit')) return LOOT_FILTER_LIMIT_MESSAGE;
  return message === '' ? 'Could not save the filter. Please try again.' : `Could not save the filter: ${message}`;
}

function* readEsrVersion() {
  try {
    const meta = (yield call(() => db.metadata.get('esrVersion'))) as Metadata | undefined;
    return meta?.value ?? null;
  } catch {
    return null;
  }
}

/** The file columns of `text` (already checked by `checkSaveText`). */
function metadataColumns(text: string) {
  const { levels, ...metadata } = filterMetadata(text);
  return { ...metadata, levels: levels === null ? null : levels.map(levelJson) };
}

function* finishSave(request: LootFilterSaveRequest, row: SharedFilterDetail, inserted: boolean) {
  // The save status and detail first, then the editor target: the editor screen reads "the target is the row just
  // saved" as the open filter moving to its new route (not another filter being opened).
  yield put(saveFilterSucceeded({ row, inserted }));
  yield put(saveSucceeded({ sentText: request.text, row: detailToRow(row), entryId: request.entryId }));
  yield call(toast.success, inserted ? 'Loot filter saved.' : 'Changes saved.');
}

/**
 * The `based_on_*` columns an insert writes: the draft's `basedOn`, without `based_on_id` when the source lookup found
 * the source gone (deleted or private now): a deleted id would fail the foreign key. The label, revision and version
 * stay, so the copy reads "The original is no longer shared".
 */
export function insertBasedOnColumns(
  basedOn: LootFilterBasedOn | null,
  sourceRevisions: Readonly<Record<string, SourceRevision | null>>
): ReturnType<typeof basedOnColumns> {
  const columns = basedOnColumns(basedOn);
  return columns.based_on_id !== null && sourceRevisions[columns.based_on_id] === null ? { ...columns, based_on_id: null } : columns;
}

function* insertFilter(request: LootFilterSaveRequest, userId: string, details: SharedFilterDetails | undefined) {
  const fields = details ?? { name: request.name, description: '', isPrivate: false };
  const problem = checkDetails(fields);
  if (problem !== null) {
    yield put(saveFilterFailed({ error: problem }));
    return;
  }
  const esrVersion = (yield call(readEsrVersion)) as string | null;
  const sourceRevisions = (yield select(selectSourceRevisions)) as Readonly<Record<string, SourceRevision | null>>;
  const basedOn = insertBasedOnColumns(request.basedOn, sourceRevisions);
  const row: LootFilterInsert = {
    user_id: userId,
    name: fields.name.trim(),
    description: textOrNull(fields.description),
    content: request.text,
    is_private: fields.isPrivate,
    ...metadataColumns(request.text),
    esr_version: esrVersion,
    plugin_version: LOOT_FILTER_PLUGIN_VERSION,
    change_note: null,
    // The store records `basedOn` only for someone else's public filter or the bundled template.
    ...basedOn,
  };
  const client = requireSupabase();
  const insert = (values: LootFilterInsert) => client.from('loot_filters').insert(values).select(SHARED_FILTER_DETAIL_SELECT).single();
  type InsertResult = { data: SharedFilterDetailRow | null; error: QueryError | null };
  let { data, error } = (yield call(insert, row)) as InsertResult;
  // The source was deleted since it was looked up (or never was): save the copy without the link, once.
  if (error?.code === FOREIGN_KEY_VIOLATION && basedOn.based_on_id !== null) {
    console.warn('[LootFilterSharing] The original filter no longer exists; saving the copy without its link');
    ({ data, error } = (yield call(insert, { ...row, based_on_id: null })) as InsertResult);
  }
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('The server returned no row.');
  yield call(finishSave, request, toSharedFilterDetail(data), true);
}

function* updateFilter(
  request: LootFilterSaveRequest,
  savedId: string,
  userId: string,
  overwrite: boolean,
  changeNote: string | undefined
) {
  const note = textOrNull(changeNote);
  if (note !== null && characterCount(note) > CHANGE_NOTE_MAX_LENGTH) {
    yield put(saveFilterFailed({ error: `The note can be up to ${String(CHANGE_NOTE_MAX_LENGTH)} characters.` }));
    return;
  }
  const esrVersion = (yield call(readEsrVersion)) as string | null;
  const target = (yield select(selectEditorTarget)) as EditorTarget | null;
  // The saved filter's own `based_on_*`, when the editor is on it; unknown (a draft opened on its own) otherwise.
  const previousBasedOn = target?.kind === 'saved' && target.savedId === savedId ? target.basedOn : undefined;
  const moved = basedOnMoved(request.basedOn, previousBasedOn);
  const columns = basedOnColumns(request.basedOn);
  const update: LootFilterUpdate = {
    content: request.text,
    ...metadataColumns(request.text),
    esr_version_updated: esrVersion,
    plugin_version_updated: LOOT_FILTER_PLUGIN_VERSION,
    change_note: note,
    ...(moved && request.basedOn !== null
      ? {
          based_on_revision: columns.based_on_revision,
          based_on_version: columns.based_on_version,
          based_on_label: columns.based_on_label,
        }
      : {}),
  };
  const client = requireSupabase();
  let query = client.from('loot_filters').update(update).eq('id', savedId);
  // Compare and swap: the row must still be at the revision the draft started from.
  if (!overwrite && request.expectedRevision !== null) query = query.eq('revision', request.expectedRevision);
  const { data, error } = (yield call(() => query.select(SHARED_FILTER_DETAIL_SELECT))) as {
    data: SharedFilterDetailRow[] | null;
    error: QueryError | null;
  };
  if (error) throw new Error(error.message);
  const written = data?.[0];
  if (written !== undefined) {
    yield call(finishSave, request, toSharedFilterDetail(written), false);
    return;
  }
  // No row matched: changed since (still the viewer's) or gone (deleted, or not the viewer's).
  const { data: existing, error: lookupError } = (yield call(() =>
    client.from('loot_filters').select('id, user_id').eq('id', savedId).maybeSingle()
  )) as { data: { id: string; user_id: string } | null; error: QueryError | null };
  if (lookupError) throw new Error(lookupError.message);
  const conflict: SaveConflict = !overwrite && existing !== null && existing.user_id === userId ? 'changed' : 'gone';
  yield put(saveFilterFailed({ error: SAVE_CONFLICT_MESSAGES[conflict], conflict }));
}

/**
 * Save: signed in (else the sign-in dialog opens) with the privacy policy accepted. Flushes the pending edit, reads the
 * save request (nothing to save without one), checks the file, then inserts (a new filter, or `asNew`) or updates
 * (compare-and-swap on the draft's revision unless `overwrite`).
 */
export function* handleSaveFilter(action: PayloadAction<SaveFilterRequest>) {
  const { mode, details, changeNote } = action.payload;
  const userId = (yield select(selectAuthUserId)) as string | null;
  if (userId === null) {
    yield put(saveFilterCancelled());
    yield put(openSignInDialog());
    return;
  }
  if ((yield select(selectNeedsConsent)) as boolean) {
    yield put(saveFilterFailed({ error: CONSENT_REQUIRED_MESSAGE }));
    return;
  }

  // Save sends the model as it is now: write the pending (debounced) edit into the draft before reading it.
  yield put(flushNow());
  const request = (yield select(selectSaveRequest)) as LootFilterSaveRequest | null;
  if (request === null) {
    yield put(saveFilterCancelled());
    yield call(toast.info, 'No changes to save.');
    return;
  }
  const problem = checkSaveText(request.text);
  if (problem !== null) {
    yield put(saveFilterFailed({ error: problem }));
    return;
  }

  try {
    if (request.kind === 'insert' || request.savedId === null || mode === 'asNew') {
      yield call(insertFilter, request, userId, details);
    } else {
      yield call(updateFilter, request, request.savedId, userId, mode === 'overwrite', changeNote);
    }
  } catch (error) {
    console.error('[LootFilterSharing] Could not save the filter', error);
    yield put(saveFilterFailed({ error: saveErrorMessage(error) }));
  }
}

/** The Details dialog: name, description and Private, written at once (no draft, no revision bump). */
export function* handleUpdateFilterDetails(action: PayloadAction<UpdateFilterDetailsRequest>) {
  const { id, name, description, isPrivate } = action.payload;
  const userId = (yield select(selectAuthUserId)) as string | null;
  if (userId === null) {
    yield put(updateFilterDetailsFailed('Sign in to change the details.'));
    yield put(openSignInDialog());
    return;
  }
  const problem = checkDetails({ name, description });
  if (problem !== null) {
    yield put(updateFilterDetailsFailed(problem));
    return;
  }
  try {
    const client = requireSupabase();
    const { data, error } = (yield call(() =>
      client
        .from('loot_filters')
        .update({ name: name.trim(), description: textOrNull(description), is_private: isPrivate })
        .eq('id', id)
        .select(SHARED_FILTER_LIST_SELECT)
    )) as { data: SharedFilterListRow[] | null; error: QueryError | null };
    if (error) throw new Error(error.message);
    const written = data?.[0];
    if (written === undefined) {
      yield put(updateFilterDetailsFailed(SAVE_CONFLICT_MESSAGES.gone));
      return;
    }
    yield put(updateFilterDetailsSucceeded(toSharedFilterSummary(written)));
    yield put(savedFilterRenamed({ savedId: id, name: written.name }));
    yield call(toast.success, 'Details saved.');
  } catch (error) {
    console.error('[LootFilterSharing] Could not update the details', error);
    const message = error instanceof Error && error.message ? error.message : 'Please try again.';
    yield put(updateFilterDetailsFailed(`Could not save the details: ${message}`));
  }
}

/** Fetches a copy's source with its file; a source the viewer cannot see any more is `notFound`. */
export function* handleFetchSourceFilter(action: PayloadAction<string>) {
  const id = action.payload;
  if (!isUuid(id)) {
    yield put(fetchSourceFilterFailed({ id, notFound: true }));
    return;
  }
  try {
    const client = requireSupabase();
    const { data, error } = (yield call(() =>
      client.from('loot_filters').select(SHARED_FILTER_DETAIL_SELECT).eq('id', id).maybeSingle()
    )) as { data: SharedFilterDetailRow | null; error: QueryError | null };
    if (error) throw new Error(error.message);
    if (data === null) {
      yield put(fetchSourceFilterFailed({ id, notFound: true }));
      return;
    }
    yield put(fetchSourceFilterSucceeded(toSharedFilterDetail(data)));
  } catch (error) {
    console.error('[LootFilterSharing] Could not load the original filter', error);
    yield put(fetchSourceFilterFailed({ id, notFound: false }));
  }
}
