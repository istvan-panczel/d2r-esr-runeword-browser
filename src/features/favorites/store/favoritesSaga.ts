import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { toast } from 'sonner';
import { requireSupabase } from '@/core/supabase';
import type { FavoriteCount, FavoriteInsert } from '@/core/supabase/types';
import { authStateChanged, selectAuthUserId, type AuthUser } from '@/features/auth/store/authSlice';
import { collectLegacyFavoriteIds, hasMigratedLocalFavorites, markLocalFavoritesMigrated } from '../utils/localFavoritesMigration';
import {
  countsLoadFailed,
  countsLoadRequested,
  countsLoadSucceeded,
  favoritesCleared,
  favoritesLoadFailed,
  favoritesLoadRequested,
  favoritesLoadSucceeded,
  selectFavoriteItemIdSet,
  toggleFavoriteRequested,
  toggleFavoriteReverted,
  toggleFavoriteSettled,
} from './favoritesSlice';

// Public favourite counts for every favourited item. The table is sparse (only
// items with >= 1 favourite), so a single unfiltered read is cheap. Non-fatal:
// on error the count badges just stay hidden (0).
function* loadCounts() {
  try {
    yield put(countsLoadRequested());
    const client = requireSupabase();
    const { data, error } = (yield call(() => client.from('favorite_counts').select('item_id, count'))) as {
      data: FavoriteCount[] | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.item_id] = row.count;
    yield put(countsLoadSucceeded(counts));
  } catch {
    yield put(countsLoadFailed());
  }
}

// One-time upload of any favourites left in localStorage from before favourites
// moved to Supabase. Returns the user's full favourite id set (remote + migrated).
// On failure it leaves the local data intact to retry on the next sign-in.
function* migrateLegacyFavorites(userId: string, remoteIds: readonly string[]) {
  if (hasMigratedLocalFavorites()) return remoteIds;

  const toUpload = collectLegacyFavoriteIds().filter((id) => !remoteIds.includes(id));
  if (toUpload.length > 0) {
    const client = requireSupabase();
    const rows: FavoriteInsert[] = toUpload.map((item_id) => ({ user_id: userId, item_id }));
    const { error } = (yield call(() =>
      client.from('favorites').upsert(rows, { onConflict: 'user_id,item_id', ignoreDuplicates: true })
    )) as {
      error: { message: string } | null;
    };
    if (error) return remoteIds;
  }

  markLocalFavoritesMigrated();
  // remoteIds and toUpload are disjoint by construction, so no dedupe needed.
  return [...remoteIds, ...toUpload];
}

function* loadUserFavorites(userId: string) {
  try {
    yield put(favoritesLoadRequested());
    const client = requireSupabase();
    const { data, error } = (yield call(() => client.from('favorites').select('item_id').eq('user_id', userId))) as {
      data: { item_id: string }[] | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    const remoteIds = (data ?? []).map((row) => row.item_id);
    const mergedIds = (yield call(migrateLegacyFavorites, userId, remoteIds)) as readonly string[];
    yield put(favoritesLoadSucceeded(mergedIds));
    // The migration uploaded new favourites (mergedIds grew), so the public counts
    // changed server-side via the trigger — refresh them so the badges aren't stale.
    if (mergedIds.length > remoteIds.length) yield call(loadCounts);
  } catch {
    yield put(favoritesLoadFailed());
  }
}

function* handleAuthChanged(action: PayloadAction<{ user: AuthUser | null }>) {
  const { user } = action.payload;
  if (user === null) {
    yield put(favoritesCleared());
    return;
  }
  yield call(loadUserFavorites, user.id);
}

// The reducer has already applied the optimistic flip, so selectFavoriteItemIdSet
// reflects the desired end state: present -> insert the favourite, absent -> delete it.
// `inFlight` (one Set per saga run) guards against a stray duplicate dispatch for the
// same id racing a second network op against the first.
function* handleToggleFavorite(inFlight: Set<string>, action: PayloadAction<string>) {
  const itemId = action.payload;
  if (inFlight.has(itemId)) {
    // A toggle for this id is already in flight (the button disables on pending, so
    // this is a stray duplicate). Undo its optimistic flip and skip the racing write,
    // keeping the UI and DB consistent with the first toggle.
    yield put(toggleFavoriteReverted(itemId));
    return;
  }

  const userId = (yield select(selectAuthUserId)) as string | null;
  if (userId === null) {
    // Should not happen (the UI prompts sign-in instead of dispatching), but if it
    // does, nothing was persisted — undo the optimistic flip.
    yield put(toggleFavoriteReverted(itemId));
    return;
  }

  const favoriteIdSet = (yield select(selectFavoriteItemIdSet)) as Set<string>;
  const nowFavorite = favoriteIdSet.has(itemId);

  inFlight.add(itemId);
  try {
    const client = requireSupabase();
    if (nowFavorite) {
      const { error } = (yield call(() => client.from('favorites').insert({ user_id: userId, item_id: itemId }))) as {
        error: { message: string } | null;
      };
      if (error) throw new Error(error.message);
    } else {
      const { error } = (yield call(() => client.from('favorites').delete().eq('user_id', userId).eq('item_id', itemId))) as {
        error: { message: string } | null;
      };
      if (error) throw new Error(error.message);
    }
    yield put(toggleFavoriteSettled(itemId));
  } catch {
    yield put(toggleFavoriteReverted(itemId));
    yield call(toast.error, 'Could not update your favourite. Please try again.');
  } finally {
    inFlight.delete(itemId);
  }
}

export function* favoritesSaga() {
  // One Set per saga run (not module-global) tracks in-flight toggles by item id.
  const inFlight = new Set<string>();
  // Arm the watchers before the initial loads so a sign-in that lands mid-load isn't missed.
  yield takeEvery(toggleFavoriteRequested.type, handleToggleFavorite, inFlight);
  yield takeLatest(authStateChanged.type, handleAuthChanged);

  // Public counts load for everyone; the user's own favourites load if a session
  // was already restored before this saga registered its auth watcher.
  yield call(loadCounts);
  const userId = (yield select(selectAuthUserId)) as string | null;
  if (userId !== null) yield call(loadUserFavorites, userId);
}
