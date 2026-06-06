import { useDispatch, useSelector } from 'react-redux';
import type { UnknownAction } from '@reduxjs/toolkit';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { groupItemTypesByCategory, type GroupedItemTypes } from '@/core/constants/itemTypeCategories';
import type { RootState } from '@/core/store';

export interface ItemTypeFilterActions {
  readonly toggleItemType: (itemType: string) => UnknownAction;
  readonly toggleItemTypeGroup: (payload: { itemTypes: readonly string[]; selected: boolean }) => UnknownAction;
  readonly selectAllItemTypes: () => UnknownAction;
  readonly deselectAllItemTypes: () => UnknownAction;
}

interface ItemTypeFilterProps {
  readonly itemTypes: readonly string[] | undefined;
  readonly selectSelectedItemTypes: (state: RootState) => Record<string, boolean>;
  readonly actions: ItemTypeFilterActions;
}

type GroupState = 'all' | 'some' | 'none';

function getGroupState(groupItemTypes: readonly string[], selectedItemTypes: Record<string, boolean>): GroupState {
  const selectedCount = groupItemTypes.filter((itemType) => selectedItemTypes[itemType] ?? true).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === groupItemTypes.length) return 'all';
  return 'some';
}

interface ItemGroupSectionProps {
  readonly group: GroupedItemTypes;
  readonly selectedItemTypes: Record<string, boolean>;
  readonly actions: ItemTypeFilterActions;
}

function ItemGroupSection({ group, selectedItemTypes, actions }: ItemGroupSectionProps) {
  const dispatch = useDispatch();
  const groupState = getGroupState(group.itemTypes, selectedItemTypes);

  const handleGroupToggle = () => {
    dispatch(actions.toggleItemTypeGroup({ itemTypes: group.itemTypes, selected: groupState !== 'all' }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[8rem_1fr] items-start gap-x-3 gap-y-1">
      <label className="flex h-7 items-center gap-1.5 cursor-pointer shrink-0">
        <Checkbox
          checked={groupState === 'all' ? true : groupState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleGroupToggle}
        />
        <span className="font-bold text-sm text-muted-foreground">{group.label}:</span>
      </label>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {group.itemTypes.map((itemType) => (
          <label key={itemType} className="flex h-7 cursor-pointer items-center gap-1">
            <Checkbox
              checked={selectedItemTypes[itemType] ?? true}
              onCheckedChange={() => {
                dispatch(actions.toggleItemType(itemType));
              }}
            />
            <span className="text-sm">{itemType}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Shared item-type filter UI. Each feature provides its available item types
 * plus the slice-specific actions/selector, so runewords and gemwords render
 * and behave identically while keeping independent filter state.
 */
export function ItemTypeFilter({ itemTypes, selectSelectedItemTypes, actions }: ItemTypeFilterProps) {
  const dispatch = useDispatch();
  const selectedItemTypes = useSelector(selectSelectedItemTypes);

  if (!itemTypes || itemTypes.length === 0) return null;

  const allSelected = itemTypes.every((type) => selectedItemTypes[type]);
  const noneSelected = itemTypes.every((type) => !selectedItemTypes[type]);
  const groups = groupItemTypesByCategory(itemTypes);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">Item Types:</span>
        <Button variant="outline" size="sm" onClick={() => dispatch(actions.selectAllItemTypes())} disabled={allSelected}>
          All
        </Button>
        <Button variant="outline" size="sm" onClick={() => dispatch(actions.deselectAllItemTypes())} disabled={noneSelected}>
          None
        </Button>
      </div>
      <div className="space-y-1.5">
        {groups.map((group) => (
          <ItemGroupSection key={group.label} group={group} selectedItemTypes={selectedItemTypes} actions={actions} />
        ))}
      </div>
    </div>
  );
}
