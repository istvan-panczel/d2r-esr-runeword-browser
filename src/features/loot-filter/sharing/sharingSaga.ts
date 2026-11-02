import { call, fork, put, select, take, takeEvery, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { toast } from 'sonner';
import { requireSupabase } from '@/core/supabase';
import { authStateChanged, selectAuthUserId, type AuthUser } from '@/features/auth/store/authSlice';
import { LATEST_FILTERS_COUNT, MY_FILTERS_LIMIT, SHARED_FILTERS_PAGE_SIZE } from './constants';
import {
  SHARED_FILTER_DETAIL_SELECT,
  SHARED_FILTER_LIST_SELECT,
  SOURCE_REVISION_SELECT,
  cursorFromSummary,
  isUuid,
  nameSearchPattern,
  sharedFilterCursorFilter,
  sortColumns,
  toSharedFilterDetail,
  toSharedFilterSummary,
  type SharedFilterCursor,
  type SharedFilterDetailRow,
  type SharedFilterListRow,
} from './sharingQuery';
import {
  deleteSharedFilterFailed,
  deleteSharedFilterRequested,
  deleteSharedFilterSucceeded,
  downloadCounted,
  fetchAuthorFiltersFailure,
  fetchAuthorFiltersRequested,
  fetchAuthorFiltersSuccess,
  fetchLatestFiltersFailure,
  fetchLatestFiltersRequested,
  fetchLatestFiltersSuccess,
  fetchMoreAuthorFiltersFailure,
  fetchMoreAuthorFiltersRequested,
  fetchMoreSharedFiltersFailure,
  fetchMoreSharedFiltersRequested,
  fetchMyFiltersFailure,
  fetchMyFiltersRequested,
  fetchMyFiltersSuccess,
  fetchSharedFilterFailure,
  fetchSharedFilterNotFound,
  fetchSharedFilterRequested,
  fetchSharedFilterSuccess,
  fetchSharedFiltersFailure,
  fetchSharedFiltersRequested,
  fetchSharedFiltersSuccess,
  fetchSourceRevisionsFailure,
  fetchSourceRevisionsRequested,
  fetchSourceRevisionsSuccess,
  selectAuthorFiltersAuthorId,
  selectAuthorFiltersCursor,
  selectLikedFilterIds,
  selectSharedFiltersCursor,
  selectSharedFiltersSearchText,
  selectSharedFiltersSortMode,
  selectVisibleFilterIds,
  setSharedFiltersSearchText,
  setSharedFiltersSortMode,
  sharedFilterLikesLoaded,
  toggleSharedFilterLikeReverted,
  toggleSharedFilterLikeRequested,
  toggleSharedFilterLikeSettled,
  type FilterPagePayload,
} from './sharingSlice';
import type { SharedFilterSort, SharedFilterSummary, SourceRevision } from './types';

interface QueryError {
  readonly message: string;
  readonly code?: string;
}

interface ListResult {
  readonly data: SharedFilterListRow[] | null;
  readonly error: QueryError | null;
}

// Postgres unique_violation: liking a filter that is already liked (e.g. from another tab) ends liked, as wanted.
const UNIQUE_VIOLATION = '23505';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Looks up which of `filterIds` the viewer has liked and stores it. Non-fatal: signed out, nothing to check or a failed
 * lookup leave the liked state alone.
 */
function* loadLikes(filterIds: readonly string[]) {
  const viewerId = (yield select(selectAuthUserId)) as string | null;
  const checkedIds = filterIds.filter(isUuid);
  if (viewerId === null || checkedIds.length === 0) return;
  const client = requireSupabase();
  const { data, error } = (yield call(() =>
    client
      .from('loot_filter_likes')
      .select('filter_id')
      .eq('user_id', viewerId)
      .in('filter_id', [...checkedIds])
  )) as { data: { filter_id: string }[] | null; error: QueryError | null };
  if (error) {
    console.error('[LootFilterSharing] Could not load likes', error);
    return;
  }
  yield put(sharedFilterLikesLoaded({ viewerId, checkedIds, likedIds: (data ?? []).map((row) => row.filter_id) }));
}

/** Turns a fetched page into the success payload (and loads the viewer's likes on it first). */
function* toPage(result: ListResult, append: boolean, previousCursor: SharedFilterCursor | null) {
  if (result.error) throw new Error(result.error.message);
  const items: SharedFilterSummary[] = (result.data ?? []).map(toSharedFilterSummary);
  yield call(
    loadLikes,
    items.map((item) => item.id)
  );
  const last = items.at(-1);
  const page: FilterPagePayload = {
    items,
    cursor: last ? cursorFromSummary(last) : append ? previousCursor : null,
    hasMore: items.length === SHARED_FILTERS_PAGE_SIZE,
    append,
  };
  return page;
}

// --- Shared tab ---

function* fetchSharedPage(append: boolean) {
  const client = requireSupabase();
  const searchText = (yield select(selectSharedFiltersSearchText)) as string;
  const sort = (yield select(selectSharedFiltersSortMode)) as SharedFilterSort;
  const cursor = append ? ((yield select(selectSharedFiltersCursor)) as SharedFilterCursor | null) : null;

  // RLS already hides other users' private filters; the explicit filter keeps the viewer's own out of Shared.
  let query = client.from('loot_filters').select(SHARED_FILTER_LIST_SELECT).eq('is_private', false);
  const pattern = nameSearchPattern(searchText);
  if (pattern !== null) query = query.ilike('name', pattern);
  for (const column of sortColumns(sort)) query = query.order(column, { ascending: false });
  if (cursor !== null) query = query.or(sharedFilterCursorFilter(sort, cursor));
  query = query.limit(SHARED_FILTERS_PAGE_SIZE);

  const result = (yield call(() => query)) as ListResult;
  const page = (yield call(toPage, result, append, cursor)) as FilterPagePayload;
  yield put(fetchSharedFiltersSuccess(page));
}

// One watcher serves the first page and load-more, so takeLatest cancels an in-flight load-more when a refetch (a
// search or sort change) starts: its stale page is never appended to the new list.
function* handleFetchShared(action: PayloadAction) {
  const append = fetchMoreSharedFiltersRequested.match(action);
  try {
    yield call(fetchSharedPage, append);
  } catch (error) {
    const message = errorMessage(error, 'Failed to load loot filters.');
    yield put(append ? fetchMoreSharedFiltersFailure(message) : fetchSharedFiltersFailure(message));
  }
}

function* handleSharedFiltersChanged() {
  yield put(fetchSharedFiltersRequested());
}

// --- My filters ---

function* handleFetchMyFilters() {
  const userId = (yield select(selectAuthUserId)) as string | null;
  if (userId === null) {
    yield put(fetchMyFiltersFailure('Sign in to see your saved filters.'));
    return;
  }
  try {
    const client = requireSupabase();
    const { data, error } = (yield call(() =>
      client
        .from('loot_filters')
        .select(SHARED_FILTER_LIST_SELECT)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(MY_FILTERS_LIMIT)
    )) as ListResult;
    if (error) throw new Error(error.message);
    yield put(fetchMyFiltersSuccess({ userId, items: (data ?? []).map(toSharedFilterSummary) }));
  } catch (error) {
    yield put(fetchMyFiltersFailure(errorMessage(error, 'Failed to load your filters.')));
  }
}

// --- Detail ---

function* handleFetchDetail(action: PayloadAction<string>) {
  const id = action.payload;
  if (!isUuid(id)) {
    yield put(fetchSharedFilterNotFound());
    return;
  }
  try {
    const client = requireSupabase();
    const { data, error } = (yield call(() =>
      client.from('loot_filters').select(SHARED_FILTER_DETAIL_SELECT).eq('id', id).maybeSingle()
    )) as {
      data: SharedFilterDetailRow | null;
      error: QueryError | null;
    };
    if (error) throw new Error(error.message);
    if (data === null) {
      yield put(fetchSharedFilterNotFound());
      return;
    }
    yield call(loadLikes, [id]);
    yield put(fetchSharedFilterSuccess(toSharedFilterDetail(data)));
  } catch (error) {
    console.error('[LootFilterSharing] Could not load the filter', error);
    yield put(fetchSharedFilterFailure());
  }
}

// --- Likes ---

// The reducer has already flipped the like, so the liked state is the wanted end state: liked → insert, else delete.
function* toggleLike(id: string) {
  const userId = (yield select(selectAuthUserId)) as string | null;
  if (userId === null) {
    yield put(toggleSharedFilterLikeReverted(id));
    return;
  }
  const likedIds = (yield select(selectLikedFilterIds)) as readonly string[];
  const liked = likedIds.includes(id);
  try {
    const client = requireSupabase();
    const { error } = (yield call(() =>
      liked
        ? client.from('loot_filter_likes').insert({ filter_id: id, user_id: userId })
        : client.from('loot_filter_likes').delete().eq('filter_id', id).eq('user_id', userId)
    )) as { error: QueryError | null };
    if (error && !(liked && error.code === UNIQUE_VIOLATION)) throw new Error(error.message);
    yield put(toggleSharedFilterLikeSettled(id));
  } catch (error) {
    console.error('[LootFilterSharing] Could not update the like', error);
    yield put(toggleSharedFilterLikeReverted(id));
    yield call(toast.error, 'Could not update your like. Please try again.');
  }
}

// One request per filter at a time: a click while its request is in flight is ignored here, as the reducer ignores it.
function* watchLikes() {
  const inFlight = new Set<string>();
  function* run(id: string) {
    try {
      yield call(toggleLike, id);
    } finally {
      inFlight.delete(id);
    }
  }
  for (;;) {
    const action = (yield take(toggleSharedFilterLikeRequested.type)) as PayloadAction<string>;
    if (inFlight.has(action.payload)) continue;
    inFlight.add(action.payload);
    yield fork(run, action.payload);
  }
}

// --- Downloads ---

// Fire and forget: the count is rough by design, so a failure is only logged (the optimistic +1 stays).
function* handleDownloadCounted(action: PayloadAction<string>) {
  const id = action.payload;
  if (!isUuid(id)) return;
  try {
    const client = requireSupabase();
    const { error } = (yield call(() => client.rpc('increment_loot_filter_download', { filter_id: id }))) as {
      error: QueryError | null;
    };
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error('[LootFilterSharing] Could not count the download', error);
  }
}

// --- Delete ---

function* handleDelete(action: PayloadAction<string>) {
  const id = action.payload;
  try {
    const client = requireSupabase();
    const { error } = (yield call(() => client.from('loot_filters').delete().eq('id', id))) as { error: QueryError | null };
    if (error) throw new Error(error.message);
    yield put(deleteSharedFilterSucceeded(id));
    yield call(toast.success, 'Loot filter deleted.');
  } catch (error) {
    console.error('[LootFilterSharing] Could not delete the filter', error);
    yield put(deleteSharedFilterFailed(id));
    yield call(toast.error, 'Could not delete the loot filter. Please try again.');
  }
}

// --- Author filters (/user/:userId) ---

// Newest first, no sort toggle (as the profile's builds). No private filter: RLS shows the author's private ones only
// when the author is the viewer.
function* fetchAuthorPage(authorId: string, append: boolean) {
  const client = requireSupabase();
  const cursor = append ? ((yield select(selectAuthorFiltersCursor)) as SharedFilterCursor | null) : null;

  let query = client.from('loot_filters').select(SHARED_FILTER_LIST_SELECT).eq('user_id', authorId);
  for (const column of sortColumns('newest')) query = query.order(column, { ascending: false });
  if (cursor !== null) query = query.or(sharedFilterCursorFilter('newest', cursor));
  query = query.limit(SHARED_FILTERS_PAGE_SIZE);

  const result = (yield call(() => query)) as ListResult;
  const page = (yield call(toPage, result, append, cursor)) as FilterPagePayload;
  yield put(fetchAuthorFiltersSuccess({ ...page, authorId }));
}

// Shares one takeLatest watcher with load-more, like the Shared tab.
function* handleAuthorAction(action: PayloadAction<string | undefined>) {
  const append = fetchMoreAuthorFiltersRequested.match(action);
  const authorId = (yield select(selectAuthorFiltersAuthorId)) as string | null;
  if (authorId === null) return;
  if (!isUuid(authorId)) {
    yield put(fetchAuthorFiltersSuccess({ items: [], cursor: null, hasMore: false, append: false, authorId }));
    return;
  }
  try {
    yield call(fetchAuthorPage, authorId, append);
  } catch (error) {
    const message = errorMessage(error, 'Failed to load loot filters.');
    yield put(append ? fetchMoreAuthorFiltersFailure(message) : fetchAuthorFiltersFailure(message));
  }
}

// --- Home "Latest loot filters" ---

// Its own newest-first query, separate from the Shared tab and its search. No likes lookup: the block shows counts only.
function* handleFetchLatest() {
  try {
    const client = requireSupabase();
    const { data, error } = (yield call(() =>
      client
        .from('loot_filters')
        .select(SHARED_FILTER_LIST_SELECT)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(LATEST_FILTERS_COUNT)
    )) as ListResult;
    if (error) throw new Error(error.message);
    yield put(fetchLatestFiltersSuccess((data ?? []).map(toSharedFilterSummary)));
  } catch (error) {
    console.error('[LootFilterSharing] Failed to load the latest loot filters', error);
    yield put(fetchLatestFiltersFailure());
  }
}

// --- Sources of copies ---

// One query for every source id; an id the viewer cannot see (deleted or private) comes back as "no longer shared".
function* handleFetchSourceRevisions(action: PayloadAction<readonly string[]>) {
  const viewerId = (yield select(selectAuthUserId)) as string | null;
  const requestedIds = [...new Set(action.payload)];
  // A malformed id (a hand-edited draft) cannot match a uuid row; asking would make PostgREST fail the whole query.
  const queryIds = requestedIds.filter(isUuid);
  try {
    let rows: SourceRevision[] = [];
    if (queryIds.length > 0) {
      const client = requireSupabase();
      const { data, error } = (yield call(() => client.from('loot_filters').select(SOURCE_REVISION_SELECT).in('id', queryIds))) as {
        data: SourceRevision[] | null;
        error: QueryError | null;
      };
      if (error) throw new Error(error.message);
      rows = data ?? [];
    }
    yield put(fetchSourceRevisionsSuccess({ viewerId, requestedIds, rows }));
  } catch (error) {
    console.error('[LootFilterSharing] Could not check the sources of copies', error);
    yield put(fetchSourceRevisionsFailure());
  }
}

// --- Auth ---

// The reducer has already reset the per-user state on a user change; after a sign-in (or account switch), look up the
// new viewer's likes on what is on screen. Auth fires on every token refresh too, hence the id comparison.
function* watchViewer() {
  let viewerId = (yield select(selectAuthUserId)) as string | null;
  for (;;) {
    const action = (yield take(authStateChanged.type)) as PayloadAction<{ user: AuthUser | null }>;
    const nextId = action.payload.user?.id ?? null;
    if (nextId === viewerId) continue;
    viewerId = nextId;
    if (nextId === null) continue;
    const visibleIds = (yield select(selectVisibleFilterIds)) as string[];
    yield fork(loadLikes, visibleIds);
  }
}

export function* lootFilterSharingSaga() {
  yield takeLatest([setSharedFiltersSearchText.type, setSharedFiltersSortMode.type], handleSharedFiltersChanged);
  yield takeLatest([fetchSharedFiltersRequested.type, fetchMoreSharedFiltersRequested.type], handleFetchShared);
  yield takeLatest(fetchMyFiltersRequested.type, handleFetchMyFilters);
  yield takeLatest(fetchSharedFilterRequested.type, handleFetchDetail);
  yield fork(watchLikes);
  yield takeEvery(downloadCounted.type, handleDownloadCounted);
  yield takeLatest(deleteSharedFilterRequested.type, handleDelete);
  yield takeLatest([fetchAuthorFiltersRequested.type, fetchMoreAuthorFiltersRequested.type], handleAuthorAction);
  yield takeLatest(fetchLatestFiltersRequested.type, handleFetchLatest);
  yield takeLatest(fetchSourceRevisionsRequested.type, handleFetchSourceRevisions);
  yield fork(watchViewer);
}
