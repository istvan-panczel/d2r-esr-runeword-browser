import type { PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';

/**
 * Shared search/sockets/level/item-type filter state used by recipe list slices
 * (runewords, gemwords). Spread `itemTypeFilterInitialState` into the slice's
 * initial state, `itemTypeFilterReducers` into its reducers, and build the
 * matching selectors with `createItemTypeFilterSelectors`.
 */
export interface ItemTypeFilterState {
  searchText: string;
  socketCount: number | null;
  maxReqLevel: number | null;
  selectedItemTypes: Record<string, boolean>;
}

export const itemTypeFilterInitialState: ItemTypeFilterState = {
  searchText: '',
  socketCount: null,
  maxReqLevel: null,
  selectedItemTypes: {},
};

export const itemTypeFilterReducers = {
  setSearchText(state: ItemTypeFilterState, action: PayloadAction<string>) {
    state.searchText = action.payload;
  },
  setSocketCount(state: ItemTypeFilterState, action: PayloadAction<number | null>) {
    state.socketCount = action.payload;
  },
  setMaxReqLevel(state: ItemTypeFilterState, action: PayloadAction<number | null>) {
    state.maxReqLevel = action.payload;
  },
  toggleItemType(state: ItemTypeFilterState, action: PayloadAction<string>) {
    const itemType = action.payload;
    state.selectedItemTypes[itemType] = !state.selectedItemTypes[itemType];
  },
  setAllItemTypes(state: ItemTypeFilterState, action: PayloadAction<Record<string, boolean>>) {
    state.selectedItemTypes = action.payload;
  },
  selectAllItemTypes(state: ItemTypeFilterState) {
    for (const key of Object.keys(state.selectedItemTypes)) {
      state.selectedItemTypes[key] = true;
    }
  },
  deselectAllItemTypes(state: ItemTypeFilterState) {
    for (const key of Object.keys(state.selectedItemTypes)) {
      state.selectedItemTypes[key] = false;
    }
  },
  toggleItemTypeGroup(state: ItemTypeFilterState, action: PayloadAction<{ itemTypes: readonly string[]; selected: boolean }>) {
    const { itemTypes, selected } = action.payload;
    for (const itemType of itemTypes) {
      state.selectedItemTypes[itemType] = selected;
    }
  },
};

interface ItemTypeFilterStateSlice {
  readonly searchText: string;
  readonly socketCount: number | null;
  readonly maxReqLevel: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
}

export function createItemTypeFilterSelectors<RootStateT>(selectFilterState: (state: RootStateT) => ItemTypeFilterStateSlice) {
  return {
    selectSearchText: createSelector([selectFilterState], (filterState) => filterState.searchText),
    selectSocketCount: createSelector([selectFilterState], (filterState) => filterState.socketCount),
    selectMaxReqLevel: createSelector([selectFilterState], (filterState) => filterState.maxReqLevel),
    selectSelectedItemTypes: createSelector([selectFilterState], (filterState) => filterState.selectedItemTypes),
  };
}
