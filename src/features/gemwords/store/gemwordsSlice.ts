import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import { createItemTypeFilterSelectors, itemTypeFilterInitialState, itemTypeFilterReducers } from '@/core/store/itemTypeFilter';
import type { RootState } from '@/core/store/store';

interface GemwordsState {
  readonly searchText: string;
  readonly socketCount: number | null;
  readonly maxReqLevel: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
  readonly selectedGems: Record<string, boolean>;
}

const initialState: GemwordsState = {
  ...itemTypeFilterInitialState,
  selectedGems: {},
};

const gemwordsSlice = createSlice({
  name: 'gemwords',
  initialState,
  reducers: {
    ...itemTypeFilterReducers,
    toggleGem(state, action: PayloadAction<string>) {
      const gem = action.payload;
      state.selectedGems[gem] = !state.selectedGems[gem];
    },
    setAllGems(state, action: PayloadAction<Record<string, boolean>>) {
      state.selectedGems = action.payload;
    },
    selectAllGems(state) {
      for (const key of Object.keys(state.selectedGems)) {
        state.selectedGems[key] = true;
      }
    },
    deselectAllGems(state) {
      for (const key of Object.keys(state.selectedGems)) {
        state.selectedGems[key] = false;
      }
    },
    toggleGemGroup(state, action: PayloadAction<{ gems: readonly string[]; selected: boolean }>) {
      const { gems, selected } = action.payload;
      for (const gem of gems) {
        state.selectedGems[gem] = selected;
      }
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
  toggleItemTypeGroup,
  toggleGem,
  setAllGems,
  selectAllGems,
  deselectAllGems,
  toggleGemGroup,
} = gemwordsSlice.actions;

export default gemwordsSlice.reducer;

const selectGemwordsState = (state: RootState) => state.gemwords;

export const { selectSearchText, selectSocketCount, selectMaxReqLevel, selectSelectedItemTypes } =
  createItemTypeFilterSelectors(selectGemwordsState);

export const selectSelectedGems = createSelector([selectGemwordsState], (gemwords) => gemwords.selectedGems);
