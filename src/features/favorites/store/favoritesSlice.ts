import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import { RequestState } from '@/core/types';
import type { RootState } from '@/core/store/store';

interface FavoritesState {
  /** Status of loading the signed-in user's own favourites. */
  readonly status: RequestState;
  /** item_ids the signed-in user has favourited. Empty when signed out. */
  readonly favoriteItemIds: readonly string[];
  /** item_ids with an in-flight toggle — used to disable the control and guard re-entry. */
  readonly pendingItemIds: readonly string[];
  /** Public favourite count per item_id. Sparse: only items with >= 1 favourite have an entry. */
  readonly counts: Record<string, number>;
  /** Status of loading the public counts. */
  readonly countsStatus: RequestState;
}

const initialState: FavoritesState = {
  status: RequestState.IDLE,
  favoriteItemIds: [],
  pendingItemIds: [],
  counts: {},
  countsStatus: RequestState.IDLE,
};

/**
 * Pure flip of a single item's favourite membership + its optimistic count.
 * Returns fresh objects so it works both as the optimistic update and (applied
 * again) as the revert — toggling twice returns to the original state. Counts
 * stay sparse (an item dropping to 0 loses its entry, mirroring the DB trigger).
 */
function flipFavorite(
  itemId: string,
  favoriteItemIds: readonly string[],
  counts: Record<string, number>
): { favoriteItemIds: string[]; counts: Record<string, number> } {
  const wasFavorite = favoriteItemIds.includes(itemId);
  const nextIds = wasFavorite ? favoriteItemIds.filter((id) => id !== itemId) : [...favoriteItemIds, itemId];
  const nextCount = (counts[itemId] ?? 0) + (wasFavorite ? -1 : 1);
  // Rebuild without this item, then re-add only when positive — keeps the map
  // sparse (no zero entries) and avoids a dynamic `delete`.
  const nextCounts: Record<string, number> = Object.fromEntries(Object.entries(counts).filter(([id]) => id !== itemId));
  if (nextCount > 0) {
    nextCounts[itemId] = nextCount;
  }
  return { favoriteItemIds: nextIds, counts: nextCounts };
}

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    // --- The signed-in user's own favourites ---
    favoritesLoadRequested(state) {
      state.status = RequestState.LOADING;
    },
    favoritesLoadSucceeded(state, action: PayloadAction<readonly string[]>) {
      state.favoriteItemIds = [...action.payload];
      state.status = RequestState.SUCCESS;
    },
    favoritesLoadFailed(state) {
      state.status = RequestState.ERROR;
    },
    favoritesCleared(state) {
      // On sign-out: drop the user's favourites and any in-flight toggles.
      // Public counts are left intact — they're shown to everyone.
      state.favoriteItemIds = [];
      state.pendingItemIds = [];
      state.status = RequestState.IDLE;
    },

    // --- Public counts ---
    countsLoadRequested(state) {
      state.countsStatus = RequestState.LOADING;
    },
    countsLoadSucceeded(state, action: PayloadAction<Record<string, number>>) {
      state.counts = action.payload;
      state.countsStatus = RequestState.SUCCESS;
    },
    countsLoadFailed(state) {
      state.countsStatus = RequestState.ERROR;
    },

    // --- Toggle (optimistic) ---
    toggleFavoriteRequested(state, action: PayloadAction<string>) {
      const itemId = action.payload;
      const flipped = flipFavorite(itemId, state.favoriteItemIds, state.counts);
      state.favoriteItemIds = flipped.favoriteItemIds;
      state.counts = flipped.counts;
      if (!state.pendingItemIds.includes(itemId)) {
        state.pendingItemIds = [...state.pendingItemIds, itemId];
      }
    },
    toggleFavoriteReverted(state, action: PayloadAction<string>) {
      const itemId = action.payload;
      // Applying the same flip again undoes the optimistic change.
      const flipped = flipFavorite(itemId, state.favoriteItemIds, state.counts);
      state.favoriteItemIds = flipped.favoriteItemIds;
      state.counts = flipped.counts;
      state.pendingItemIds = state.pendingItemIds.filter((id) => id !== itemId);
    },
    toggleFavoriteSettled(state, action: PayloadAction<string>) {
      state.pendingItemIds = state.pendingItemIds.filter((id) => id !== action.payload);
    },
  },
});

export const {
  favoritesLoadRequested,
  favoritesLoadSucceeded,
  favoritesLoadFailed,
  favoritesCleared,
  countsLoadRequested,
  countsLoadSucceeded,
  countsLoadFailed,
  toggleFavoriteRequested,
  toggleFavoriteReverted,
  toggleFavoriteSettled,
} = favoritesSlice.actions;

export default favoritesSlice.reducer;

// --- Selectors ---

const selectFavoritesState = (state: RootState) => state.favorites;

export const selectFavoritesStatus = createSelector([selectFavoritesState], (s) => s.status);
export const selectFavoriteItemIds = createSelector([selectFavoritesState], (s) => s.favoriteItemIds);
export const selectFavoriteItemIdSet = createSelector([selectFavoriteItemIds], (ids) => new Set(ids));
export const selectFavoriteCounts = createSelector([selectFavoritesState], (s) => s.counts);
export const selectPendingFavoriteItemIds = createSelector([selectFavoritesState], (s) => s.pendingItemIds);
export const selectPendingFavoriteItemIdSet = createSelector([selectPendingFavoriteItemIds], (ids) => new Set(ids));
