import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { useRuneGroups } from '../hooks/useRuneGroups';
import { toggleRune, toggleRuneGroup, selectSelectedRunes } from '../store/runewordsSlice';
import type { RuneGroup } from '../types';

type TierState = 'all' | 'some' | 'none';

function getTierState(runes: readonly string[], selectedRunes: Record<string, boolean>): TierState {
  const selectedCount = runes.filter((r) => selectedRunes[r]).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === runes.length) return 'all';
  return 'some';
}

interface RuneGroupSectionProps {
  readonly group: RuneGroup;
}

function RuneGroupSection({ group }: RuneGroupSectionProps) {
  const dispatch = useDispatch();
  const selectedRunes = useSelector(selectSelectedRunes);

  const tierState = getTierState(group.runes, selectedRunes);

  const handleTierToggle = () => {
    const newSelected = tierState !== 'all';
    dispatch(toggleRuneGroup({ runes: group.runes, selected: newSelected }));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Tier header with 3-way checkbox */}
      <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
        <Checkbox
          checked={tierState === 'all' ? true : tierState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleTierToggle}
        />
        <span className="font-medium text-sm text-muted-foreground">{group.label}:</span>
      </label>

      {/* Individual rune checkboxes */}
      {group.runes.map((rune) => (
        <label key={rune} className="flex items-center gap-1 cursor-pointer">
          <Checkbox
            checked={selectedRunes[rune] ?? true}
            onCheckedChange={() => {
              dispatch(toggleRune(rune));
            }}
          />
          <span className="text-sm">{rune.replace(' Rune', '')}</span>
        </label>
      ))}
    </div>
  );
}

export function RuneCheckboxGroup() {
  const runeGroups = useRuneGroups();

  if (!runeGroups) return null;

  const esrGroups = runeGroups.filter((g) => g.category === 'esrRunes');
  const otherGroups = runeGroups.filter((g) => g.category !== 'esrRunes');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left column: ESR Runes */}
      <div className="space-y-1.5">
        {esrGroups.map((group) => (
          <RuneGroupSection key={`${group.category}-${String(group.tier)}`} group={group} />
        ))}
      </div>

      {/* Right column: LoD + Kanji Runes */}
      <div className="space-y-1.5">
        {otherGroups.map((group) => (
          <RuneGroupSection key={`${group.category}-${String(group.tier)}`} group={group} />
        ))}
      </div>
    </div>
  );
}
