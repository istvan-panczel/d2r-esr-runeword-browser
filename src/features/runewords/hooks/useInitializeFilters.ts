import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRuneGroups } from './useRuneGroups';
import { useAvailableItemTypes } from './useAvailableItemTypes';
import { setAllRunes, setAllItemTypes, selectSelectedRunes, selectSelectedItemTypes } from '../store/runewordsSlice';

export function useInitializeFilters(): void {
  const dispatch = useDispatch();
  const runeGroups = useRuneGroups();
  const itemTypes = useAvailableItemTypes();
  const selectedRunes = useSelector(selectSelectedRunes);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);

  // Initialize runes (all selected by default) - using compound keys with category
  useEffect(() => {
    // Skip if data not loaded yet or empty (prevents infinite loop when DB is empty)
    if (!runeGroups || runeGroups.length === 0) return;
    // Skip if already initialized
    if (Object.keys(selectedRunes).length > 0) return;

    const allRunes: Record<string, boolean> = {};
    for (const group of runeGroups) {
      for (const rune of group.runes) {
        const key = `${group.category}:${rune}`;
        allRunes[key] = true;
      }
    }
    dispatch(setAllRunes(allRunes));
  }, [runeGroups, selectedRunes, dispatch]);

  // Initialize item types (all selected by default)
  useEffect(() => {
    // Skip if data not loaded yet or empty (prevents infinite loop when DB is empty)
    if (!itemTypes || itemTypes.length === 0) return;
    // Skip if already initialized
    if (Object.keys(selectedItemTypes).length > 0) return;

    const allTypes: Record<string, boolean> = {};
    for (const type of itemTypes) {
      allTypes[type] = true;
    }
    dispatch(setAllItemTypes(allTypes));
  }, [itemTypes, selectedItemTypes, dispatch]);
}
