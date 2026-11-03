import { useSearchParams } from 'react-router-dom';
import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { EnhanceSearch, Pills } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { ItemTypeInfo, StashBundle, StashCouponTier } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { CouponCards } from '../components/CouponCards';
import { CouponTable } from '../components/CouponTable';
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
  isCouponSortKey,
  isCouponStatusFilter,
  readCouponsState,
  sortCouponRows,
  type CouponSortKey,
  type CouponStatusFilter,
  type CouponSummary,
  type CouponsState,
  type CouponLocation,
} from '../engine/coupons';
import { buildItemTypeIndex, type ItemTypeIndex } from '../engine/itemTypes';
import { useStash } from '../hooks/useStash';
import type { StashFile } from '../parser/types';

const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';
/** types.json: the item type names and ancestors of the item type search (5 KB gzipped) */
const TYPES_FILES = ['types'] as const;

const SORT_LABELS: Readonly<Record<CouponSortKey, string>> = {
  status: 'Status',
  coupon: 'Coupon',
  unique: 'Unique',
  tier: 'Tier',
  have: 'Have',
  location: 'Where',
};

// One index per loaded types.json (the loader caches the bundle for the page lifetime)
let typeIndexCache: { types: readonly ItemTypeInfo[]; index: ItemTypeIndex } | null = null;
function itemTypeIndex(types: readonly ItemTypeInfo[]): ItemTypeIndex {
  if (typeIndexCache?.types !== types) typeIndexCache = { types, index: buildItemTypeIndex(types) };
  return typeIndexCache.index;
}

export function StashCouponsScreen() {
  const { bundle } = useStash();
  const gameData = useGameData(TYPES_FILES);
  return (
    <StashGate>
      {(stash) => {
        if (gameData.status === 'loading') return <GameDataLoading />;
        if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
        return <CouponsBrowser stash={stash} bundle={bundle} types={itemTypeIndex(gameData.data.types.types)} />;
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
    setSearchParams(encodeCouponsState({ ...DEFAULT_COUPONS_STATE, details: state.details }), { replace: false });
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
            <CardSort
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

interface CardSortProps {
  readonly sort: CouponSortKey;
  readonly dir: CouponsState['dir'];
  readonly onChange: (sort: CouponSortKey, dir: CouponsState['dir']) => void;
}

/** The card view has no column headers: sort key + direction (the same state the table headers set) */
function CardSort({ sort, dir, onChange }: CardSortProps) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor="stash-coupons-sort" className="text-xs font-normal text-muted-foreground">
        Sort by
      </Label>
      <Select
        value={sort}
        onValueChange={(value) => {
          if (isCouponSortKey(value)) onChange(value, dir);
        }}
      >
        <SelectTrigger id="stash-coupons-sort" size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUPON_SORT_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => {
          onChange(sort, dir === 'asc' ? 'desc' : 'asc');
        }}
        aria-label={dir === 'asc' ? 'Sorted ascending, switch to descending' : 'Sorted descending, switch to ascending'}
        title={dir === 'asc' ? 'Ascending' : 'Descending'}
      >
        {dir === 'asc' ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
      </Button>
    </div>
  );
}
