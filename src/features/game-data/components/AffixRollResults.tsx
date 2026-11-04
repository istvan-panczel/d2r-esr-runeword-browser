import type { BaseItem } from '../engine/schema';
import type { EligibleAffixes, WeightedAffix } from '../engine/affixEligibility';
import type { AffixFilters } from '../store/gameDataSlice';
import { filterRollable, formatWeight, groupRollable } from '../utils/filterAffixes';
import { AffixCard } from './AffixCard';
import { AffixList } from './AffixList';

/**
 * One affix group: its heading and cards, stacked (the Standard page); pages wider than that put the cards side by
 * side, two or three per row in a half-width section (prefixes, suffixes), four to seven in the full-width automods.
 */
const GROUP_CLASS = {
  half: 'space-y-2 @8xl/page:grid @8xl/page:grid-cols-2 @8xl/page:gap-2 @8xl/page:space-y-0 @10xl/page:grid-cols-3',
  full: 'space-y-2 @8xl/page:grid @8xl/page:grid-cols-4 @8xl/page:gap-2 @8xl/page:space-y-0 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7',
} as const;

interface AffixRollResultsProps {
  readonly base: BaseItem;
  readonly eligible: EligibleAffixes;
  readonly filters: AffixFilters;
  readonly typeNames: ReadonlyMap<string, string>;
  readonly classNames: ReadonlyMap<string, string>;
}

/** What-can-roll results: prefixes and suffixes side by side, automods below, each grouped by affix group. */
export function AffixRollResults({ base, eligible, filters, typeNames, classNames }: AffixRollResultsProps) {
  const sectionProps = { filters, typeNames, classNames };
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Sorted by affix group, then level. Only one affix per group can be on an item; percentages are the chance among the eligible affixes
        of the same kind.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RollSection title="Prefixes" rollable={eligible.prefixes} {...sectionProps} />
        <RollSection title="Suffixes" rollable={eligible.suffixes} {...sectionProps} />
      </div>
      {filters.includeAutomagic &&
        (base.autoGroup === null ? (
          <p className="text-sm text-muted-foreground">{base.name} has no automod pool.</p>
        ) : (
          <RollSection title={`Automods (group ${String(base.autoGroup)})`} rollable={eligible.automagic} width="full" {...sectionProps} />
        ))}
    </div>
  );
}

interface RollSectionProps {
  readonly title: string;
  readonly rollable: readonly WeightedAffix[];
  readonly filters: AffixFilters;
  readonly typeNames: ReadonlyMap<string, string>;
  readonly classNames: ReadonlyMap<string, string>;
  /** Half the page (prefixes, suffixes side by side) or all of it (automods): how many cards fit per row */
  readonly width?: keyof typeof GROUP_CLASS;
}

function RollSection({ title, rollable, filters, typeNames, classNames, width = 'half' }: RollSectionProps) {
  const shown = filterRollable(rollable, filters);

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="text-lg font-semibold">
        {title}{' '}
        <span className="text-sm font-normal text-muted-foreground">
          {shown.length === rollable.length
            ? `${String(rollable.length)} eligible`
            : `${String(shown.length)} of ${String(rollable.length)} eligible`}
        </span>
      </h2>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing can roll here with the current filters.</p>
      ) : (
        <AffixList
          // Re-mount (and reset "Show more") whenever the filters change
          key={JSON.stringify(filters)}
          items={shown}
          render={(visible) =>
            groupRollable(visible).map((group) => (
              <div key={group.group} className={GROUP_CLASS[width]}>
                <h3 className="text-xs font-medium text-muted-foreground @8xl/page:col-span-full">
                  Group {group.group} · {formatWeight(group.weight)} · one affix per group
                </h3>
                {group.affixes.map(({ affix, weight }) => (
                  <div key={`${affix.kind}-${String(affix.id)}`} className="card-visibility-auto">
                    <AffixCard affix={affix} weight={weight} typeNames={typeNames} classNames={classNames} />
                  </div>
                ))}
              </div>
            ))
          }
        />
      )}
    </section>
  );
}
