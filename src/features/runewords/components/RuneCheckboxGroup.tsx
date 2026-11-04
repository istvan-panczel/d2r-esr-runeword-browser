import { useDispatch, useSelector } from 'react-redux';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterGroupList } from '@/components/FilterGroup';
import { cn } from '@/lib/utils';
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

/**
 * Rune columns per group kind, as fixed-width grids so the wrapped lines line up and no line holds a single rune.
 * Tuned for the current group sizes (ESR tiers 7, LoD tiers 11, Kanji 14) at 390 / 768 / 1024 / 1280 px:
 * ESR 5 → 7 per line, LoD 4 → 6 → 11 → 6 (two-column layout from xl), Kanji 3 → 5 → 7 → 4. Pages of 1920 px and up
 * (the Wide and Full page widths) have room for a whole LoD tier and half the Kanji runes per line again: 11 and 7.
 */
const RUNE_COLUMNS: Record<RuneGroup['category'], string> = {
  esrRunes: 'grid-cols-[repeat(5,3.25rem)] md:grid-cols-[repeat(7,3.25rem)]',
  lodRunes:
    'grid-cols-[repeat(4,3.75rem)] md:grid-cols-[repeat(6,3.75rem)] lg:grid-cols-[repeat(11,3.75rem)] xl:grid-cols-[repeat(6,3.75rem)] @9xl/page:grid-cols-[repeat(11,3.75rem)]',
  kanjiRunes:
    'grid-cols-[repeat(3,5.25rem)] md:grid-cols-[repeat(5,5.25rem)] lg:grid-cols-[repeat(7,5.25rem)] xl:grid-cols-[repeat(4,5.25rem)] @9xl/page:grid-cols-[repeat(7,5.25rem)]',
};

/** One rune group, laid out like `FilterGroup` (10rem label column from md, label on its own line on phones). */
function RuneGroupSection({ group }: { readonly group: RuneGroup }) {
  const dispatch = useDispatch();
  const selectedRunes = useSelector(selectSelectedRunes);

  const tierState = getTierState(group.runes, group.category, selectedRunes);
  const textColorClass = getGroupTextColor(group);

  const handleTierToggle = () => {
    const newSelected = tierState !== 'all';
    dispatch(toggleRuneGroup({ runes: group.runes, category: group.category, selected: newSelected }));
  };

  return (
    <div className="grid grid-cols-1 items-start gap-x-3 md:grid-cols-[10rem_minmax(0,1fr)]">
      {/* Tier header with 3-way checkbox */}
      <label className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5">
        <Checkbox
          checked={tierState === 'all' ? true : tierState === 'some' ? 'indeterminate' : false}
          onCheckedChange={handleTierToggle}
        />
        <span className={cn('text-sm font-semibold', textColorClass)}>{group.label}:</span>
      </label>

      {/* Individual rune checkboxes */}
      <div className={cn('grid gap-x-2 pl-5.5 md:pl-0', RUNE_COLUMNS[group.category])}>
        {group.runes.map((rune) => {
          const key = `${group.category}:${rune}`;
          return (
            <label key={key} className="flex h-7 min-w-0 cursor-pointer items-center gap-1">
              <Checkbox
                checked={selectedRunes[key] ?? true}
                onCheckedChange={() => {
                  dispatch(toggleRune({ rune, category: group.category }));
                }}
              />
              <span className={cn('whitespace-nowrap text-sm', textColorClass)}>{rune.replace(' Rune', '')}</span>
            </label>
          );
        })}
      </div>
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
    // One column (ESR, then LoD + Kanji) up to lg; from xl the ESR block takes the width it needs and LoD + Kanji the rest
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-[max-content_minmax(0,1fr)]">
      {/* Left column: ESR Runes */}
      <FilterGroupList>
        {esrGroups.map((group) => (
          <RuneGroupSection key={`${group.category}-${String(group.tier)}`} group={group} />
        ))}
      </FilterGroupList>

      {/* Right column: LoD + Kanji Runes */}
      <div className="space-y-4">
        <FilterGroupList>
          {lodGroups.map((group) => (
            <RuneGroupSection key={`${group.category}-${String(group.tier)}`} group={group} />
          ))}
        </FilterGroupList>
        <FilterGroupList>
          {kanjiGroups.map((group) => (
            <RuneGroupSection key={`${group.category}-${String(group.tier)}`} group={group} />
          ))}
        </FilterGroupList>
      </div>
    </div>
  );
}
