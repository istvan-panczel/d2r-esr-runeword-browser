import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { BASE_TIER_LABELS, BASE_TIERS } from '@/features/game-data/constants/bases';
import { EnhanceSearch, Pills, type PillOption } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { ItemCards } from '../components/items/ItemCards';
import { ItemTable } from '../components/items/ItemTable';
import { StatConditions } from '../components/items/StatConditions';
import { EmptyResults } from '../components/shared/EmptyResults';
import { PageSelect } from '../components/shared/PageSelect';
import { ShowMoreList } from '../components/shared/ShowMoreList';
import { SortSelect } from '../components/shared/SortSelect';
import { SummaryChips } from '../components/shared/SummaryChips';
import { StashGate } from '../components/StashGate';
import { stashCatalog, withNames, type CatalogBundle, type StashCatalog } from '../engine/catalog';
import { ITEM_CATEGORIES, STASH_ITEM_KINDS, type StashItemKind } from '../engine/describeItem';
import {
  countBy,
  DEFAULT_ITEMS_STATE,
  encodeItemsState,
  ETHEREAL_FILTERS,
  filterItemRows,
  hasItemFilters,
  initialItemSortDir,
  isCategoryFilter,
  isEtherealFilter,
  isItemSortKey,
  isQualityFilter,
  isSocketFilter,
  isTierFilter,
  ITEM_CATEGORY_LABELS,
  ITEM_KIND_LABELS,
  itemPages,
  itemRows,
  itemsSummary,
  readItemsState,
  SOCKET_FILTERS,
  sortItemRows,
  statOptions,
  statTitle,
  type EtherealFilter,
  type ItemRow,
  type ItemSortKey,
  type ItemsState,
  type SocketFilter,
  type TierFilter,
} from '../engine/items/allItems';
import type { ItemTypeIndex } from '../engine/itemTypes';
import { useItemText, type ItemTextState } from '../hooks/useItemText';
import { useStash } from '../hooks/useStash';
import { useStashTypes } from '../hooks/useStashTypes';
import { useUrlState, type UrlState } from '../hooks/useUrlState';
import type { StashFile } from '../parser/types';
import { STASH_SEARCH_HELP } from '../components/shared/stashSearchHelp';

const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';
/** Rows per "Show more" step: table rows, detail cards */
const TABLE_PAGE = 100;
const CARD_PAGE = 30;

const ETHEREAL_LABELS: Readonly<Record<EtherealFilter, string>> = { all: 'All', yes: 'Ethereal', no: 'Not ethereal' };
const SOCKET_LABELS: Readonly<Record<SocketFilter, string>> = {
  all: 'All',
  socketed: 'Socketed',
  open: 'Empty sockets',
  none: 'No sockets',
  runeword: 'Runewords & gemwords',
};
const SORT_LABELS: Readonly<Record<Exclude<ItemSortKey, 'stat'>, string>> = {
  location: 'Where',
  name: 'Name',
  quality: 'Quality',
  ilvl: 'Item level',
};
/** The quality pills: the kind labels, with the runeword pill naming the gemwords it holds */
const QUALITY_LABELS: Readonly<Record<StashItemKind, string>> = { ...ITEM_KIND_LABELS, runeword: 'Runeword & gemword' };
const BASE_SORT_KEYS: readonly string[] = Object.keys(SORT_LABELS);
const TIER_VALUES: readonly Exclude<TierFilter, 'all'>[] = [...BASE_TIERS, 'none'];

/**
 * /stash/items: every item on the stash pages (docs/features/STASH-ITEMS.md "Page"): search, stat filters, filters,
 * sort, table or tooltip cards; the state lives in the URL.
 */
export function StashItemsScreen() {
  const { bundle } = useStash();
  const types = useStashTypes();
  // the names of every code, unique, set item and runeword: loaded by this page only
  const names = useGameData(NAMES_FILES);
  return (
    <StashGate>
      {(stash) => {
        if (types.status === 'loading' || names.status === 'loading') return <GameDataLoading />;
        if (types.status === 'error') return <GameDataError error={types.error} onRetry={types.retry} />;
        if (names.status === 'error') return <GameDataError error={names.error} onRetry={names.retry} />;
        return <ItemsBrowser stash={stash} bundle={withNames(bundle, names.data.stashnames)} types={types.types} />;
      }}
    </StashGate>
  );
}

const NAMES_FILES = ['stashnames'] as const;

interface ItemsBrowserProps {
  readonly stash: StashFile;
  readonly bundle: CatalogBundle;
  readonly types: ItemTypeIndex;
}

/** What the stat text state means for the page: a note, null once the stat text is there */
function textNote(state: ItemTextState): string | null {
  if (state.status === 'loading') return 'Loading the stat text… names and item fields can be searched already.';
  if (state.status === 'error') return 'The stat text could not be loaded: no stat lines, stat search or stat filters.';
  return state.text.hasText ? null : 'The stat text is not available yet: no stat lines, stat search or stat filters.';
}

function ItemsBrowser({ stash, bundle, types }: ItemsBrowserProps) {
  const catalog = stashCatalog(bundle, types);
  const textState = useItemText(catalog);
  const { state, update, set } = useUrlState(readItemsState, encodeItemsState);
  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );

  const text = textState.status === 'ready' ? textState.text : null;
  const note = textNote(textState);
  const rows = itemRows(stash, catalog, text);
  const options = note === null ? statOptions(rows) : [];
  // Stat conditions wait for the stat text: without it no item has a stat value, so they would hide every item
  const filters = note === null ? state : { ...state, stats: [] };
  const shown = sortItemRows(filterItemRows(rows, filters, types), state.sort, state.dir, state.sortStat);
  const optionByKey = new Map(options.map((option) => [option.key, option]));
  const sortStat = state.sort === 'stat' ? state.sortStat : null;
  const shownStats = [...new Set([...state.stats.map((condition) => condition.key), ...(sortStat === null ? [] : [sortStat])])];
  const sortKeys = sortStat === null ? BASE_SORT_KEYS : [...BASE_SORT_KEYS, 'stat'];
  const sortStatOption = optionByKey.get(sortStat ?? '');
  const sortLabels: Readonly<Record<string, string>> = {
    ...SORT_LABELS,
    stat: sortStatOption === undefined ? 'Stat' : statTitle(sortStatOption.label),
  };

  const reset = () => {
    commitSearch('');
    set({ ...DEFAULT_ITEMS_STATE, details: state.details });
  };

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No items on the stash pages of this file.</p>;

  return (
    <div className="space-y-4">
      <ItemsSummaryChips stash={stash} catalog={catalog} />
      <TextStatus state={textState} note={note} />

      <FilterPanel
        title="Find items"
        actions={
          hasItemFilters(state) ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> Reset filters
            </Button>
          ) : undefined
        }
      >
        <EnhanceSearch
          id="stash-items-search"
          value={search}
          onChange={setSearch}
          onClear={() => {
            commitSearch('');
          }}
          placeholder="Search name, base, type, stat text (e.g. faster cast rate)..."
          hint="Search the name, base, item type (belt, ring…), quality, code, socketed items and stat text;"
          help={STASH_SEARCH_HELP}
        />
        <ItemFilters rows={rows} state={state} update={update} />
        <StatConditions
          conditions={state.stats}
          options={options}
          sortStat={sortStat}
          unavailable={note !== null}
          onChange={(stats, replace) => {
            update({ stats }, replace);
          }}
          onSortStat={(key) => {
            update(key === null ? { sort: 'location', sortStat: null, dir: 'asc' } : { sort: 'stat', sortStat: key, dir: 'desc' });
          }}
        />
      </FilterPanel>

      <ResultsBar
        summary={`Showing ${String(shown.length)} of ${String(rows.length)} items`}
        actions={
          <SortSelect
            id="stash-items-sort"
            keys={sortKeys}
            labels={sortLabels}
            sort={sortStat === null && state.sort === 'stat' ? 'location' : state.sort}
            dir={state.dir}
            className="w-40"
            onChange={(sort, dir) => {
              if (isItemSortKey(sort)) update({ sort, dir: sort === state.sort ? dir : initialItemSortDir(sort) });
            }}
          />
        }
      />

      {shown.length === 0 ? (
        <EmptyResults message="No item matches." resetLabel="Show every item" onReset={reset} />
      ) : (
        <ShowMoreList
          // A new filter or sort starts again at the first page
          key={encodeItemsState(state).toString()}
          items={shown}
          pageSize={state.details ? CARD_PAGE : TABLE_PAGE}
          render={(visible) =>
            state.details ? (
              <ItemCards rows={visible} />
            ) : (
              <ItemTable
                rows={visible}
                sort={state.sort}
                dir={state.dir}
                shownStats={shownStats}
                onSort={(sort, dir) => {
                  update({ sort, dir });
                }}
              />
            )
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        Every item on your stash pages; items in sockets are listed inside their item, the materials tab is left out. Rows and columns count
        from 1 at the top left of a stash page. The copy button copies the name for the in-game shared stash search.
      </p>
      <ScrollToTopButton />
    </div>
  );
}

function ItemsSummaryChips({ stash, catalog }: { readonly stash: StashFile; readonly catalog: StashCatalog }) {
  const summary = itemsSummary(stash, catalog.bundle);
  return (
    <SummaryChips
      chips={[
        { value: summary.total, label: 'items on your stash pages' },
        { value: summary.uniques, label: 'uniques' },
        { value: summary.sets, label: 'set items' },
        { value: `${String(summary.runewords)} + ${String(summary.gemwords)}`, label: 'runewords + gemwords' },
      ]}
    />
  );
}

/** Loading / failed / missing stat text, with a retry after a failure; nothing once it is there */
function TextStatus({ state, note }: { readonly state: ItemTextState; readonly note: string | null }) {
  if (note === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="status">
      {state.status === 'loading' && <Spinner className="size-4" />}
      <span>{note}</span>
      {state.status === 'error' && (
        <Button variant="outline" size="sm" onClick={state.retry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Pill options of the values present, with their counts; the selected value stays even without a row */
function pillOptions<K extends string>(
  values: readonly K[],
  labels: Readonly<Record<K, string>>,
  counts: ReadonlyMap<K, number>,
  selected: string
): PillOption[] {
  return values
    .filter((value) => (counts.get(value) ?? 0) > 0 || value === selected)
    .map((value) => ({ value, label: labels[value], count: counts.get(value) ?? 0 }));
}

const TIER_LABELS: Readonly<Record<Exclude<TierFilter, 'all'>, string>> = { ...BASE_TIER_LABELS, none: 'No tier' };

interface ItemFiltersProps {
  readonly rows: readonly ItemRow[];
  readonly state: ItemsState;
  readonly update: UrlState<ItemsState>['update'];
}

/** Quality, category, tier, ethereal, sockets, page and the details switch */
function ItemFilters({ rows, state, update }: ItemFiltersProps) {
  const all: PillOption = { value: ALL, label: 'All', count: rows.length };
  const qualityOptions = [
    all,
    ...pillOptions(
      STASH_ITEM_KINDS,
      QUALITY_LABELS,
      countBy(rows, (row) => row.info.kind),
      state.quality
    ),
  ];
  const categoryOptions = [
    all,
    ...pillOptions(
      ITEM_CATEGORIES,
      ITEM_CATEGORY_LABELS,
      countBy(rows, (row) => row.info.category),
      state.category
    ),
  ];
  const tierOptions = [
    all,
    ...pillOptions(
      TIER_VALUES,
      TIER_LABELS,
      countBy(rows, (row) => row.info.tier ?? 'none'),
      state.tier
    ),
  ];
  const etherealCounts = countBy(rows, (row) => (row.item.ethereal ? 'yes' : 'no'));
  const etherealOptions = ETHEREAL_FILTERS.map((value) => ({
    value,
    label: ETHEREAL_LABELS[value],
    count: value === 'all' ? rows.length : (etherealCounts.get(value) ?? 0),
  }));
  const socketOptions = SOCKET_FILTERS.map((value) => ({
    value,
    label: SOCKET_LABELS[value],
    count: filterItemRows(rows, { ...DEFAULT_ITEMS_STATE, sockets: value }).length,
  }));

  return (
    <>
      <FilterGroup label="Quality">
        <Pills
          label="Quality"
          options={qualityOptions}
          value={state.quality}
          onChange={(value) => {
            if (isQualityFilter(value)) update({ quality: value }, false);
          }}
        />
      </FilterGroup>
      <FilterGroup label="Category">
        <Pills
          label="Category"
          options={categoryOptions}
          value={state.category}
          onChange={(value) => {
            if (isCategoryFilter(value)) update({ category: value }, false);
          }}
        />
      </FilterGroup>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <FilterGroup label="Tier">
          <Pills
            label="Tier"
            options={tierOptions}
            value={state.tier}
            onChange={(value) => {
              if (isTierFilter(value)) update({ tier: value }, false);
            }}
          />
        </FilterGroup>
        <FilterGroup label="Ethereal">
          <Pills
            label="Ethereal"
            options={etherealOptions}
            value={state.ethereal}
            onChange={(value) => {
              if (isEtherealFilter(value)) update({ ethereal: value }, false);
            }}
          />
        </FilterGroup>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <FilterGroup label="Sockets">
          <Pills
            label="Sockets"
            options={socketOptions}
            value={state.sockets}
            onChange={(value) => {
              if (isSocketFilter(value)) update({ sockets: value }, false);
            }}
          />
        </FilterGroup>
        <PageSelect
          id="stash-items-page"
          pages={itemPages(rows)}
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
    </>
  );
}

function FilterGroup({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
