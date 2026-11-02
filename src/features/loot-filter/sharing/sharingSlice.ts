import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import { RequestState } from '@/core/types';
import type { RootState } from '@/core/store/store';
import { authStateChanged } from '@/features/auth/store/authSlice';
import type { SharedFilterCursor } from './sharingQuery';
import { LATEST_FILTERS_COUNT } from './constants';
import type { SharedFilterDetail, SharedFilterSort, SharedFilterSummary, SourceRevision } from './types';

/** A cursor-paged list (the Shared tab, an author's filters). */
interface PagedFilters {
  readonly items: readonly SharedFilterSummary[];
  readonly status: RequestState;
  readonly loadingMore: boolean;
  readonly hasMore: boolean;
  readonly cursor: SharedFilterCursor | null;
  /** The first page failed. */
  readonly error: string | null;
  /** A load-more page failed: pauses the infinite-scroll sentinel (no retry storm) until an explicit retry. */
  readonly loadMoreError: string | null;
}

export interface FilterPagePayload {
  readonly items: readonly SharedFilterSummary[];
  readonly cursor: SharedFilterCursor | null;
  readonly hasMore: boolean;
  readonly append: boolean;
}

export interface LikesLoadedPayload {
  /** The viewer the lookup ran for; ignored when the viewer has changed since. */
  readonly viewerId: string;
  /** The filter ids that were looked up; their liked state is replaced. */
  readonly checkedIds: readonly string[];
  /** Those of them the viewer has liked. */
  readonly likedIds: readonly string[];
}

export interface SourceRevisionsPayload {
  readonly viewerId: string | null;
  readonly requestedIds: readonly string[];
  /** The sources the viewer may still see; a requested id without a row is no longer shared (deleted or private). */
  readonly rows: readonly SourceRevision[];
}

/** How Save writes: `normal` (insert, or a compare-and-swap update), `overwrite` (update without it), `asNew` (insert). */
export type SaveFilterMode = 'normal' | 'overwrite' | 'asNew';

/** The server fields of a saved filter (the Save dialog's first save, the Details dialog). */
export interface SharedFilterDetails {
  readonly name: string;
  readonly description: string;
  readonly isPrivate: boolean;
}

export interface SaveFilterRequest {
  /** An insert's name, description and Private (default: the draft's name, no description, public). */
  readonly details?: SharedFilterDetails;
  /** "What changed" (a later save of a public filter); empty or absent clears the row's note. */
  readonly changeNote?: string;
  readonly mode: SaveFilterMode;
}

/** Why Save could not write: the row changed elsewhere (`changed`), or it is gone / not the viewer's (`gone`). */
export type SaveConflict = 'changed' | 'gone';

export interface SaveFilterSucceededPayload {
  /** The row as the server returned it. */
  readonly row: SharedFilterDetail;
  /** A new row (first save, or Save as a new filter). */
  readonly inserted: boolean;
}

interface SaveState {
  readonly status: RequestState;
  readonly error: string | null;
  readonly conflict: SaveConflict | null;
  /** The saved filter's id after a successful save (the editor replaces its route with it). */
  readonly savedId: string | null;
}

export interface UpdateFilterDetailsRequest extends SharedFilterDetails {
  readonly id: string;
}

/** A source of a copy, fetched with its file for "Replace with the latest" / "Add as a new filter". */
interface SourceFilterState {
  readonly id: string | null;
  readonly status: RequestState;
  readonly detail: SharedFilterDetail | null;
  /** The source cannot be seen any more (deleted or private). */
  readonly notFound: boolean;
}

interface LootFilterSharingState {
  /**
   * The signed-in user the per-user state (likes, My filters, source revisions) belongs to. Follows `authStateChanged`
   * here, so a sign-out or account switch resets that state in the same dispatch.
   */
  readonly viewerId: string | null;
  /** Filter ids the viewer has liked, across every list and the detail (looked up per page). */
  readonly likedIds: readonly string[];
  /** Filter ids with a like / unlike request in flight. */
  readonly likePendingIds: readonly string[];

  // Shared tab: public filters, server-side search and sort.
  readonly searchText: string;
  readonly sortMode: SharedFilterSort;
  readonly shared: PagedFilters;

  // My filters: the viewer's own filters, private ones included.
  readonly myFilters: readonly SharedFilterSummary[];
  readonly myFiltersStatus: RequestState;
  readonly myFiltersError: string | null;

  // /loot-filters/:id
  readonly detail: SharedFilterDetail | null;
  readonly detailStatus: RequestState;
  readonly detailNotFound: boolean;

  readonly deleteStatus: RequestState;

  // /user/:userId: that author's filters (their private ones too when the author is the viewer).
  readonly authorId: string | null;
  readonly author: PagedFilters;

  // Home page "Latest loot filters".
  readonly latest: readonly SharedFilterSummary[];
  readonly latestStatus: RequestState;

  /** Sources of copies, by id: a revision, null when the source is no longer shared, absent when not looked up. */
  readonly sourceRevisions: Readonly<Record<string, SourceRevision | null>>;
  readonly sourceRevisionsStatus: RequestState;

  // The editor: Save, the Details dialog and the source of a copy.
  readonly save: SaveState;
  readonly detailsStatus: RequestState;
  readonly detailsError: string | null;
  readonly sourceFilter: SourceFilterState;
}

const idleSave: SaveState = { status: RequestState.IDLE, error: null, conflict: null, savedId: null };
const idleSourceFilter: SourceFilterState = { id: null, status: RequestState.IDLE, detail: null, notFound: false };

const emptyPaged: PagedFilters = {
  items: [],
  status: RequestState.IDLE,
  loadingMore: false,
  hasMore: false,
  cursor: null,
  error: null,
  loadMoreError: null,
};

const initialState: LootFilterSharingState = {
  viewerId: null,
  likedIds: [],
  likePendingIds: [],
  searchText: '',
  sortMode: 'newest',
  shared: emptyPaged,
  myFilters: [],
  myFiltersStatus: RequestState.IDLE,
  myFiltersError: null,
  detail: null,
  detailStatus: RequestState.IDLE,
  detailNotFound: false,
  deleteStatus: RequestState.IDLE,
  authorId: null,
  author: emptyPaged,
  latest: [],
  latestStatus: RequestState.IDLE,
  sourceRevisions: {},
  sourceRevisionsStatus: RequestState.IDLE,
  save: idleSave,
  detailsStatus: RequestState.IDLE,
  detailsError: null,
  sourceFilter: idleSourceFilter,
};

type Draft = { -readonly [K in keyof LootFilterSharingState]: LootFilterSharingState[K] };
type PagedDraft = { -readonly [K in keyof PagedFilters]: PagedFilters[K] };

function startPage(list: PagedDraft): void {
  list.status = RequestState.LOADING;
  list.error = null;
  // A refetch supersedes (and the saga cancels) any in-flight load-more.
  list.loadingMore = false;
  list.loadMoreError = null;
  list.cursor = null;
}

function startMore(list: PagedDraft): void {
  list.loadingMore = true;
  list.loadMoreError = null;
}

function pageLoaded(list: PagedDraft, { items, cursor, hasMore, append }: FilterPagePayload): void {
  list.items = append ? [...list.items, ...items] : [...items];
  list.cursor = cursor;
  list.hasMore = hasMore;
  list.status = RequestState.SUCCESS;
  list.loadingMore = false;
  list.error = null;
  list.loadMoreError = null;
}

function pageFailed(list: PagedDraft, message: string): void {
  list.status = RequestState.ERROR;
  list.error = message;
  list.loadingMore = false;
}

function moreFailed(list: PagedDraft, message: string): void {
  list.loadMoreError = message;
  list.loadingMore = false;
}

/** Applies `update` to the filter `id` wherever the state holds it. */
function updateEverywhere(state: Draft, id: string, update: (item: SharedFilterSummary) => SharedFilterSummary): void {
  const apply = (items: readonly SharedFilterSummary[]) => items.map((item) => (item.id === id ? update(item) : item));
  state.shared = { ...state.shared, items: apply(state.shared.items) };
  state.author = { ...state.author, items: apply(state.author.items) };
  state.myFilters = apply(state.myFilters);
  state.latest = apply(state.latest);
  if (state.detail?.id === id) state.detail = { ...state.detail, ...update(state.detail) };
}

function removeEverywhere(state: Draft, id: string): void {
  const keep = (items: readonly SharedFilterSummary[]) => items.filter((item) => item.id !== id);
  state.shared = { ...state.shared, items: keep(state.shared.items) };
  state.author = { ...state.author, items: keep(state.author.items) };
  state.myFilters = keep(state.myFilters);
  state.latest = keep(state.latest);
  state.likedIds = state.likedIds.filter((likedId) => likedId !== id);
  if (state.detail?.id === id) {
    state.detail = null;
    state.detailStatus = RequestState.IDLE;
    state.detailNotFound = false;
  }
  // A copy of it now reads "no longer shared".
  if (id in state.sourceRevisions) state.sourceRevisions = { ...state.sourceRevisions, [id]: null };
}

/** A row without its file (what the lists hold). */
function toSummary(row: SharedFilterSummary | SharedFilterDetail): SharedFilterSummary {
  if (!('content' in row)) return row;
  const { content: _content, ...summary } = row;
  return summary;
}

/**
 * Puts a saved or re-detailed filter wherever it belongs: replaced where it is listed (removed from the public lists when
 * it went private), moved to the top of My filters (newest change first), and, when `inserted`, added to the top of the
 * newest-first lists it would appear in. The detail is updated in place (keeping its file when `row` has none).
 */
function upsertFilter(state: Draft, row: SharedFilterSummary | SharedFilterDetail, inserted: boolean): void {
  const summary = toSummary(row);
  const replace = (items: readonly SharedFilterSummary[]) => items.map((item) => (item.id === summary.id ? summary : item));
  const without = (items: readonly SharedFilterSummary[]) => items.filter((item) => item.id !== summary.id);
  const listed = (items: readonly SharedFilterSummary[]) => items.some((item) => item.id === summary.id);

  if (summary.user_id === state.viewerId) state.myFilters = [summary, ...without(state.myFilters)];

  const shared = state.shared;
  if (summary.is_private) {
    state.shared = { ...shared, items: without(shared.items) };
  } else if (listed(shared.items)) {
    state.shared = { ...shared, items: replace(shared.items) };
  } else if (inserted && state.sortMode === 'newest' && state.searchText.trim() === '' && shared.status === RequestState.SUCCESS) {
    state.shared = { ...shared, items: [summary, ...shared.items] };
  }

  const author = state.author;
  if (listed(author.items)) state.author = { ...author, items: replace(author.items) };
  else if (inserted && state.authorId === summary.user_id) state.author = { ...author, items: [summary, ...author.items] };

  if (summary.is_private) state.latest = without(state.latest);
  else if (listed(state.latest)) state.latest = replace(state.latest);
  else if (inserted && state.latestStatus === RequestState.SUCCESS)
    state.latest = [summary, ...state.latest].slice(0, LATEST_FILTERS_COUNT);

  if (state.detail?.id === summary.id) state.detail = { ...state.detail, ...row };
}

/** Flips the viewer's like on `id` and moves its count with it (the optimistic step and its revert are the same). */
function flipLike(state: Draft, id: string): void {
  const wasLiked = state.likedIds.includes(id);
  state.likedIds = wasLiked ? state.likedIds.filter((likedId) => likedId !== id) : [...state.likedIds, id];
  updateEverywhere(state, id, (item) => ({ ...item, likes_count: Math.max(item.likes_count + (wasLiked ? -1 : 1), 0) }));
}

const lootFilterSharingSlice = createSlice({
  name: 'lootFilterSharing',
  initialState,
  reducers: {
    // --- Shared tab ---
    setSharedFiltersSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    setSharedFiltersSortMode(state, action: PayloadAction<SharedFilterSort>) {
      state.sortMode = action.payload;
    },
    fetchSharedFiltersRequested(state) {
      startPage(state.shared);
    },
    fetchMoreSharedFiltersRequested(state) {
      startMore(state.shared);
    },
    fetchSharedFiltersSuccess(state, action: PayloadAction<FilterPagePayload>) {
      pageLoaded(state.shared, action.payload);
    },
    fetchSharedFiltersFailure(state, action: PayloadAction<string>) {
      pageFailed(state.shared, action.payload);
    },
    fetchMoreSharedFiltersFailure(state, action: PayloadAction<string>) {
      moreFailed(state.shared, action.payload);
    },

    // --- My filters ---
    fetchMyFiltersRequested(state) {
      state.myFiltersStatus = RequestState.LOADING;
      state.myFiltersError = null;
    },
    fetchMyFiltersSuccess(state, action: PayloadAction<{ userId: string; items: readonly SharedFilterSummary[] }>) {
      if (action.payload.userId !== state.viewerId) return;
      state.myFilters = [...action.payload.items];
      state.myFiltersStatus = RequestState.SUCCESS;
    },
    fetchMyFiltersFailure(state, action: PayloadAction<string>) {
      state.myFiltersStatus = RequestState.ERROR;
      state.myFiltersError = action.payload;
    },

    // --- Detail ---
    fetchSharedFilterRequested(state, _action: PayloadAction<string>) {
      state.detailStatus = RequestState.LOADING;
      state.detailNotFound = false;
    },
    fetchSharedFilterSuccess(state, action: PayloadAction<SharedFilterDetail>) {
      state.detail = action.payload;
      state.detailStatus = RequestState.SUCCESS;
      state.detailNotFound = false;
    },
    fetchSharedFilterNotFound(state) {
      state.detail = null;
      state.detailNotFound = true;
      state.detailStatus = RequestState.SUCCESS;
    },
    fetchSharedFilterFailure(state) {
      state.detailStatus = RequestState.ERROR;
    },
    clearSharedFilterDetail(state) {
      state.detail = null;
      state.detailStatus = RequestState.IDLE;
      state.detailNotFound = false;
      state.deleteStatus = RequestState.IDLE;
    },

    // --- Likes (optimistic; signed-in viewers only, one request per filter at a time) ---
    toggleSharedFilterLikeRequested(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (state.viewerId === null || state.likePendingIds.includes(id)) return;
      flipLike(state, id);
      state.likePendingIds = [...state.likePendingIds, id];
    },
    toggleSharedFilterLikeSettled(state, action: PayloadAction<string>) {
      state.likePendingIds = state.likePendingIds.filter((id) => id !== action.payload);
    },
    toggleSharedFilterLikeReverted(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!state.likePendingIds.includes(id)) return;
      flipLike(state, id);
      state.likePendingIds = state.likePendingIds.filter((pendingId) => pendingId !== id);
    },
    sharedFilterLikesLoaded(state, action: PayloadAction<LikesLoadedPayload>) {
      const { viewerId, checkedIds, likedIds } = action.payload;
      if (viewerId !== state.viewerId) return;
      // A like in flight keeps its optimistic state; the lookup may have raced it.
      const replaced = new Set(checkedIds.filter((id) => !state.likePendingIds.includes(id)));
      const liked = likedIds.filter((id) => replaced.has(id));
      state.likedIds = [...new Set([...state.likedIds.filter((id) => !replaced.has(id)), ...liked])];
    },

    // --- Downloads (a rough count: +1 at once, the RPC is fire and forget) ---
    downloadCounted(state, action: PayloadAction<string>) {
      updateEverywhere(state, action.payload, (item) => ({ ...item, download_count: item.download_count + 1 }));
    },

    // --- Delete (own filters) ---
    deleteSharedFilterRequested(state, _action: PayloadAction<string>) {
      state.deleteStatus = RequestState.LOADING;
    },
    deleteSharedFilterSucceeded(state, action: PayloadAction<string>) {
      removeEverywhere(state, action.payload);
      state.deleteStatus = RequestState.SUCCESS;
    },
    deleteSharedFilterFailed(state, _action: PayloadAction<string>) {
      state.deleteStatus = RequestState.ERROR;
    },
    resetDeleteSharedFilterStatus(state) {
      state.deleteStatus = RequestState.IDLE;
    },

    // --- Author filters (/user/:userId) ---
    fetchAuthorFiltersRequested(state, action: PayloadAction<string>) {
      // Start clean so a different author (or a refetch) never shows stale filters.
      state.authorId = action.payload;
      state.author = { ...emptyPaged, items: [] };
      startPage(state.author);
    },
    fetchMoreAuthorFiltersRequested(state) {
      startMore(state.author);
    },
    fetchAuthorFiltersSuccess(state, action: PayloadAction<FilterPagePayload & { authorId: string }>) {
      if (action.payload.authorId !== state.authorId) return;
      pageLoaded(state.author, action.payload);
    },
    fetchAuthorFiltersFailure(state, action: PayloadAction<string>) {
      pageFailed(state.author, action.payload);
    },
    fetchMoreAuthorFiltersFailure(state, action: PayloadAction<string>) {
      moreFailed(state.author, action.payload);
    },
    clearAuthorFilters(state) {
      state.authorId = null;
      state.author = { ...emptyPaged, items: [] };
    },

    // --- Home "Latest loot filters" ---
    fetchLatestFiltersRequested(state) {
      state.latestStatus = RequestState.LOADING;
    },
    fetchLatestFiltersSuccess(state, action: PayloadAction<readonly SharedFilterSummary[]>) {
      state.latest = [...action.payload];
      state.latestStatus = RequestState.SUCCESS;
    },
    fetchLatestFiltersFailure(state) {
      state.latestStatus = RequestState.ERROR;
    },

    // --- Sources of copies ("Update available" / "no longer shared") ---
    fetchSourceRevisionsRequested(state, _action: PayloadAction<readonly string[]>) {
      state.sourceRevisionsStatus = RequestState.LOADING;
    },
    fetchSourceRevisionsSuccess(state, action: PayloadAction<SourceRevisionsPayload>) {
      const { viewerId, requestedIds, rows } = action.payload;
      if (viewerId !== state.viewerId) return;
      const next: Record<string, SourceRevision | null> = { ...state.sourceRevisions };
      for (const id of requestedIds) next[id] = null;
      for (const row of rows) next[row.id] = row;
      state.sourceRevisions = next;
      state.sourceRevisionsStatus = RequestState.SUCCESS;
    },
    fetchSourceRevisionsFailure(state) {
      state.sourceRevisionsStatus = RequestState.ERROR;
    },

    // --- Save (the editor; the saga flushes the draft, validates and writes) ---
    saveFilterRequested(state, _action: PayloadAction<SaveFilterRequest>) {
      state.save = { ...idleSave, status: RequestState.LOADING };
    },
    /** The row was written; it becomes the detail (the editor shows it) and is put into the lists. */
    saveFilterSucceeded(state, action: PayloadAction<SaveFilterSucceededPayload>) {
      const { row, inserted } = action.payload;
      upsertFilter(state, row, inserted);
      state.detail = row;
      state.detailStatus = RequestState.SUCCESS;
      state.detailNotFound = false;
      state.save = { ...idleSave, status: RequestState.SUCCESS, savedId: row.id };
    },
    saveFilterFailed(state, action: PayloadAction<{ readonly error: string; readonly conflict?: SaveConflict }>) {
      state.save = { ...idleSave, status: RequestState.ERROR, error: action.payload.error, conflict: action.payload.conflict ?? null };
    },
    /** Nothing was written and nothing went wrong: nothing to save, or the sign-in dialog was opened instead. */
    saveFilterCancelled(state) {
      state.save = idleSave;
    },
    resetSaveStatus(state) {
      state.save = idleSave;
    },

    // --- Details dialog (name, description, Private: written at once, no draft) ---
    updateFilterDetailsRequested(state, _action: PayloadAction<UpdateFilterDetailsRequest>) {
      state.detailsStatus = RequestState.LOADING;
      state.detailsError = null;
    },
    updateFilterDetailsSucceeded(state, action: PayloadAction<SharedFilterSummary>) {
      upsertFilter(state, action.payload, false);
      state.detailsStatus = RequestState.SUCCESS;
    },
    updateFilterDetailsFailed(state, action: PayloadAction<string>) {
      state.detailsStatus = RequestState.ERROR;
      state.detailsError = action.payload;
    },
    resetFilterDetailsStatus(state) {
      state.detailsStatus = RequestState.IDLE;
      state.detailsError = null;
    },

    // --- The source of a copy, with its file ("Replace with the latest", "Add as a new filter") ---
    fetchSourceFilterRequested(state, action: PayloadAction<string>) {
      state.sourceFilter = { ...idleSourceFilter, id: action.payload, status: RequestState.LOADING };
    },
    fetchSourceFilterSucceeded(state, action: PayloadAction<SharedFilterDetail>) {
      if (action.payload.id !== state.sourceFilter.id) return;
      state.sourceFilter = { ...idleSourceFilter, id: action.payload.id, status: RequestState.SUCCESS, detail: action.payload };
    },
    fetchSourceFilterFailed(state, action: PayloadAction<{ readonly id: string; readonly notFound: boolean }>) {
      const { id, notFound } = action.payload;
      if (id !== state.sourceFilter.id) return;
      state.sourceFilter = { ...idleSourceFilter, id, status: RequestState.ERROR, notFound };
      // A source that cannot be fetched any more reads "no longer shared" from now on.
      if (notFound) state.sourceRevisions = { ...state.sourceRevisions, [id]: null };
    },
  },
  extraReducers: (builder) => {
    // Sign-out or a different account: drop what belonged to the previous viewer. Auth fires on every token refresh
    // too, so only a change of user id counts.
    builder.addCase(authStateChanged, (state, action) => {
      const viewerId = action.payload.user?.id ?? null;
      if (viewerId === state.viewerId) return;
      state.viewerId = viewerId;
      state.likedIds = [];
      state.likePendingIds = [];
      state.myFilters = [];
      state.myFiltersStatus = RequestState.IDLE;
      state.myFiltersError = null;
      state.sourceRevisions = {};
      state.sourceRevisionsStatus = RequestState.IDLE;
      // Private filters stay visible to their owner only (the profile page lists the owner's private ones).
      const visible = (item: SharedFilterSummary) => !item.is_private || item.user_id === viewerId;
      state.shared = { ...state.shared, items: state.shared.items.filter(visible) };
      state.author = { ...state.author, items: state.author.items.filter(visible) };
      state.latest = state.latest.filter(visible);
      if (state.detail !== null && !visible(state.detail)) {
        state.detail = null;
        state.detailNotFound = true;
        state.detailStatus = RequestState.SUCCESS;
      }
    });
  },
});

export const {
  setSharedFiltersSearchText,
  setSharedFiltersSortMode,
  fetchSharedFiltersRequested,
  fetchMoreSharedFiltersRequested,
  fetchSharedFiltersSuccess,
  fetchSharedFiltersFailure,
  fetchMoreSharedFiltersFailure,
  fetchMyFiltersRequested,
  fetchMyFiltersSuccess,
  fetchMyFiltersFailure,
  fetchSharedFilterRequested,
  fetchSharedFilterSuccess,
  fetchSharedFilterNotFound,
  fetchSharedFilterFailure,
  clearSharedFilterDetail,
  toggleSharedFilterLikeRequested,
  toggleSharedFilterLikeSettled,
  toggleSharedFilterLikeReverted,
  sharedFilterLikesLoaded,
  downloadCounted,
  deleteSharedFilterRequested,
  deleteSharedFilterSucceeded,
  deleteSharedFilterFailed,
  resetDeleteSharedFilterStatus,
  fetchAuthorFiltersRequested,
  fetchMoreAuthorFiltersRequested,
  fetchAuthorFiltersSuccess,
  fetchAuthorFiltersFailure,
  fetchMoreAuthorFiltersFailure,
  clearAuthorFilters,
  fetchLatestFiltersRequested,
  fetchLatestFiltersSuccess,
  fetchLatestFiltersFailure,
  fetchSourceRevisionsRequested,
  fetchSourceRevisionsSuccess,
  fetchSourceRevisionsFailure,
  saveFilterRequested,
  saveFilterSucceeded,
  saveFilterFailed,
  saveFilterCancelled,
  resetSaveStatus,
  updateFilterDetailsRequested,
  updateFilterDetailsSucceeded,
  updateFilterDetailsFailed,
  resetFilterDetailsStatus,
  fetchSourceFilterRequested,
  fetchSourceFilterSucceeded,
  fetchSourceFilterFailed,
} = lootFilterSharingSlice.actions;

export default lootFilterSharingSlice.reducer;

// --- Selectors ---

const selectSharingState = (state: RootState) => state.lootFilterSharing;

export const selectSharingViewerId = createSelector([selectSharingState], (s) => s.viewerId);
export const selectLikedFilterIds = createSelector([selectSharingState], (s) => s.likedIds);
export const selectLikedFilterIdSet = createSelector([selectLikedFilterIds], (ids) => new Set(ids));
export const selectLikePendingFilterIds = createSelector([selectSharingState], (s) => s.likePendingIds);
export const selectLikePendingFilterIdSet = createSelector([selectLikePendingFilterIds], (ids) => new Set(ids));

const selectShared = createSelector([selectSharingState], (s) => s.shared);
export const selectSharedFilters = createSelector([selectShared], (list) => list.items);
export const selectSharedFiltersStatus = createSelector([selectShared], (list) => list.status);
export const selectSharedFiltersLoading = createSelector([selectSharedFiltersStatus], (status) => status === RequestState.LOADING);
export const selectSharedFiltersLoadingMore = createSelector([selectShared], (list) => list.loadingMore);
export const selectSharedFiltersHasMore = createSelector([selectShared], (list) => list.hasMore);
export const selectSharedFiltersCursor = createSelector([selectShared], (list) => list.cursor);
export const selectSharedFiltersError = createSelector([selectShared], (list) => list.error);
export const selectSharedFiltersLoadMoreError = createSelector([selectShared], (list) => list.loadMoreError);
export const selectSharedFiltersSearchText = createSelector([selectSharingState], (s) => s.searchText);
export const selectSharedFiltersSortMode = createSelector([selectSharingState], (s) => s.sortMode);
export const selectSharedFiltersHasActiveSearch = createSelector([selectSharedFiltersSearchText], (text) => text.trim().length > 0);

export const selectMyFilters = createSelector([selectSharingState], (s) => s.myFilters);
export const selectMyFiltersStatus = createSelector([selectSharingState], (s) => s.myFiltersStatus);
export const selectMyFiltersError = createSelector([selectSharingState], (s) => s.myFiltersError);

export const selectSharedFilterDetail = createSelector([selectSharingState], (s) => s.detail);
export const selectSharedFilterDetailStatus = createSelector([selectSharingState], (s) => s.detailStatus);
export const selectSharedFilterDetailLoading = createSelector(
  [selectSharedFilterDetailStatus],
  (status) => status === RequestState.LOADING
);
export const selectSharedFilterDetailNotFound = createSelector([selectSharingState], (s) => s.detailNotFound);
export const selectSharedFilterDetailLiked = createSelector(
  [selectSharedFilterDetail, selectLikedFilterIds],
  (detail, likedIds) => detail !== null && likedIds.includes(detail.id)
);
export const selectDeleteSharedFilterStatus = createSelector([selectSharingState], (s) => s.deleteStatus);

const selectAuthor = createSelector([selectSharingState], (s) => s.author);
export const selectAuthorFiltersAuthorId = createSelector([selectSharingState], (s) => s.authorId);
export const selectAuthorFilters = createSelector([selectAuthor], (list) => list.items);
export const selectAuthorFiltersStatus = createSelector([selectAuthor], (list) => list.status);
export const selectAuthorFiltersLoading = createSelector([selectAuthorFiltersStatus], (status) => status === RequestState.LOADING);
export const selectAuthorFiltersLoadingMore = createSelector([selectAuthor], (list) => list.loadingMore);
export const selectAuthorFiltersHasMore = createSelector([selectAuthor], (list) => list.hasMore);
export const selectAuthorFiltersCursor = createSelector([selectAuthor], (list) => list.cursor);
export const selectAuthorFiltersError = createSelector([selectAuthor], (list) => list.error);
export const selectAuthorFiltersLoadMoreError = createSelector([selectAuthor], (list) => list.loadMoreError);

export const selectLatestFilters = createSelector([selectSharingState], (s) => s.latest);
export const selectLatestFiltersStatus = createSelector([selectSharingState], (s) => s.latestStatus);

export const selectSourceRevisions = createSelector([selectSharingState], (s) => s.sourceRevisions);
export const selectSourceRevisionsStatus = createSelector([selectSharingState], (s) => s.sourceRevisionsStatus);

const selectSave = createSelector([selectSharingState], (s) => s.save);
export const selectSaveFilterStatus = createSelector([selectSave], (save) => save.status);
export const selectSaveFilterError = createSelector([selectSave], (save) => save.error);
export const selectSaveFilterConflict = createSelector([selectSave], (save) => save.conflict);
export const selectSavedFilterId = createSelector([selectSave], (save) => save.savedId);
export const selectFilterDetailsStatus = createSelector([selectSharingState], (s) => s.detailsStatus);
export const selectFilterDetailsError = createSelector([selectSharingState], (s) => s.detailsError);
export const selectSourceFilter = createSelector([selectSharingState], (s) => s.sourceFilter);

/** The ids of every filter on screen (lists and detail), for refreshing the viewer's likes after a sign-in. */
export const selectVisibleFilterIds = createSelector([selectSharingState], (s) => [
  ...new Set([...s.shared.items, ...s.author.items, ...s.latest, ...(s.detail === null ? [] : [s.detail])].map((item) => item.id)),
]);
