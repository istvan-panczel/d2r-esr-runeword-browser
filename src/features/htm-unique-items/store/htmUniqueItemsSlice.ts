import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { RootState } from '@/core/store/store';
import { NO_CATEGORIES_MARKER } from '@/core/constants/categoryFilter';

/**
 * State for HTM unique items feature
 * selectedCategories: Array of categories that are selected for filtering
 * Empty array means "all categories selected" (no category filtering)
 */
interface HtmUniqueItemsState {
  readonly searchText: string;
  readonly maxReqLevel: number | null;
  readonly selectedCategories: readonly string[];
  readonly includeCouponItems: boolean;
}

const initialState: HtmUniqueItemsState = {
  searchText: '',
  maxReqLevel: null,
  selectedCategories: [], // Empty = all selected
  includeCouponItems: true,
};

const htmUniqueItemsSlice = createSlice({
  name: 'htmUniqueItems',
  initialState,
  reducers: {
    setSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    setMaxReqLevel(state, action: PayloadAction<number | null>) {
      state.maxReqLevel = action.payload;
    },
    toggleCategory(
      state,
      action: PayloadAction<{
        category: string;
        allCategories: readonly string[];
      }>
    ) {
      const { category, allCategories } = action.payload;
      const currentSet = new Set(state.selectedCategories);

      if (currentSet.size === 0) {
        // All selected -> initialize with all except the toggled one
        state.selectedCategories = allCategories.filter((c) => c !== category);
      } else if (currentSet.has(category)) {
        currentSet.delete(category);
        state.selectedCategories = Array.from(currentSet);
      } else {
        currentSet.add(category);
        if (currentSet.size === allCategories.length) {
          state.selectedCategories = [];
        } else {
          state.selectedCategories = Array.from(currentSet);
        }
      }
    },
    toggleGroup(
      state,
      action: PayloadAction<{
        groupCategories: readonly string[];
        selected: boolean;
        allCategories: readonly string[];
      }>
    ) {
      const { groupCategories, selected, allCategories } = action.payload;
      const isNoneMarker = state.selectedCategories.length === 1 && state.selectedCategories[0] === NO_CATEGORIES_MARKER;
      const currentSet = new Set(state.selectedCategories.length === 0 ? allCategories : isNoneMarker ? [] : state.selectedCategories);

      if (selected) {
        for (const cat of groupCategories) {
          currentSet.add(cat);
        }
      } else {
        for (const cat of groupCategories) {
          currentSet.delete(cat);
        }
      }

      if (currentSet.size === allCategories.length) {
        state.selectedCategories = [];
      } else if (currentSet.size === 0) {
        state.selectedCategories = [NO_CATEGORIES_MARKER];
      } else {
        state.selectedCategories = Array.from(currentSet);
      }
    },
    selectAllCategories(state) {
      state.selectedCategories = [];
    },
    deselectAllCategories(state) {
      state.selectedCategories = [NO_CATEGORIES_MARKER];
    },
    setSelectedCategories(state, action: PayloadAction<readonly string[]>) {
      state.selectedCategories = [...action.payload];
    },
    setIncludeCouponItems(state, action: PayloadAction<boolean>) {
      state.includeCouponItems = action.payload;
    },
  },
});

export const {
  setSearchText,
  setMaxReqLevel,
  toggleCategory,
  toggleGroup,
  selectAllCategories,
  deselectAllCategories,
  setSelectedCategories,
  setIncludeCouponItems,
} = htmUniqueItemsSlice.actions;
export default htmUniqueItemsSlice.reducer;

// Selectors
const selectHtmUniqueItemsState = (state: RootState) => state.htmUniqueItems;

export const selectSearchText = createSelector([selectHtmUniqueItemsState], (s) => s.searchText);

export const selectMaxReqLevel = createSelector([selectHtmUniqueItemsState], (s) => s.maxReqLevel);

export const selectSelectedCategoriesRaw = createSelector([selectHtmUniqueItemsState], (s) => s.selectedCategories);

export const selectSelectedCategories = createSelector([selectSelectedCategoriesRaw], (selectedCategories): ReadonlySet<string> => {
  if (selectedCategories.length === 0) {
    return new Set(['__all__']);
  }
  return new Set(selectedCategories);
});

export const selectIsAllCategoriesSelected = createSelector(
  [selectSelectedCategoriesRaw],
  (selectedCategories) => selectedCategories.length === 0
);

export const selectIncludeCouponItems = createSelector([selectHtmUniqueItemsState], (s) => s.includeCouponItems);
