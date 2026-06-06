import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { useGemGroups } from '../hooks/useGemGroups';
import { toggleGem, toggleGemGroup, selectSelectedGems } from '../store/gemwordsSlice';
import { cn } from '@/lib/utils';
import { GEM_SWATCH_COLORS } from '@/core/constants/gemColors';
import { GEM_FILTER_OPTION_CLASS, GEM_FILTER_OPTIONS_GRID_CLASS, GEM_FILTER_ROW_CLASS } from '../constants/filterLayout';
import type { GemGroup } from '../types';

type GroupState = 'all' | 'some' | 'none';

function getGroupState(gemNames: readonly string[], selectedGems: Record<string, boolean>): GroupState {
  const selectedCount = gemNames.filter((gem) => selectedGems[gem] ?? true).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === gemNames.length) return 'all';
  return 'some';
}

interface GemGroupSectionProps {
  readonly group: GemGroup;
}

function GemGroupSection({ group }: GemGroupSectionProps) {
  const dispatch = useDispatch();
  const selectedGems = useSelector(selectSelectedGems);
  const gemNames = group.gems.map((gem) => gem.name);
  const groupState = getGroupState(gemNames, selectedGems);
  const groupSwatchClass = GEM_SWATCH_COLORS[group.gems[0]?.color ?? ''] ?? 'bg-muted border-border';

  const handleGroupToggle = () => {
    dispatch(toggleGemGroup({ gems: gemNames, selected: groupState !== 'all' }));
  };

  return (
    <div className={GEM_FILTER_ROW_CLASS}>
      <label className="flex h-7 items-center gap-1.5 cursor-pointer shrink-0">
        <Checkbox
          checked={groupState === 'all' ? true : groupState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleGroupToggle}
        />
        <span className={cn('size-3 rounded-full border shadow-sm', groupSwatchClass)} aria-hidden="true" />
        <span className="font-medium text-sm text-muted-foreground">{group.type}:</span>
      </label>

      <div className={GEM_FILTER_OPTIONS_GRID_CLASS}>
        {group.gems.map((gem) => {
          const selected = selectedGems[gem.name] ?? true;
          const swatchClass = GEM_SWATCH_COLORS[gem.color] ?? 'bg-muted border-border';

          return (
            <label key={gem.name} className={cn(GEM_FILTER_OPTION_CLASS, !selected && 'opacity-50')}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => {
                  dispatch(toggleGem(gem.name));
                }}
              />
              <span className={cn('size-3 rounded-full border shadow-sm', swatchClass)} aria-hidden="true" />
              <span className="min-w-0 whitespace-nowrap">{gem.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function GemCheckboxGroup() {
  const gemGroups = useGemGroups();

  if (!gemGroups) return null;

  return (
    <div className="space-y-1.5">
      {gemGroups.map((group) => (
        <GemGroupSection key={group.type} group={group} />
      ))}
    </div>
  );
}
