import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { cn } from '@/lib/utils';
import type { SuperiorAffixes } from '../engine/schema';
import { resetAffixFilters, selectAffixFilters, setAffixSearch, setAffixSuperiorType } from '../store/gameDataSlice';
import { filterSuperiorPools, superiorTypeOptions, superiorWeightNote } from '../utils/superiorView';
import { EnhanceSearch, NoMatches } from './EnhanceParts';
import { LIST_CARD_CLASS, LIST_CARD_HEADER_CLASS } from './rowListColumns';
import { SuperiorRollList } from './SuperiorRollList';

const INPUT_DEBOUNCE_MS = 300;
const ALL_TYPES = 'all';

interface SuperiorAffixesViewProps {
  readonly superior: SuperiorAffixes;
  readonly typeNames: ReadonlyMap<string, string>;
  readonly getShareUrl: () => string;
}

/** The Affixes page's Superior view: every qualityitems.txt row grouped by the pool of bases that can roll it. */
export function SuperiorAffixesView({ superior, typeNames, getShareUrl }: SuperiorAffixesViewProps) {
  const dispatch = useDispatch();
  const filters = useSelector(selectAffixFilters);
  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    filters.search,
    (value) => dispatch(setAffixSearch(value)),
    INPUT_DEBOUNCE_MS
  );

  const typeOptions = superiorTypeOptions(superior, typeNames);
  const views = filterSuperiorPools(superior, filters, typeNames);
  const shownRows = new Set(views.flatMap((view) => view.rolls.map((roll) => roll.row.row))).size;
  const stockColumnsUsed = superior.rows.some((row) => row.itypes.length === 0);

  return (
    <>
      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            id="superior-search"
            value={search}
            onChange={setSearch}
            onClear={() => {
              commitSearch('');
            }}
            placeholder="Search superior rows..."
            hint="Search stats or item types;"
          />
          <div className="space-y-1">
            <Label htmlFor="superior-type" className="text-xs font-normal text-muted-foreground">
              Item type
            </Label>
            <Select
              value={filters.superiorType ?? ALL_TYPES}
              onValueChange={(value) => dispatch(setAffixSuperiorType(value === ALL_TYPES ? null : value))}
            >
              <SelectTrigger id="superior-type" size="sm" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All item types</SelectItem>
                {typeOptions.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Share your current filters.</p>
              <CopyLinkHelpButton />
            </div>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
          <Button variant="outline" size="sm" onClick={() => dispatch(resetAffixFilters())}>
            Reset filters
          </Button>
        </div>
      </FilterPanel>

      <div className={cn('mb-6 space-y-1.5 px-4 py-3 text-sm text-muted-foreground', LIST_CARD_CLASS)}>
        <p>
          A Superior weapon or armor rolls <span className="font-medium text-foreground">one</span> of the rows its base may use, picked by
          weight: a row's chance is its weight divided by the summed weights of every row that base may use
          {superiorWeightNote(superior)}. Each value is rolled once between min and max and stays on the item, also when you make a runeword
          in a superior white base.
        </p>
        <p>
          {stockColumnsUsed
            ? 'Rows with item types match through the item type tree; the other rows use the stock columns, which test the base’s own type: Amazon bows use the weapon column, not bow, and Paladin shields, circlets and heads use the armor column.'
            : 'Every row names its item types, matched through the item type tree (an Amazon bow counts as a bow and a weapon), so the stock item-class columns, where Amazon bows use the weapon column and not bow, play no part.'}{' '}
          Bases that roll the same rows share a group below.
        </p>
      </div>

      <ResultsBar
        summary={`Showing ${String(shownRows)} of ${String(superior.rows.length)} superior rows in ${String(views.length)} of ${String(superior.pools.length)} item groups`}
      />
      {views.length === 0 ? (
        <NoMatches />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 @8xl/page:grid-cols-3 @10xl/page:grid-cols-4">
          {views.map(({ pool, typeNames: names, rolls }) => (
            <section key={pool.label} aria-label={pool.label} className={LIST_CARD_CLASS}>
              <div className={LIST_CARD_HEADER_CLASS}>
                <h3 className="font-semibold">{pool.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {pool.rows.length} rows · total weight {pool.total} · {pool.bases} bases
                </span>
                <p className="w-full text-xs text-muted-foreground">{names.join(', ')}</p>
              </div>
              <SuperiorRollList rolls={rolls} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
