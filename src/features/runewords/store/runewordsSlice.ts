import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import { createItemTypeFilterSelectors, itemTypeFilterInitialState, itemTypeFilterReducers } from '@/core/store/itemTypeFilter';
import type { RootState } from '@/core/store/store';

interface RunewordsState {
  readonly searchText: string;
  readonly socketCount: number | null;
  readonly maxReqLevel: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
  readonly selectedRunes: Record<string, boolean>;
  readonly maxTierPoints: Record<string, number | null>;
}

const initialState: RunewordsState = {
  ...itemTypeFilterInitialState,
  selectedRunes: {},
  maxTierPoints: {},
};

const runewordsSlice = createSlice({
  name: 'runewords',
  initialState,
  reducers: {
    ...itemTypeFilterReducers,
    toggleRune(state, action: PayloadAction<{ rune: string; category: string }>) {
      const { rune, category } = action.payload;
      const key = `${category}:${rune}`;
      state.selectedRunes[key] = !state.selectedRunes[key];
    },
    setAllRunes(state, action: PayloadAction<Record<string, boolean>>) {
      state.selectedRunes = action.payload;
    },
    selectAllRunes(state) {
      for (const key of Object.keys(state.selectedRunes)) {
        state.selectedRunes[key] = true;
      }
    },
    deselectAllRunes(state) {
      for (const key of Object.keys(state.selectedRunes)) {
        state.selectedRunes[key] = false;
      }
    },
    toggleRuneGroup(state, action: PayloadAction<{ runes: readonly string[]; category: string; selected: boolean }>) {
      const { runes, category, selected } = action.payload;
      for (const rune of runes) {
        const key = `${category}:${rune}`;
        state.selectedRunes[key] = selected;
      }
    },
    setMaxTierPoints(state, action: PayloadAction<{ tierKey: string; value: number | null }>) {
      state.maxTierPoints[action.payload.tierKey] = action.payload.value;
    },
    clearAllTierPoints(state) {
      state.maxTierPoints = {};
    },
  },
});

export const {
  setSearchText,
  setSocketCount,
  setMaxReqLevel,
  toggleItemType,
  setAllItemTypes,
  selectAllItemTypes,
  deselectAllItemTypes,
  toggleRune,
  setAllRunes,
  selectAllRunes,
  deselectAllRunes,
  toggleRuneGroup,
  toggleItemTypeGroup,
  setMaxTierPoints,
  clearAllTierPoints,
} = runewordsSlice.actions;

export default runewordsSlice.reducer;

// Selectors
const selectRunewordsState = (state: RootState) => state.runewords;

export const { selectSearchText, selectSocketCount, selectMaxReqLevel, selectSelectedItemTypes } =
  createItemTypeFilterSelectors(selectRunewordsState);

export const selectSelectedRunes = createSelector([selectRunewordsState], (runewords) => runewords.selectedRunes);

export const selectMaxTierPoints = createSelector([selectRunewordsState], (runewords) => runewords.maxTierPoints);
