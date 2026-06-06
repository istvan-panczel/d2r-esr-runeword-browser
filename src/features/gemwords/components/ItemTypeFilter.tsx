import { ItemTypeFilter as SharedItemTypeFilter } from '@/core/components/ItemTypeFilter';
import { useAvailableItemTypes } from '../hooks/useAvailableItemTypes';
import {
  toggleItemType,
  toggleItemTypeGroup,
  selectAllItemTypes,
  deselectAllItemTypes,
  selectSelectedItemTypes,
} from '../store/gemwordsSlice';

export function ItemTypeFilter() {
  const itemTypes = useAvailableItemTypes();

  return (
    <SharedItemTypeFilter
      itemTypes={itemTypes}
      selectSelectedItemTypes={selectSelectedItemTypes}
      actions={{ toggleItemType, toggleItemTypeGroup, selectAllItemTypes, deselectAllItemTypes }}
    />
  );
}
