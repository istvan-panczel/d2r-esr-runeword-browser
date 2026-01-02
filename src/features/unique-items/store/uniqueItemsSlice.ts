import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { RootState } from '@/core/store/store';

/**
 * State for unique items feature
 * selectedTypeCodes: Array of type codes that are selected for filtering
 * Empty array means "all types selected" (no type filtering)
 */
interface UniqueItemsState {
  readonly searchText: string;
  readonly selectedTypeCodes: readonly string[];
  readonly includeCouponItems: boolean;
}

const initialState: UniqueItemsState = {
  searchText: '',
  selectedTypeCodes: [], // Empty = all selected
  includeCouponItems: true, // Include Ancient Coupon items by default
};

const uniqueItemsSlice = createSlice({
  name: 'uniqueItems',
  initialState,
  reducers: {
    setSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    /**
     * Toggle a single type code selection
     * @param allTypeCodes - All available type codes (needed when toggling from "all selected" state)
     */
    toggleTypeCode(
      state,
      action: PayloadAction<{
        typeCode: string;
        allTypeCodes: readonly string[];
      }>
    ) {
      const { typeCode, allTypeCodes } = action.payload;
      const currentSet = new Set(state.selectedTypeCodes);

      // If empty (all selected), initialize with all codes except the toggled one
      if (currentSet.size === 0) {
        state.selectedTypeCodes = allTypeCodes.filter((code) => code !== typeCode);
      } else if (currentSet.has(typeCode)) {
        // Remove if present
        currentSet.delete(typeCode);
        state.selectedTypeCodes = Array.from(currentSet);
      } else {
        // Add if not present
        currentSet.add(typeCode);
        // If all are now selected, return to empty array (all selected state)
        if (currentSet.size === allTypeCodes.length) {
          state.selectedTypeCodes = [];
        } else {
          state.selectedTypeCodes = Array.from(currentSet);
        }
      }
    },
    /**
     * Toggle all types in a group
     */
    toggleGroup(
      state,
      action: PayloadAction<{
        groupTypeCodes: readonly string[];
        selected: boolean;
        allTypeCodes: readonly string[];
      }>
    ) {
      const { groupTypeCodes, selected, allTypeCodes } = action.payload;
      const currentSet = new Set(state.selectedTypeCodes.length === 0 ? allTypeCodes : state.selectedTypeCodes);

      if (selected) {
        // Add all group types
        for (const code of groupTypeCodes) {
          currentSet.add(code);
        }
      } else {
        // Remove all group types
        for (const code of groupTypeCodes) {
          currentSet.delete(code);
        }
      }

      // If all are selected, return to empty array
      if (currentSet.size === allTypeCodes.length) {
        state.selectedTypeCodes = [];
      } else {
        state.selectedTypeCodes = Array.from(currentSet);
      }
    },
    /**
     * Select all types (reset to empty array)
     */
    selectAllTypes(state) {
      state.selectedTypeCodes = [];
    },
    /**
     * Deselect all types
     */
    deselectAllTypes(state) {
      state.selectedTypeCodes = ['__none__']; // Special marker for "none selected"
    },
    /**
     * Set selected type codes directly (for URL initialization)
     */
    setSelectedTypeCodes(state, action: PayloadAction<readonly string[]>) {
      state.selectedTypeCodes = [...action.payload];
    },
    /**
     * Toggle inclusion of Ancient Coupon items
     */
    setIncludeCouponItems(state, action: PayloadAction<boolean>) {
      state.includeCouponItems = action.payload;
    },
  },
});

export const { setSearchText, toggleTypeCode, toggleGroup, selectAllTypes, deselectAllTypes, setSelectedTypeCodes, setIncludeCouponItems } =
  uniqueItemsSlice.actions;
export default uniqueItemsSlice.reducer;

// Selectors
const selectUniqueItemsState = (state: RootState) => state.uniqueItems;

export const selectSearchText = createSelector([selectUniqueItemsState], (uniqueItems) => uniqueItems.searchText);

/**
 * Get the raw selected type codes array
 */
export const selectSelectedTypeCodesRaw = createSelector([selectUniqueItemsState], (uniqueItems) => uniqueItems.selectedTypeCodes);

/**
 * Get selected type codes as a Set for efficient filtering
 * If empty array (all selected), returns a Set that matches everything
 * This is handled in the filtering logic, not here
 */
export const selectSelectedTypeCodes = createSelector([selectSelectedTypeCodesRaw], (selectedTypeCodes): ReadonlySet<string> => {
  // Special case: empty array means "all selected"
  // We return an empty set here; the filtering logic checks for this
  if (selectedTypeCodes.length === 0) {
    // Return a special "select all" marker set
    return new Set(['__all__']);
  }
  return new Set(selectedTypeCodes);
});

/**
 * Check if all types are selected (empty array state)
 */
export const selectIsAllTypesSelected = createSelector([selectSelectedTypeCodesRaw], (selectedTypeCodes) => selectedTypeCodes.length === 0);

/**
 * Get the include coupon items setting
 */
export const selectIncludeCouponItems = createSelector([selectUniqueItemsState], (uniqueItems) => uniqueItems.includeCouponItems);
