export { default as favoritesReducer } from './favoritesSlice';
export {
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
  selectFavoritesStatus,
  selectFavoriteItemIds,
  selectFavoriteItemIdSet,
  selectFavoriteCounts,
  selectPendingFavoriteItemIds,
  selectPendingFavoriteItemIdSet,
} from './favoritesSlice';

// NOTE: favoritesSaga is intentionally NOT re-exported here (it imports the heavy
// Supabase client). startup.ts loads it via a deep dynamic import, keeping the
// SDK out of any chunk that only needs the slice's actions/selectors — the
// favourites toggle ships on the runewords/gemwords/uniques screens.
