import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { RootState } from '@/core/store/store';

/**
 * State for mythical uniques feature.
 * selectedCategories: Empty array means "all categories selected" (no filtering).
 */
interface MythicalUniquesState {
  readonly searchText: string;
  readonly selectedCategories: readonly string[];
}

const initialState: MythicalUniquesState = {
  searchText: '',
  selectedCategories: [], // Empty = all selected
};

const mythicalUniquesSlice = createSlice({
  name: 'mythicalUniques',
  initialState,
  reducers: {
    setSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
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
    selectAllCategories(state) {
      state.selectedCategories = [];
    },
    deselectAllCategories(state) {
      state.selectedCategories = ['__none__'];
    },
    setSelectedCategories(state, action: PayloadAction<readonly string[]>) {
      state.selectedCategories = [...action.payload];
    },
  },
});

export const { setSearchText, toggleCategory, selectAllCategories, deselectAllCategories, setSelectedCategories } =
  mythicalUniquesSlice.actions;
export default mythicalUniquesSlice.reducer;

// Selectors
const selectMythicalUniquesState = (state: RootState) => state.mythicalUniques;

export const selectSearchText = createSelector([selectMythicalUniquesState], (s) => s.searchText);

export const selectSelectedCategoriesRaw = createSelector([selectMythicalUniquesState], (s) => s.selectedCategories);

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
