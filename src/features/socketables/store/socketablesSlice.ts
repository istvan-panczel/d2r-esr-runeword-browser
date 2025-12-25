import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { RootState } from '@/core/store/store';

export interface EnabledCategories {
  readonly gems: boolean;
  readonly esrRunes: boolean;
  readonly lodRunes: boolean;
  readonly kanjiRunes: boolean;
  readonly crystals: boolean;
}

interface SocketablesState {
  readonly enabledCategories: EnabledCategories;
  readonly searchText: string;
}

const initialState: SocketablesState = {
  enabledCategories: {
    gems: true,
    esrRunes: true,
    lodRunes: true,
    kanjiRunes: true,
    crystals: true,
  },
  searchText: '',
};

const socketablesSlice = createSlice({
  name: 'socketables',
  initialState,
  reducers: {
    toggleCategory(state, action: PayloadAction<keyof EnabledCategories>) {
      const category = action.payload;
      state.enabledCategories[category] = !state.enabledCategories[category];
    },
    setSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    selectAllCategories(state) {
      state.enabledCategories = {
        gems: true,
        esrRunes: true,
        lodRunes: true,
        kanjiRunes: true,
        crystals: true,
      };
    },
    initializeFromUrl(
      state,
      action: PayloadAction<{
        searchText?: string;
        enabledCategories?: EnabledCategories;
      }>
    ) {
      const { searchText, enabledCategories } = action.payload;
      if (searchText !== undefined) state.searchText = searchText;
      if (enabledCategories !== undefined) state.enabledCategories = enabledCategories;
    },
  },
});

export const { toggleCategory, setSearchText, selectAllCategories, initializeFromUrl } = socketablesSlice.actions;
export default socketablesSlice.reducer;

// Selectors
const selectSocketablesState = (state: RootState) => state.socketables;

export const selectEnabledCategories = createSelector([selectSocketablesState], (socketables) => socketables.enabledCategories);

export const selectSearchText = createSelector([selectSocketablesState], (socketables) => socketables.searchText);
