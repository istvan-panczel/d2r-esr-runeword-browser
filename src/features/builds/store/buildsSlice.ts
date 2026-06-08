import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import { RequestState } from '@/core/types';
import type { RootState } from '@/core/store/store';
import type { Profile } from '@/core/supabase';
import type { CharacterClass } from '../constants';
import type { BuildData } from '../buildData';
import type { BuildSortMode, BuildWithAuthor } from '../types';
import type { BuildListCursor } from './buildsQuery';

export interface CreateBuildPayload {
  readonly name: string;
  readonly description: string;
  readonly class: CharacterClass;
  readonly buildData: BuildData;
}

export interface UpdateBuildPayload extends CreateBuildPayload {
  readonly id: string;
}

interface FetchBuildsSuccessPayload {
  readonly items: readonly BuildWithAuthor[];
  readonly cursor: BuildListCursor | null;
  readonly hasMore: boolean;
  readonly append: boolean;
  /** Ids (within this page) the signed-in viewer has liked. Absent when logged out. */
  readonly likedIds?: readonly string[];
}

type FetchAuthorBuildsSuccessPayload = FetchBuildsSuccessPayload;

interface BuildsState {
  readonly items: readonly BuildWithAuthor[];
  readonly listStatus: RequestState;
  readonly loadingMore: boolean;
  readonly hasMore: boolean;
  readonly cursor: BuildListCursor | null;
  readonly error: string | null;
  /** Build ids in the current list the signed-in viewer has liked. */
  readonly likedBuildIds: readonly string[];
  // Filters / sort (server-side). My Builds is intentionally local-only state.
  readonly searchText: string;
  readonly classFilter: CharacterClass | null;
  readonly sortMode: BuildSortMode;
  readonly myBuildsOnly: boolean;
  // Create / edit form
  readonly createStatus: RequestState;
  readonly updateStatus: RequestState;
  // Detail page
  readonly detailBuild: BuildWithAuthor | null;
  readonly detailStatus: RequestState;
  readonly detailNotFound: boolean;
  readonly detailLiked: boolean;
  readonly likePending: boolean;
  readonly deleteStatus: RequestState;
  // Author profile page (/user/:userId): the viewed profile + that author's builds.
  readonly authorProfile: Profile | null;
  readonly authorStatus: RequestState;
  readonly authorNotFound: boolean;
  readonly authorBuilds: readonly BuildWithAuthor[];
  readonly authorBuildsLoadingMore: boolean;
  readonly authorBuildsHasMore: boolean;
  readonly authorBuildsCursor: BuildListCursor | null;
  readonly authorBuildsError: string | null;
  /** Build ids on the author profile list the signed-in viewer has liked. */
  readonly authorLikedBuildIds: readonly string[];
}

const initialState: BuildsState = {
  items: [],
  listStatus: RequestState.IDLE,
  loadingMore: false,
  hasMore: false,
  cursor: null,
  error: null,
  likedBuildIds: [],
  searchText: '',
  classFilter: null,
  sortMode: 'newest',
  myBuildsOnly: false,
  createStatus: RequestState.IDLE,
  updateStatus: RequestState.IDLE,
  detailBuild: null,
  detailStatus: RequestState.IDLE,
  detailNotFound: false,
  detailLiked: false,
  likePending: false,
  deleteStatus: RequestState.IDLE,
  authorProfile: null,
  authorStatus: RequestState.IDLE,
  authorNotFound: false,
  authorBuilds: [],
  authorBuildsLoadingMore: false,
  authorBuildsHasMore: false,
  authorBuildsCursor: null,
  authorBuildsError: null,
  authorLikedBuildIds: [],
};

const buildsSlice = createSlice({
  name: 'builds',
  initialState,
  reducers: {
    setSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    setClassFilter(state, action: PayloadAction<CharacterClass | null>) {
      state.classFilter = action.payload;
    },
    setSortMode(state, action: PayloadAction<BuildSortMode>) {
      state.sortMode = action.payload;
    },
    setMyBuildsOnly(state, action: PayloadAction<boolean>) {
      state.myBuildsOnly = action.payload;
    },

    fetchBuildsRequested(state) {
      state.listStatus = RequestState.LOADING;
      state.error = null;
    },
    fetchMoreBuildsRequested(state) {
      state.loadingMore = true;
    },
    fetchBuildsSuccess(state, action: PayloadAction<FetchBuildsSuccessPayload>) {
      const { items, cursor, hasMore, append, likedIds = [] } = action.payload;
      state.items = append ? [...state.items, ...items] : [...items];
      state.likedBuildIds = append ? [...new Set([...state.likedBuildIds, ...likedIds])] : [...likedIds];
      state.cursor = cursor;
      state.hasMore = hasMore;
      state.listStatus = RequestState.SUCCESS;
      state.loadingMore = false;
    },
    fetchBuildsFailure(state, action: PayloadAction<string>) {
      state.listStatus = RequestState.ERROR;
      state.error = action.payload;
      state.loadingMore = false;
    },

    createBuildRequested(state, _action: PayloadAction<CreateBuildPayload>) {
      state.createStatus = RequestState.LOADING;
      state.error = null;
    },
    createBuildSucceeded(state, _action: PayloadAction<{ id: string }>) {
      state.createStatus = RequestState.SUCCESS;
    },
    createBuildFailed(state, action: PayloadAction<string>) {
      state.createStatus = RequestState.ERROR;
      state.error = action.payload;
    },
    resetCreateStatus(state) {
      state.createStatus = RequestState.IDLE;
    },

    updateBuildRequested(state, _action: PayloadAction<UpdateBuildPayload>) {
      state.updateStatus = RequestState.LOADING;
    },
    updateBuildSucceeded(state, _action: PayloadAction<{ id: string }>) {
      state.updateStatus = RequestState.SUCCESS;
    },
    updateBuildFailed(state) {
      state.updateStatus = RequestState.ERROR;
    },
    resetUpdateStatus(state) {
      state.updateStatus = RequestState.IDLE;
    },

    // --- Detail page ---
    fetchBuildRequested(state, _action: PayloadAction<string>) {
      state.detailStatus = RequestState.LOADING;
      state.detailNotFound = false;
    },
    fetchBuildSuccess(state, action: PayloadAction<{ build: BuildWithAuthor; liked: boolean }>) {
      state.detailBuild = action.payload.build;
      state.detailLiked = action.payload.liked;
      state.detailStatus = RequestState.SUCCESS;
      state.detailNotFound = false;
    },
    fetchBuildNotFound(state) {
      state.detailBuild = null;
      state.detailNotFound = true;
      state.detailStatus = RequestState.SUCCESS;
    },
    fetchBuildFailure(state) {
      state.detailStatus = RequestState.ERROR;
    },
    clearDetail(state) {
      state.detailBuild = null;
      state.detailStatus = RequestState.IDLE;
      state.detailNotFound = false;
      state.detailLiked = false;
      state.likePending = false;
      state.deleteStatus = RequestState.IDLE;
    },

    // --- Likes (optimistic) ---
    toggleLikeRequested(state) {
      if (state.detailBuild === null) return;
      const wasLiked = state.detailLiked;
      state.detailLiked = !wasLiked;
      state.detailBuild = { ...state.detailBuild, likes_count: state.detailBuild.likes_count + (wasLiked ? -1 : 1) };
      state.likePending = true;
    },
    toggleLikeReverted(state) {
      if (state.detailBuild !== null) {
        const wasLiked = state.detailLiked;
        state.detailLiked = !wasLiked;
        state.detailBuild = { ...state.detailBuild, likes_count: state.detailBuild.likes_count + (wasLiked ? -1 : 1) };
      }
      state.likePending = false;
    },
    toggleLikeSettled(state) {
      state.likePending = false;
    },

    // --- Delete ---
    deleteBuildRequested(state, _action: PayloadAction<string>) {
      state.deleteStatus = RequestState.LOADING;
    },
    deleteBuildSucceeded(state) {
      state.deleteStatus = RequestState.SUCCESS;
    },
    deleteBuildFailed(state) {
      state.deleteStatus = RequestState.ERROR;
    },

    // --- Author profile page ---
    fetchAuthorProfileRequested(state, _action: PayloadAction<string>) {
      state.authorStatus = RequestState.LOADING;
      state.authorNotFound = false;
      // Start each load clean so a different author (or a refetch) never shows stale builds.
      state.authorBuilds = [];
      state.authorBuildsCursor = null;
      state.authorBuildsHasMore = false;
      state.authorBuildsLoadingMore = false;
      state.authorBuildsError = null;
      state.authorLikedBuildIds = [];
    },
    fetchAuthorProfileSuccess(state, action: PayloadAction<Profile>) {
      state.authorProfile = action.payload;
      state.authorStatus = RequestState.SUCCESS;
      state.authorNotFound = false;
    },
    fetchAuthorProfileNotFound(state) {
      state.authorProfile = null;
      state.authorNotFound = true;
      state.authorStatus = RequestState.SUCCESS;
    },
    fetchAuthorProfileFailure(state) {
      state.authorStatus = RequestState.ERROR;
    },
    fetchMoreAuthorBuildsRequested(state) {
      state.authorBuildsLoadingMore = true;
    },
    fetchAuthorBuildsSuccess(state, action: PayloadAction<FetchAuthorBuildsSuccessPayload>) {
      const { items, cursor, hasMore, append, likedIds = [] } = action.payload;
      state.authorBuilds = append ? [...state.authorBuilds, ...items] : [...items];
      state.authorLikedBuildIds = append ? [...new Set([...state.authorLikedBuildIds, ...likedIds])] : [...likedIds];
      state.authorBuildsCursor = cursor;
      state.authorBuildsHasMore = hasMore;
      state.authorBuildsLoadingMore = false;
      state.authorBuildsError = null;
    },
    fetchAuthorBuildsFailure(state, action: PayloadAction<string>) {
      state.authorBuildsError = action.payload;
      state.authorBuildsLoadingMore = false;
    },
    clearAuthorProfile(state) {
      state.authorProfile = null;
      state.authorStatus = RequestState.IDLE;
      state.authorNotFound = false;
      state.authorBuilds = [];
      state.authorBuildsCursor = null;
      state.authorBuildsHasMore = false;
      state.authorBuildsLoadingMore = false;
      state.authorBuildsError = null;
      state.authorLikedBuildIds = [];
    },
  },
});

export const {
  setSearchText,
  setClassFilter,
  setSortMode,
  setMyBuildsOnly,
  fetchBuildsRequested,
  fetchMoreBuildsRequested,
  fetchBuildsSuccess,
  fetchBuildsFailure,
  createBuildRequested,
  createBuildSucceeded,
  createBuildFailed,
  resetCreateStatus,
  updateBuildRequested,
  updateBuildSucceeded,
  updateBuildFailed,
  resetUpdateStatus,
  fetchBuildRequested,
  fetchBuildSuccess,
  fetchBuildNotFound,
  fetchBuildFailure,
  clearDetail,
  toggleLikeRequested,
  toggleLikeReverted,
  toggleLikeSettled,
  deleteBuildRequested,
  deleteBuildSucceeded,
  deleteBuildFailed,
  fetchAuthorProfileRequested,
  fetchAuthorProfileSuccess,
  fetchAuthorProfileNotFound,
  fetchAuthorProfileFailure,
  fetchMoreAuthorBuildsRequested,
  fetchAuthorBuildsSuccess,
  fetchAuthorBuildsFailure,
  clearAuthorProfile,
} = buildsSlice.actions;

export default buildsSlice.reducer;

// --- Selectors ---

const selectBuildsState = (state: RootState) => state.builds;

export const selectBuilds = createSelector([selectBuildsState], (s) => s.items);
export const selectBuildsListStatus = createSelector([selectBuildsState], (s) => s.listStatus);
export const selectBuildsLoading = createSelector([selectBuildsListStatus], (status) => status === RequestState.LOADING);
export const selectBuildsLoadingMore = createSelector([selectBuildsState], (s) => s.loadingMore);
export const selectBuildsHasMore = createSelector([selectBuildsState], (s) => s.hasMore);
export const selectBuildsCursor = createSelector([selectBuildsState], (s) => s.cursor);
export const selectBuildsError = createSelector([selectBuildsState], (s) => s.error);
export const selectBuildsSearchText = createSelector([selectBuildsState], (s) => s.searchText);
export const selectBuildsClassFilter = createSelector([selectBuildsState], (s) => s.classFilter);
export const selectBuildsSortMode = createSelector([selectBuildsState], (s) => s.sortMode);
export const selectBuildsMyBuildsOnly = createSelector([selectBuildsState], (s) => s.myBuildsOnly);
export const selectBuildsHasActiveFilters = createSelector(
  [selectBuildsSearchText, selectBuildsClassFilter, selectBuildsMyBuildsOnly],
  (search, classFilter, myBuildsOnly) => search.trim().length > 0 || classFilter !== null || myBuildsOnly
);
export const selectCreateBuildStatus = createSelector([selectBuildsState], (s) => s.createStatus);
export const selectUpdateBuildStatus = createSelector([selectBuildsState], (s) => s.updateStatus);

export const selectDetailBuild = createSelector([selectBuildsState], (s) => s.detailBuild);
export const selectDetailStatus = createSelector([selectBuildsState], (s) => s.detailStatus);
export const selectDetailLoading = createSelector([selectDetailStatus], (status) => status === RequestState.LOADING);
export const selectDetailNotFound = createSelector([selectBuildsState], (s) => s.detailNotFound);
export const selectDetailLiked = createSelector([selectBuildsState], (s) => s.detailLiked);
export const selectLikePending = createSelector([selectBuildsState], (s) => s.likePending);
export const selectDeleteStatus = createSelector([selectBuildsState], (s) => s.deleteStatus);

export const selectAuthorProfile = createSelector([selectBuildsState], (s) => s.authorProfile);
export const selectAuthorStatus = createSelector([selectBuildsState], (s) => s.authorStatus);
export const selectAuthorLoading = createSelector([selectAuthorStatus], (status) => status === RequestState.LOADING);
export const selectAuthorNotFound = createSelector([selectBuildsState], (s) => s.authorNotFound);
export const selectAuthorBuilds = createSelector([selectBuildsState], (s) => s.authorBuilds);
export const selectAuthorBuildsLoadingMore = createSelector([selectBuildsState], (s) => s.authorBuildsLoadingMore);
export const selectAuthorBuildsHasMore = createSelector([selectBuildsState], (s) => s.authorBuildsHasMore);
export const selectAuthorBuildsCursor = createSelector([selectBuildsState], (s) => s.authorBuildsCursor);
export const selectAuthorBuildsError = createSelector([selectBuildsState], (s) => s.authorBuildsError);

export const selectLikedBuildIds = createSelector([selectBuildsState], (s) => s.likedBuildIds);
export const selectLikedBuildIdSet = createSelector([selectLikedBuildIds], (ids) => new Set(ids));
export const selectAuthorLikedBuildIds = createSelector([selectBuildsState], (s) => s.authorLikedBuildIds);
export const selectAuthorLikedBuildIdSet = createSelector([selectAuthorLikedBuildIds], (ids) => new Set(ids));
