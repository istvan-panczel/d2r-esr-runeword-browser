import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { RootState } from '@/core/store/store';

interface RunewordsState {
  readonly searchText: string;
  readonly socketCount: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
  readonly selectedRunes: Record<string, boolean>;
}

const initialState: RunewordsState = {
  searchText: '',
  socketCount: null,
  selectedItemTypes: {},
  selectedRunes: {},
};

const runewordsSlice = createSlice({
  name: 'runewords',
  initialState,
  reducers: {
    setSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    setSocketCount(state, action: PayloadAction<number | null>) {
      state.socketCount = action.payload;
    },
    toggleItemType(state, action: PayloadAction<string>) {
      const itemType = action.payload;
      state.selectedItemTypes[itemType] = !state.selectedItemTypes[itemType];
    },
    setAllItemTypes(state, action: PayloadAction<Record<string, boolean>>) {
      state.selectedItemTypes = action.payload;
    },
    selectAllItemTypes(state) {
      for (const key of Object.keys(state.selectedItemTypes)) {
        state.selectedItemTypes[key] = true;
      }
    },
    deselectAllItemTypes(state) {
      for (const key of Object.keys(state.selectedItemTypes)) {
        state.selectedItemTypes[key] = false;
      }
    },
    toggleRune(state, action: PayloadAction<string>) {
      const rune = action.payload;
      state.selectedRunes[rune] = !state.selectedRunes[rune];
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
    toggleRuneGroup(state, action: PayloadAction<{ runes: readonly string[]; selected: boolean }>) {
      const { runes, selected } = action.payload;
      for (const rune of runes) {
        state.selectedRunes[rune] = selected;
      }
    },
  },
});

export const {
  setSearchText,
  setSocketCount,
  toggleItemType,
  setAllItemTypes,
  selectAllItemTypes,
  deselectAllItemTypes,
  toggleRune,
  setAllRunes,
  selectAllRunes,
  deselectAllRunes,
  toggleRuneGroup,
} = runewordsSlice.actions;

export default runewordsSlice.reducer;

// Selectors
const selectRunewordsState = (state: RootState) => state.runewords;

export const selectSearchText = createSelector([selectRunewordsState], (runewords) => runewords.searchText);

export const selectSocketCount = createSelector([selectRunewordsState], (runewords) => runewords.socketCount);

export const selectSelectedItemTypes = createSelector([selectRunewordsState], (runewords) => runewords.selectedItemTypes);

export const selectSelectedRunes = createSelector([selectRunewordsState], (runewords) => runewords.selectedRunes);
