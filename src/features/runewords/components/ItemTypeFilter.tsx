import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAvailableItemTypes } from '../hooks/useAvailableItemTypes';
import {
  toggleItemType,
  toggleItemTypeGroup,
  selectAllItemTypes,
  deselectAllItemTypes,
  selectSelectedItemTypes,
} from '../store/runewordsSlice';
import { groupItemTypesByCategory, type GroupedItemTypes } from '../constants/itemTypeCategories';

type GroupState = 'all' | 'some' | 'none';

function getGroupState(groupItemTypes: readonly string[], selectedItemTypes: Record<string, boolean>): GroupState {
  const selectedCount = groupItemTypes.filter((t) => selectedItemTypes[t] ?? true).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === groupItemTypes.length) return 'all';
  return 'some';
}

interface ItemGroupSectionProps {
  readonly group: GroupedItemTypes;
}

function ItemGroupSection({ group }: ItemGroupSectionProps) {
  const dispatch = useDispatch();
  const selectedItemTypes = useSelector(selectSelectedItemTypes);

  const groupState = getGroupState(group.itemTypes, selectedItemTypes);

  const handleGroupToggle = () => {
    const newSelected = groupState !== 'all';
    dispatch(toggleItemTypeGroup({ itemTypes: group.itemTypes, selected: newSelected }));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Group header with 3-way checkbox */}
      <label className="flex items-center gap-1.5 cursor-pointer shrink-0 md:min-w-32">
        <Checkbox
          checked={groupState === 'all' ? true : groupState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleGroupToggle}
        />
        <span className="font-bold text-sm text-muted-foreground">{group.label}:</span>
      </label>

      {/* Individual item type checkboxes */}
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
  );
}

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
          <ItemGroupSection key={group.label} group={group} />
        ))}
      </div>
    </div>
  );
}
