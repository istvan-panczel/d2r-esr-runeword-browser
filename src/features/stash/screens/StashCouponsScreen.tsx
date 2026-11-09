import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { EnhanceSearch, Pills } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { StashBundle, StashCouponTier } from '@/features/game-data/engine/schema';
import { CouponCards } from '../components/CouponCards';
import { CouponTable } from '../components/CouponTable';
import { EmptyResults } from '../components/shared/EmptyResults';
import { PageSelect } from '../components/shared/PageSelect';
import { SortSelect } from '../components/shared/SortSelect';
import { SummaryChips as SharedSummaryChips } from '../components/shared/SummaryChips';
import { StashGate } from '../components/StashGate';
import {
  collectCoupons,
  COUPON_SORT_KEYS,
  COUPON_STATUS_LABELS,
  COUPON_STATUSES,
  couponPages,
  couponTierLabel,
  DEFAULT_COUPONS_STATE,
  encodeCouponsState,
  filterCouponRows,
  formatLocation,
  isCouponStatusFilter,
  readCouponsState,
  sortCouponRows,
  type CouponSortKey,
  type CouponStatusFilter,
  type CouponSummary,
  type CouponLocation,
} from '../engine/coupons';
import type { ItemTypeIndex } from '../engine/itemTypes';
import { useStash } from '../hooks/useStash';
import { useStashTypes } from '../hooks/useStashTypes';
import { useUrlState } from '../hooks/useUrlState';
import type { StashFile } from '../parser/types';
import { STASH_SEARCH_HELP } from '../components/shared/stashSearchHelp';

const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';

const SORT_LABELS: Readonly<Record<CouponSortKey, string>> = {
  status: 'Status',
  coupon: 'Coupon',
  unique: 'Unique',
  tier: 'Tier',
  have: 'Have',
  location: 'Where',
};

export function StashCouponsScreen() {
  const { bundle } = useStash();
  const types = useStashTypes();
  return (
    <StashGate>
      {(stash) => {
        if (types.status === 'loading') return <GameDataLoading />;
        if (types.status === 'error') return <GameDataError error={types.error} onRetry={types.retry} />;
        return <CouponsBrowser stash={stash} bundle={bundle} types={types.types} />;
      }}
    </StashGate>
  );
}

interface CouponsBrowserProps {
  readonly stash: StashFile;
  readonly bundle: StashBundle;
  readonly types: ItemTypeIndex;
}

/** The page state lives in the URL (search, status, tier, page, sort, details), so the back button keeps it. */
function CouponsBrowser({ stash, bundle, types }: CouponsBrowserProps) {
  const { state, update, set } = useUrlState(readCouponsState, encodeCouponsState);
  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );

  const { rows, summary, wildCardLocations } = collectCoupons(stash, bundle, types);
  const shown = sortCouponRows(filterCouponRows(rows, state, types), state.sort, state.dir);
  const tiers = bundle.couponTiers.filter((tier) => rows.some((row) => row.couponType === tier.type));
  const pages = couponPages(rows);
  const countOf = (status: CouponStatusFilter) => (status === ALL ? rows.length : rows.filter((row) => row.status === status).length);
  const statusOptions = [
    { value: ALL, label: 'All', count: countOf(ALL) },
    ...COUPON_STATUSES.map((status) => ({ value: status, label: COUPON_STATUS_LABELS[status], count: countOf(status) })),
  ];
  const tierOptions = [
    { value: ALL, label: 'All' },
    ...tiers.map((tier) => ({
      value: tier.type,
      label: couponTierLabel(tier),
      count: rows.filter((row) => row.couponType === tier.type).length,
    })),
  ];
  const reset = () => {
    commitSearch('');
    set({ ...DEFAULT_COUPONS_STATE, details: state.details });
  };

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No Ancient Coupons in this stash{summary.wildCards > 0 ? ` (only ${String(summary.wildCards)} Wild Cards)` : ''}.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SummaryChips summary={summary} />
      <WildCardNote summary={summary} tiers={bundle.couponTiers} locations={wildCardLocations} />

      <FilterPanel>
        <EnhanceSearch
          id="stash-coupons-search"
          value={search}
          onChange={setSearch}
          onClear={() => {
            commitSearch('');
          }}
          placeholder="Search unique, coupon, code or item type (e.g. belt)..."
          hint="Search the unique, coupon, code or item type (belt, helm, ring…);"
          help={STASH_SEARCH_HELP}
        />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Status</p>
          <Pills
            label="Status"
            options={statusOptions}
            value={state.status}
            onChange={(value) => {
              if (isCouponStatusFilter(value)) update({ status: value }, false);
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tier</p>
            <Pills
              label="Tier"
              options={tierOptions}
              value={state.tier ?? ALL}
              onChange={(value) => {
                update({ tier: value === ALL ? null : value }, false);
              }}
            />
          </div>
          <PageSelect
            id="stash-coupons-page"
            pages={pages}
            value={state.page}
            onChange={(page) => {
              update({ page }, false);
            }}
          />
          <label className="flex h-8 cursor-pointer items-center gap-2">
            <Checkbox
              checked={state.details}
              onCheckedChange={(checked) => {
                update({ details: checked === true }, false);
              }}
            />
            <span className="text-sm">Show all item information</span>
          </label>
        </div>
      </FilterPanel>

      <ResultsBar
        summary={`Showing ${String(shown.length)} of ${String(rows.length)} coupons you own`}
        actions={
          state.details && (
            <SortSelect
              id="stash-coupons-sort"
              keys={COUPON_SORT_KEYS}
              labels={SORT_LABELS}
              sort={state.sort}
              dir={state.dir}
              onChange={(sort, dir) => {
                update({ sort, dir });
              }}
            />
          )
        }
      />

      {shown.length === 0 ? (
        <EmptyResults message="No coupon matches." resetLabel="Show every coupon you own" onReset={reset} />
      ) : state.details ? (
        <CouponCards rows={shown} />
      ) : (
        <CouponTable
          rows={shown}
          sort={state.sort}
          dir={state.dir}
          onSort={(sort, dir) => {
            update({ sort, dir });
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Rows and columns count from 1 at the top left of a stash page. The copy button copies the unique&apos;s name for the in-game shared
        stash search. Only coupons you own are listed; the blank coupons have no recipe of their own and are left out.
      </p>
    </div>
  );
}

function SummaryChips({ summary }: { readonly summary: CouponSummary }) {
  return (
    <SharedSummaryChips
      chips={[
        { value: summary.distinct, label: 'kinds of coupon owned' },
        { value: summary.total, label: 'coupons in total' },
        { value: summary.craftable, label: `uniques craftable now (${String(summary.crafts)} crafts)` },
        { value: summary.wildCards, label: 'Wild Cards' },
      ]}
    />
  );
}

interface WildCardNoteProps {
  readonly summary: CouponSummary;
  readonly tiers: readonly StashCouponTier[];
  readonly locations: readonly CouponLocation[];
}

/** How many Wild Cards the stash has, what they unlock, and the cube recipe that makes them */
function WildCardNote({ summary, tiers, locations }: WildCardNoteProps) {
  const makers = tiers.flatMap((tier) => (tier.wildCardFrom === null ? [] : [`${String(tier.wildCardFrom)} ${couponTierLabel(tier)}`]));
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <p>
        You have {summary.wildCards} Coupon Wild Card{summary.wildCards === 1 ? '' : 's'}
        {locations.length > 0 && <> ({locations.map(formatLocation).join('; ')})</>}.{' '}
        {summary.readyWithWildCards > 0 &&
          `${String(summary.readyWithWildCards)} more unique${summary.readyWithWildCards === 1 ? ' is' : 's are'} ready with them (each on its own; they share the Wild Cards; a recipe flagged as broken never counts). `}
        {makers.length > 0 && `The cube makes one Wild Card from ${makers.join(', ').replace(/, ([^,]*)$/, ' or $1')} coupons of any kind.`}
      </p>
    </div>
  );
}
