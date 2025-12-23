import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { useRuneGroups } from '../hooks/useRuneGroups';
import { toggleRune, toggleRuneGroup, selectSelectedRunes } from '../store/runewordsSlice';
import type { RuneGroup } from '../types';

// Text colors for ESR tiers (mapped by tier number)
const ESR_TIER_TEXT_COLORS: Record<number, string> = {
  1: 'text-slate-600 dark:text-slate-300', // WHITE
  2: 'text-red-600 dark:text-red-400', // RED
  3: 'text-yellow-600 dark:text-yellow-400', // YELLOW
  4: 'text-orange-600 dark:text-orange-400', // ORANGE
  5: 'text-green-600 dark:text-green-400', // GREEN
  6: 'text-amber-600 dark:text-amber-400', // GOLD
  7: 'text-purple-600 dark:text-purple-400', // PURPLE
};

// Text colors for other rune categories
const CATEGORY_TEXT_COLORS: Record<string, string> = {
  lodRunes: 'text-amber-600 dark:text-amber-400',
  kanjiRunes: 'text-blue-600 dark:text-blue-400',
};

function getGroupTextColor(group: RuneGroup): string {
  if (group.category === 'esrRunes' && group.tier !== null) {
    return ESR_TIER_TEXT_COLORS[group.tier] ?? '';
  }
  return CATEGORY_TEXT_COLORS[group.category] ?? '';
}

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
  const textColorClass = getGroupTextColor(group);

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
        <span className={`font-medium text-sm ${textColorClass}`}>{group.label}:</span>
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
          <span className={`text-sm ${textColorClass}`}>{rune.replace(' Rune', '')}</span>
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
