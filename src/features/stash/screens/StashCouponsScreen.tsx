import { useSearchParams } from 'react-router-dom';
import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { EnhanceSearch, Pills } from '@/features/game-data/components/EnhanceParts';
import type { StashBundle, StashCouponTier } from '@/features/game-data/engine/schema';
import { CouponTable } from '../components/CouponTable';
import { StashGate } from '../components/StashGate';
import {
  collectCoupons,
  COUPON_STATUS_LABELS,
  COUPON_STATUSES,
  couponPages,
  encodeCouponsState,
  filterCouponRows,
  formatLocation,
  isCouponStatusFilter,
  readCouponsState,
  sortCouponRows,
  type CouponStatusFilter,
  type CouponSummary,
  type CouponsState,
  type CouponLocation,
} from '../engine/coupons';
import { useStash } from '../hooks/useStash';
import type { StashFile } from '../parser/types';

const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';

export function StashCouponsScreen() {
  const { bundle } = useStash();
  return <StashGate>{(stash) => <CouponsBrowser stash={stash} bundle={bundle} />}</StashGate>;
}

interface CouponsBrowserProps {
  readonly stash: StashFile;
  readonly bundle: StashBundle;
}

/** The page state lives in the URL (search, status, tier, page, sort), so the back button keeps it. */
function CouponsBrowser({ stash, bundle }: CouponsBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readCouponsState(searchParams);
  const update = (patch: Partial<CouponsState>, replace = true) => {
    setSearchParams(encodeCouponsState({ ...state, ...patch }), { replace });
  };
  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );

  const { rows, summary, wildCardLocations } = collectCoupons(stash, bundle);
  const shown = sortCouponRows(filterCouponRows(rows, state), state.sort, state.dir);
  const tiers = bundle.couponTiers.filter((tier) => rows.some((row) => row.tier === tier.type));
  const pages = couponPages(rows);
  const countOf = (status: CouponStatusFilter) => (status === ALL ? rows.length : rows.filter((row) => row.status === status).length);
  const statusOptions = [
    { value: ALL, label: 'All', count: countOf(ALL) },
    ...COUPON_STATUSES.map((status) => ({ value: status, label: COUPON_STATUS_LABELS[status], count: countOf(status) })),
  ];
  const tierOptions = [
    { value: ALL, label: 'All' },
    ...tiers.map((tier) => ({ value: tier.type, label: tier.label, count: rows.filter((row) => row.tier === tier.type).length })),
  ];
  const reset = () => {
    commitSearch('');
    setSearchParams(new URLSearchParams(), { replace: false });
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
          placeholder="Search coupons, uniques or codes..."
          hint="Search the coupon name, the unique and the code;"
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
          <div className="space-y-1">
            <Label htmlFor="stash-coupons-page" className="text-xs font-normal text-muted-foreground">
              Stash page
            </Label>
            <Select
              value={state.page === null ? ALL : String(state.page)}
              onValueChange={(value) => {
                update({ page: value === ALL ? null : Number(value) }, false);
              }}
            >
              <SelectTrigger id="stash-coupons-page" size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All pages</SelectItem>
                {pages.map((page) => (
                  <SelectItem key={page} value={String(page)}>
                    Page {page}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterPanel>

      <ResultsBar summary={`Showing ${String(shown.length)} of ${String(rows.length)} coupons you own`} />

      {shown.length === 0 ? (
        <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
          <p>No coupon matches.</p>
          <button
            type="button"
            className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            onClick={reset}
          >
            Show every coupon you own
          </button>
        </div>
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
      <ScrollToTopButton />
    </div>
  );
}

function Chip({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <li className="rounded-lg border bg-card px-3 py-2 shadow-sm">
      <span className="block text-lg font-semibold tabular-nums">{value}</span>
      <span className="block text-xs text-muted-foreground">{label}</span>
    </li>
  );
}

function SummaryChips({ summary }: { readonly summary: CouponSummary }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Summary">
      <Chip value={summary.distinct} label="kinds of coupon owned" />
      <Chip value={summary.total} label="coupons in total" />
      <Chip value={summary.craftable} label={`uniques craftable now (${String(summary.crafts)} crafts)`} />
      <Chip value={summary.wildCards} label="Wild Cards" />
    </ul>
  );
}

interface WildCardNoteProps {
  readonly summary: CouponSummary;
  readonly tiers: readonly StashCouponTier[];
  readonly locations: readonly CouponLocation[];
}

/** How many Wild Cards the stash has, what they unlock, and the cube recipe that makes them */
function WildCardNote({ summary, tiers, locations }: WildCardNoteProps) {
  const makers = tiers.flatMap((tier) => (tier.wildCardFrom === null ? [] : [`${String(tier.wildCardFrom)} ${tier.label}`]));
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
