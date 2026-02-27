import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAvailableItemTypes } from '../hooks/useAvailableItemTypes';
import { toggleItemType, selectAllItemTypes, deselectAllItemTypes, selectSelectedItemTypes } from '../store/runewordsSlice';
import { groupItemTypesByCategory } from '../constants/itemTypeCategories';

export function ItemTypeFilter() {
  const dispatch = useDispatch();
  const itemTypes = useAvailableItemTypes();
  const selectedItemTypes = useSelector(selectSelectedItemTypes);

  if (!itemTypes || itemTypes.length === 0) return null;

  const allSelected = itemTypes.every((type) => selectedItemTypes[type]);
  const noneSelected = itemTypes.every((type) => !selectedItemTypes[type]);
  const groups = groupItemTypesByCategory(itemTypes);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">Item Types:</span>
        <Button variant="outline" size="sm" onClick={() => dispatch(selectAllItemTypes())} disabled={allSelected}>
          All
        </Button>
        <Button variant="outline" size="sm" onClick={() => dispatch(deselectAllItemTypes())} disabled={noneSelected}>
          None
        </Button>
      </div>
      <div className="space-y-1.5">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold text-sm text-muted-foreground shrink-0">{group.label}:</span>
            {group.itemTypes.map((itemType) => (
              <label key={itemType} className="flex items-center gap-1 cursor-pointer">
                <Checkbox
                  checked={selectedItemTypes[itemType] ?? true}
                  onCheckedChange={() => {
                    dispatch(toggleItemType(itemType));
                  }}
                />
                <span className="text-sm">{itemType}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
