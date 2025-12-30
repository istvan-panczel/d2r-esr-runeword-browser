import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toggleGroup, selectAllTypes, deselectAllTypes, selectSelectedTypeCodesRaw, selectIsAllTypesSelected } from '../store';
import { useItemTypeFilters, getAllTypeCodesFromGroups } from '../hooks';
import type { FilterGroup } from '../types';

type GroupState = 'all' | 'some' | 'none';

/**
 * Get all child codes from a filter group (flattened)
 */
function getGroupChildCodes(group: FilterGroup): string[] {
  const codes: string[] = [];
  for (const itemType of group.itemTypes) {
    codes.push(...itemType.childCodes);
  }
  return codes;
}

function getGroupState(groupChildCodes: readonly string[], selectedTypeCodes: readonly string[], isAllSelected: boolean): GroupState {
  // If all types are selected (empty array state), all groups are fully selected
  if (isAllSelected) {
    return 'all';
  }

  const selectedSet = new Set(selectedTypeCodes);
  const selectedCount = groupChildCodes.filter((code) => selectedSet.has(code)).length;

  if (selectedCount === 0) return 'none';
  if (selectedCount === groupChildCodes.length) return 'all';
  return 'some';
}

interface ItemGroupSectionProps {
  readonly group: FilterGroup;
  readonly allTypeCodes: readonly string[];
}

function ItemGroupSection({ group, allTypeCodes }: ItemGroupSectionProps) {
  const dispatch = useDispatch();
  const selectedTypeCodes = useSelector(selectSelectedTypeCodesRaw);
  const isAllSelected = useSelector(selectIsAllTypesSelected);

  // Get all child codes for this group (flattened)
  const groupChildCodes = getGroupChildCodes(group);
  const groupState = getGroupState(groupChildCodes, selectedTypeCodes, isAllSelected);

  const handleGroupToggle = () => {
    const newSelected = groupState !== 'all';
    dispatch(
      toggleGroup({
        groupTypeCodes: groupChildCodes,
        selected: newSelected,
        allTypeCodes,
      })
    );
  };

  /**
   * Check if a filter item type is selected
   * A type is selected if ALL of its childCodes are selected
   */
  const isTypeSelected = (childCodes: readonly string[]) => {
    if (isAllSelected) return true;
    const selectedSet = new Set(selectedTypeCodes);
    return childCodes.every((code) => selectedSet.has(code));
  };

  /**
   * Toggle a filter item type by toggling all its childCodes
   */
  const handleTypeToggle = (childCodes: readonly string[]) => {
    const isCurrentlySelected = isTypeSelected(childCodes);
    dispatch(
      toggleGroup({
        groupTypeCodes: childCodes,
        selected: !isCurrentlySelected,
        allTypeCodes,
      })
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Group header with 3-way checkbox */}
      <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
        <Checkbox
          checked={groupState === 'all' ? true : groupState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleGroupToggle}
        />
        <span className="font-bold text-sm">{group.label}:</span>
      </label>

      {/* Individual type checkboxes */}
      {group.itemTypes.map((itemType) => (
        <label key={itemType.code} className="flex items-center gap-1 cursor-pointer">
          <Checkbox
            checked={isTypeSelected(itemType.childCodes)}
            onCheckedChange={() => {
              handleTypeToggle(itemType.childCodes);
            }}
          />
          <span className="text-sm">{itemType.label}</span>
        </label>
      ))}
    </div>
  );
}

export function ItemTypeFilter() {
  const dispatch = useDispatch();
  const filterGroups = useItemTypeFilters();
  const isAllSelected = useSelector(selectIsAllTypesSelected);
  const selectedTypeCodes = useSelector(selectSelectedTypeCodesRaw);

  // Loading state
  if (!filterGroups) {
    return <div className="text-sm text-muted-foreground">Loading filters...</div>;
  }

  const allTypeCodes = getAllTypeCodesFromGroups(filterGroups);
  const noneSelected = selectedTypeCodes.includes('__none__') || (!isAllSelected && selectedTypeCodes.length === 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">Item Types:</span>
        <Button variant="outline" size="sm" onClick={() => dispatch(selectAllTypes())} disabled={isAllSelected}>
          All
        </Button>
        <Button variant="outline" size="sm" onClick={() => dispatch(deselectAllTypes())} disabled={noneSelected}>
          None
        </Button>
      </div>
      <div className="space-y-3">
        {filterGroups.map((group) => (
          <ItemGroupSection key={group.id} group={group} allTypeCodes={allTypeCodes} />
        ))}
      </div>
    </div>
  );
}
