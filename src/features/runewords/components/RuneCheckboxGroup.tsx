import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { useRuneGroups } from '../hooks/useRuneGroups';
import { toggleRune, toggleRuneGroup, selectSelectedRunes } from '../store/runewordsSlice';
import { ESR_TIER_TEXT_COLORS, CATEGORY_TEXT_COLORS } from '../constants/tierColors';
import type { RuneGroup } from '../types';

function getGroupTextColor(group: RuneGroup): string {
  if (group.category === 'esrRunes' && group.tier !== null) {
    return ESR_TIER_TEXT_COLORS[group.tier] ?? '';
  }
  return CATEGORY_TEXT_COLORS[group.category] ?? '';
}

type TierState = 'all' | 'some' | 'none';

function getTierState(runes: readonly string[], category: string, selectedRunes: Record<string, boolean>): TierState {
  const selectedCount = runes.filter((r) => selectedRunes[`${category}:${r}`]).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === runes.length) return 'all';
  return 'some';
}

interface RuneGroupSectionProps {
  readonly group: RuneGroup;
  readonly labelClassName?: string;
  readonly runeClassName?: string;
}

function RuneGroupSection({ group, labelClassName, runeClassName }: RuneGroupSectionProps) {
  const dispatch = useDispatch();
  const selectedRunes = useSelector(selectSelectedRunes);

  const tierState = getTierState(group.runes, group.category, selectedRunes);
  const textColorClass = getGroupTextColor(group);

  const handleTierToggle = () => {
    const newSelected = tierState !== 'all';
    dispatch(toggleRuneGroup({ runes: group.runes, category: group.category, selected: newSelected }));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Tier header with 3-way checkbox */}
      <label className={`flex items-center gap-1.5 cursor-pointer shrink-0 ${labelClassName ?? ''}`}>
        <Checkbox
          checked={tierState === 'all' ? true : tierState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleTierToggle}
        />
        <span className={`font-medium text-sm ${textColorClass}`}>{group.label}:</span>
      </label>

      {/* Individual rune checkboxes */}
      {group.runes.map((rune) => {
        const key = `${group.category}:${rune}`;
        return (
          <label key={key} className={`flex items-center gap-1 cursor-pointer ${runeClassName ?? ''}`}>
            <Checkbox
              checked={selectedRunes[key] ?? true}
              onCheckedChange={() => {
                dispatch(toggleRune({ rune, category: group.category }));
              }}
            />
            <span className={`text-sm ${textColorClass}`}>{rune.replace(' Rune', '')}</span>
          </label>
        );
      })}
    </div>
  );
}

export function RuneCheckboxGroup() {
  const runeGroups = useRuneGroups();

  if (!runeGroups) return null;

  const esrGroups = runeGroups.filter((g) => g.category === 'esrRunes');
  const lodGroups = runeGroups.filter((g) => g.category === 'lodRunes');
  const kanjiGroups = runeGroups.filter((g) => g.category === 'kanjiRunes');

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
      {/* Left column: ESR Runes */}
      <div className="space-y-1.5">
        {esrGroups.map((group) => (
          <RuneGroupSection
            key={`${group.category}-${String(group.tier)}`}
            group={group}
            labelClassName="md:min-w-24"
            runeClassName="md:min-w-11"
          />
        ))}
      </div>

      {/* Right column: LoD + Kanji Runes */}
      <div>
        <div className="space-y-1.5">
          {lodGroups.map((group) => (
            <RuneGroupSection
              key={`${group.category}-${String(group.tier)}`}
              group={group}
              labelClassName="md:min-w-22"
              runeClassName="md:min-w-14"
            />
          ))}
        </div>
        <div className="space-y-1.5 mt-4">
          {kanjiGroups.map((group) => (
            <RuneGroupSection key={`${group.category}-${String(group.tier)}`} group={group} />
          ))}
        </div>
      </div>
    </div>
  );
}
