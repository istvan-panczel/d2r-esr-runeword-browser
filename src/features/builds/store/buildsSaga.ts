import { call, put, select, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { toast } from 'sonner';
import { db } from '@/core/db';
import type { Metadata } from '@/core/db';
import { requireSupabase } from '@/core/supabase';
import type { Json, Profile } from '@/core/supabase/types';
import { authStateChanged, selectAuthUserId, type AuthUser } from '@/features/auth/store/authSlice';
import { BUILDS_PAGE_SIZE } from '../constants';
import type { BuildData } from '../buildData';
import type { BuildSortMode, BuildWithAuthor } from '../types';
import { refreshBuildData } from '../utils/refreshBuildData';
import { buildCursorOrFilter, isUuid, type BuildListCursor } from './buildsQuery';
import {
  createBuildFailed,
  createBuildRequested,
  createBuildSucceeded,
  deleteBuildFailed,
  deleteBuildRequested,
  deleteBuildSucceeded,
  fetchAuthorBuildsFailure,
  fetchAuthorBuildsSuccess,
  fetchAuthorProfileFailure,
  fetchAuthorProfileNotFound,
  fetchAuthorProfileRequested,
  fetchAuthorProfileSuccess,
  fetchBuildFailure,
  fetchBuildNotFound,
  fetchBuildRequested,
  fetchBuildSuccess,
  fetchBuildsFailure,
  fetchBuildsRequested,
  fetchBuildsSuccess,
  fetchMoreAuthorBuildsRequested,
  fetchMoreBuildsRequested,
  selectAuthorBuildsCursor,
  selectAuthorProfile,
  selectBuildsClassFilter,
  selectBuildsCursor,
  selectBuildsMyBuildsOnly,
  selectBuildsSearchText,
  selectBuildsSortMode,
  selectDetailBuild,
  selectDetailLiked,
  setClassFilter,
  setMyBuildsOnly,
  setSearchText,
  setSortMode,
  toggleLikeRequested,
  toggleLikeReverted,
  toggleLikeSettled,
  updateBuildFailed,
  updateBuildRequested,
  updateBuildSucceeded,
  type CreateBuildPayload,
  type UpdateBuildPayload,
} from './buildsSlice';

// Embeds the author profile. The FK hint (!builds_user_id_fkey) is required to
// disambiguate: PostgREST also infers a many-to-many builds<->profiles path via
// the `likes` table, so a bare `profiles` embed errors with PGRST201.
const BUILDS_SELECT = '*, profiles!builds_user_id_fkey(display_name, discriminator, avatar_url)';

function cursorFromItem(item: BuildWithAuthor): BuildListCursor {
  return { likesCount: item.likes_count, createdAt: item.created_at, id: item.id };
}

// Which of the given builds the signed-in viewer has liked, so the listing can show a
// filled heart. Non-fatal: on error (or logged out) we just return none.
function* fetchLikedBuildIds(userId: string | null, buildIds: readonly string[]) {
  if (userId === null || buildIds.length === 0) return [] as string[];
  const client = requireSupabase();
  const { data, error } = (yield call(() =>
    client
      .from('likes')
      .select('build_id')
      .eq('user_id', userId)
      .in('build_id', [...buildIds])
  )) as { data: { build_id: string }[] | null; error: { message: string } | null };
  if (error) return [] as string[];
  return (data ?? []).map((row) => row.build_id);
}

function* fetchBuildsPage(append: boolean) {
  const client = requireSupabase();
  const searchText = (yield select(selectBuildsSearchText)) as string;
  const classFilter = (yield select(selectBuildsClassFilter)) as string | null;
  const sortMode = (yield select(selectBuildsSortMode)) as BuildSortMode;
  const myBuildsOnly = (yield select(selectBuildsMyBuildsOnly)) as boolean;
  const userId = (yield select(selectAuthUserId)) as string | null;
  const cursor = append ? ((yield select(selectBuildsCursor)) as BuildListCursor | null) : null;

  let query = client.from('builds').select(BUILDS_SELECT);

  const trimmed = searchText.trim();
  if (trimmed.length > 0) query = query.ilike('name', `%${trimmed}%`);
  if (classFilter !== null) query = query.eq('class', classFilter);
  if (myBuildsOnly && userId !== null) query = query.eq('user_id', userId);

  if (sortMode === 'most_liked') query = query.order('likes_count', { ascending: false });
  query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

  if (append && cursor !== null) query = query.or(buildCursorOrFilter(sortMode, cursor));
  query = query.limit(BUILDS_PAGE_SIZE);

  const { data, error } = (yield call(() => query)) as { data: BuildWithAuthor[] | null; error: { message: string } | null };
  if (error) throw new Error(error.message);

  const items = data ?? [];
  const hasMore = items.length === BUILDS_PAGE_SIZE;
  const nextCursor = items.length > 0 ? cursorFromItem(items[items.length - 1]) : append ? cursor : null;
  const likedIds = (yield call(
    fetchLikedBuildIds,
    userId,
    items.map((item) => item.id)
  )) as string[];
  yield put(fetchBuildsSuccess({ items, cursor: nextCursor, hasMore, append, likedIds }));
}

function* handleFetchBuilds() {
  try {
    yield call(fetchBuildsPage, false);
  } catch (error) {
    yield put(fetchBuildsFailure(error instanceof Error ? error.message : 'Failed to load builds.'));
  }
}

function* handleFetchMore() {
  try {
    yield call(fetchBuildsPage, true);
  } catch (error) {
    yield put(fetchBuildsFailure(error instanceof Error ? error.message : 'Failed to load more builds.'));
  }
}

// Any filter/sort change refetches from the start.
function* handleFilterChanged() {
  yield put(fetchBuildsRequested());
}

function* handleCreateBuild(action: PayloadAction<CreateBuildPayload>) {
  try {
    const client = requireSupabase();
    const userId = (yield select(selectAuthUserId)) as string | null;
    if (userId === null) throw new Error('You must be signed in to create a build.');

    const esrMeta = (yield call(() => db.metadata.get('esrVersion'))) as Metadata | undefined;
    const { name, description, class: characterClass, buildData } = action.payload;
    const trimmedDescription = description.trim();

    const { data, error } = (yield call(() =>
      client
        .from('builds')
        .insert({
          user_id: userId,
          name: name.trim(),
          description: trimmedDescription.length > 0 ? trimmedDescription : null,
          class: characterClass,
          build_data: buildData as unknown as Json,
          esr_version: esrMeta?.value ?? null,
        })
        .select('id')
        .single()
    )) as { data: { id: string } | null; error: { message: string } | null };
    if (error) throw new Error(error.message);

    if (data) {
      yield put(createBuildSucceeded({ id: data.id }));
      yield call(toast.success, 'Build created.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save the build.';
    yield put(createBuildFailed(message));
    yield call(toast.error, message);
  }
}

function* handleUpdateBuild(action: PayloadAction<UpdateBuildPayload>) {
  try {
    const client = requireSupabase();
    const esrMeta = (yield call(() => db.metadata.get('esrVersion'))) as Metadata | undefined;
    const { id, name, description, class: characterClass, buildData } = action.payload;
    const trimmedDescription = description.trim();
    // Refresh all item snapshots to the current local ESR data on edit.
    const refreshed = (yield call(refreshBuildData, buildData)) as BuildData;

    const { error } = (yield call(() =>
      client
        .from('builds')
        .update({
          name: name.trim(),
          description: trimmedDescription.length > 0 ? trimmedDescription : null,
          class: characterClass,
          build_data: refreshed as unknown as Json,
          esr_version_updated: esrMeta?.value ?? null,
        })
        .eq('id', id)
    )) as { error: { message: string } | null };
    if (error) throw new Error(error.message);

    yield put(updateBuildSucceeded({ id }));
    yield call(toast.success, 'Build updated.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save the build.';
    yield put(updateBuildFailed());
    yield call(toast.error, message);
  }
}

function* handleFetchBuild(action: PayloadAction<string>) {
  const buildId = action.payload;
  if (!isUuid(buildId)) {
    yield put(fetchBuildNotFound());
    return;
  }
  try {
    const client = requireSupabase();
    const userId = (yield select(selectAuthUserId)) as string | null;

    const { data: build, error } = (yield call(() => client.from('builds').select(BUILDS_SELECT).eq('id', buildId).maybeSingle())) as {
      data: BuildWithAuthor | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    if (build === null) {
      yield put(fetchBuildNotFound());
      return;
    }

    let liked = false;
    if (userId !== null) {
      const { data: likeRow } = (yield call(() =>
        client.from('likes').select('build_id').eq('build_id', buildId).eq('user_id', userId).maybeSingle()
      )) as { data: { build_id: string } | null; error: { message: string } | null };
      liked = likeRow !== null;
    }

    yield put(fetchBuildSuccess({ build, liked }));
  } catch {
    yield put(fetchBuildFailure());
  }
}

// The optimistic flip has already been applied by the reducer, so selectDetailLiked
// reflects the desired end state: true -> insert a like, false -> remove it.
function* handleToggleLike() {
  const userId = (yield select(selectAuthUserId)) as string | null;
  const build = (yield select(selectDetailBuild)) as BuildWithAuthor | null;
  if (userId === null || build === null) return;
  const liked = (yield select(selectDetailLiked)) as boolean;

  try {
    const client = requireSupabase();
    if (liked) {
      const { error } = (yield call(() => client.from('likes').insert({ build_id: build.id, user_id: userId }))) as {
        error: { message: string } | null;
      };
      if (error) throw new Error(error.message);
    } else {
      const { error } = (yield call(() => client.from('likes').delete().eq('build_id', build.id).eq('user_id', userId))) as {
        error: { message: string } | null;
      };
      if (error) throw new Error(error.message);
    }
    yield put(toggleLikeSettled());
  } catch {
    yield put(toggleLikeReverted());
    yield call(toast.error, 'Could not update your like. Please try again.');
  }
}

function* handleDeleteBuild(action: PayloadAction<string>) {
  try {
    const client = requireSupabase();
    const { error } = (yield call(() => client.from('builds').delete().eq('id', action.payload))) as {
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    yield put(deleteBuildSucceeded());
    yield call(toast.success, 'Build deleted.');
  } catch {
    yield put(deleteBuildFailed());
    yield call(toast.error, 'Could not delete the build. Please try again.');
  }
}

// Fetches one page of a specific author's builds, newest first (no sort toggle
// on the profile page). Reuses the same keyset cursor as the main listing.
function* fetchAuthorBuildsPage(authorId: string, append: boolean) {
  const client = requireSupabase();
  const cursor = append ? ((yield select(selectAuthorBuildsCursor)) as BuildListCursor | null) : null;

  let query = client.from('builds').select(BUILDS_SELECT).eq('user_id', authorId);
  query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
  if (append && cursor !== null) query = query.or(buildCursorOrFilter('newest', cursor));
  query = query.limit(BUILDS_PAGE_SIZE);

  const { data, error } = (yield call(() => query)) as { data: BuildWithAuthor[] | null; error: { message: string } | null };
  if (error) throw new Error(error.message);

  const items = data ?? [];
  const hasMore = items.length === BUILDS_PAGE_SIZE;
  const nextCursor = items.length > 0 ? cursorFromItem(items[items.length - 1]) : append ? cursor : null;
  const viewerId = (yield select(selectAuthUserId)) as string | null;
  const likedIds = (yield call(
    fetchLikedBuildIds,
    viewerId,
    items.map((item) => item.id)
  )) as string[];
  yield put(fetchAuthorBuildsSuccess({ items, cursor: nextCursor, hasMore, append, likedIds }));
}

function* handleFetchAuthorProfile(action: PayloadAction<string>) {
  const userId = action.payload;
  if (!isUuid(userId)) {
    yield put(fetchAuthorProfileNotFound());
    return;
  }
  try {
    const client = requireSupabase();
    const { data: profile, error } = (yield call(() => client.from('profiles').select('*').eq('id', userId).maybeSingle())) as {
      data: Profile | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    if (profile === null) {
      yield put(fetchAuthorProfileNotFound());
      return;
    }
    yield put(fetchAuthorProfileSuccess(profile));
    yield call(fetchAuthorBuildsPage, userId, false);
  } catch {
    yield put(fetchAuthorProfileFailure());
  }
}

// On sign-out the "My Builds" toggle is hidden, but its flag lives in the slice and
// would otherwise persist — leaving the list stuck on an empty My-Builds view with
// no visible control to clear it. Reset it (which refetches via handleFilterChanged).
function* handleAuthChangedForBuilds(action: PayloadAction<{ user: AuthUser | null }>) {
  if (action.payload.user !== null) return;
  const myBuildsOnly = (yield select(selectBuildsMyBuildsOnly)) as boolean;
  if (myBuildsOnly) yield put(setMyBuildsOnly(false));
}

function* handleFetchMoreAuthorBuilds() {
  const profile = (yield select(selectAuthorProfile)) as Profile | null;
  if (profile === null) return;
  try {
    yield call(fetchAuthorBuildsPage, profile.id, true);
  } catch (error) {
    yield put(fetchAuthorBuildsFailure(error instanceof Error ? error.message : 'Failed to load more builds.'));
  }
}

export function* buildsSaga() {
  yield takeLatest([setSearchText.type, setClassFilter.type, setSortMode.type, setMyBuildsOnly.type], handleFilterChanged);
  yield takeLatest(fetchBuildsRequested.type, handleFetchBuilds);
  yield takeLatest(fetchMoreBuildsRequested.type, handleFetchMore);
  yield takeLatest(createBuildRequested.type, handleCreateBuild);
  yield takeLatest(updateBuildRequested.type, handleUpdateBuild);
  yield takeLatest(fetchBuildRequested.type, handleFetchBuild);
  yield takeLatest(toggleLikeRequested.type, handleToggleLike);
  yield takeLatest(deleteBuildRequested.type, handleDeleteBuild);
  yield takeLatest(fetchAuthorProfileRequested.type, handleFetchAuthorProfile);
  yield takeLatest(fetchMoreAuthorBuildsRequested.type, handleFetchMoreAuthorBuilds);
  yield takeLatest(authStateChanged.type, handleAuthChangedForBuilds);
}
