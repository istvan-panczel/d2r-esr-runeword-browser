import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  toggleGroup,
  selectAllCategories,
  deselectAllCategories,
  selectSelectedCategoriesRaw,
  selectIsAllCategoriesSelected,
  selectIncludeCouponItems,
  setIncludeCouponItems,
} from '../store';
import { useCategoryFilters, getAllCategoriesFromGroups } from '../hooks';
import type { HtmFilterGroup } from '../types';
import { NO_CATEGORIES_MARKER } from '@/core/constants/categoryFilter';

type GroupState = 'all' | 'some' | 'none';

function getGroupState(groupCategories: readonly string[], selectedSet: ReadonlySet<string>, isAllSelected: boolean): GroupState {
  if (isAllSelected) {
    return 'all';
  }

  const selectedCount = groupCategories.filter((cat) => selectedSet.has(cat)).length;

  if (selectedCount === 0) return 'none';
  if (selectedCount === groupCategories.length) return 'all';
  return 'some';
}

interface CategoryGroupSectionProps {
  readonly group: HtmFilterGroup;
  readonly allCategories: readonly string[];
}

function CategoryGroupSection({ group, allCategories }: CategoryGroupSectionProps) {
  const dispatch = useDispatch();
  const selectedCategories = useSelector(selectSelectedCategoriesRaw);
  const isAllSelected = useSelector(selectIsAllCategoriesSelected);

  const selectedSet = new Set(selectedCategories);
  const groupState = getGroupState(group.categories, selectedSet, isAllSelected);

  const handleGroupToggle = () => {
    const newSelected = groupState !== 'all';
    dispatch(
      toggleGroup({
        groupCategories: group.categories,
        selected: newSelected,
        allCategories,
      })
    );
  };

  const isCategorySelected = (category: string) => {
    if (isAllSelected) return true;
    return selectedSet.has(category);
  };

  const handleCategoryToggle = (category: string) => {
    const isCurrentlySelected = isCategorySelected(category);
    dispatch(
      toggleGroup({
        groupCategories: [category],
        selected: !isCurrentlySelected,
        allCategories,
      })
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="flex items-center gap-1.5 cursor-pointer shrink-0 md:min-w-32">
        <Checkbox
          checked={groupState === 'all' ? true : groupState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleGroupToggle}
        />
        <span className="font-bold text-sm text-muted-foreground">{group.label}:</span>
      </label>

      {group.categories.map((category) => (
        <label key={category} className="flex items-center gap-1 cursor-pointer">
          <Checkbox
            checked={isCategorySelected(category)}
            onCheckedChange={() => {
              handleCategoryToggle(category);
            }}
          />
          <span className="text-sm">{category}</span>
        </label>
      ))}
    </div>
  );
}

export function HtmCategoryFilter() {
  const dispatch = useDispatch();
  const filterGroups = useCategoryFilters();
  const isAllSelected = useSelector(selectIsAllCategoriesSelected);
  const selectedCategories = useSelector(selectSelectedCategoriesRaw);
  const includeCouponItems = useSelector(selectIncludeCouponItems);

  if (!filterGroups) {
    return <div className="text-sm text-muted-foreground">Loading filters...</div>;
  }

  const allCategories = getAllCategoriesFromGroups(filterGroups);
  const noneSelected = selectedCategories.includes(NO_CATEGORIES_MARKER);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">Categories:</span>
        <Button variant="outline" size="sm" onClick={() => dispatch(selectAllCategories())} disabled={isAllSelected}>
          All
        </Button>
        <Button variant="outline" size="sm" onClick={() => dispatch(deselectAllCategories())} disabled={noneSelected}>
          None
        </Button>
        <label className="flex items-center gap-1.5 cursor-pointer ml-2">
          <Checkbox
            checked={includeCouponItems}
            onCheckedChange={(checked) => {
              dispatch(setIncludeCouponItems(checked === true));
            }}
          />
          <span className="text-sm text-purple-600 dark:text-purple-400">Include Coupon Items</span>
        </label>
      </div>
      <div className="space-y-4">
        {filterGroups.map((group) => (
          <CategoryGroupSection key={group.id} group={group} allCategories={allCategories} />
        ))}
      </div>
    </div>
  );
}
