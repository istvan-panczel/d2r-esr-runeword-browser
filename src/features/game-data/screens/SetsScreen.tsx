import { useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { ExactNameChip } from '@/core/components/ExactNameChip';
import { NumberFilterInput } from '@/core/components/RecipeCommonFilters';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { buildShareUrl, MAX_REQ_LEVEL_RANGE } from '@/core/utils/filterUrlParams';
import type { SetsBundle } from '../engine/schema';
import { DocsLink } from '../components/CubeFamilySection';
import { EnhanceSearch, Pills } from '../components/EnhanceParts';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { SetCard } from '../components/SetCard';
import { useGameData } from '../hooks/useGameData';
import { useBaseTiers } from '../hooks/useBaseTiers';
import { useItemSources } from '../hooks/useItemSources';
import { formatCount } from '../utils/cube';
import {
  ANY_CLASS,
  classOptions,
  EMPTY_SETS_STATE,
  encodeSetsState,
  filterSets,
  pieceOptions,
  readSetsState,
  setDocsUrl,
  SETS_ROUTE,
  sortSets,
  type SetsState,
} from '../utils/sets';

const SETS_FILES = ['sets'] as const;
const SEARCH_DEBOUNCE_MS = 300;
const LEVEL_DEBOUNCE_MS = 400;
/** Pill value of "no filter" */
const ALL = '';

export function SetsScreen() {
  const gameData = useGameData(SETS_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return <SetsBrowser bundle={gameData.data.sets} />;
}

/** The page state lives in the URL (search, level, pieces, class, exact name), so links and the back button keep it. */
function SetsBrowser({ bundle }: { readonly bundle: SetsBundle }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readSetsState(searchParams, bundle);
  // The source lines are a bonus: the cards render without them while sources.json loads (or when it fails)
  const sources = useItemSources();
  // Tier badges likewise appear once tiers.json has loaded
  const tiers = useBaseTiers().index;

  const update = (patch: Partial<SetsState>, replace = true) => {
    setSearchParams(encodeSetsState({ ...state, ...patch }), { replace });
  };

  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );
  const [maxLevel, setMaxLevel, commitMaxLevel] = useDebouncedFilterValue(
    state.maxLevel,
    (value) => {
      update({ maxLevel: value });
    },
    LEVEL_DEBOUNCE_MS
  );

  const sets = sortSets(bundle.sets);
  const shown = filterSets(sets, state);
  const getShareUrl = () => buildShareUrl(SETS_ROUTE, encodeSetsState({ ...state, search, maxLevel }));
  const pieces = [
    { value: ALL, label: 'All' },
    ...pieceOptions(sets).map((count) => ({
      value: String(count),
      label: `${String(count)} pieces`,
      count: sets.filter((set) => set.items.length === count).length,
    })),
  ];
  const classes = [
    { value: ALL, label: 'All' },
    { value: ANY_CLASS, label: 'Any class', count: sets.filter((set) => set.classCode === null).length },
    ...classOptions(sets).map((option) => ({
      value: option.code,
      label: option.name,
      count: sets.filter((set) => set.classCode === option.code).length,
    })),
  ];
  const itemCount = bundle.sets.reduce((sum, set) => sum + set.items.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every set in the game files ({formatCount(bundle.sets.length)} sets, {formatCount(itemCount)} items) with each item's own bonuses,
        the bonuses it gains as more pieces of its set are worn, and the set-wide partial and full-set bonuses. Compare with the{' '}
        <DocsLink href={setDocsUrl({ className: null })}>official Sets page</DocsLink>.
      </p>

      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            value={search}
            onChange={setSearch}
            onClear={() => {
              commitSearch('');
            }}
            placeholder="Search sets, items or bonuses..."
            hint="Search set and item names and bonuses;"
          />
          <NumberFilterInput
            id="sets-max-level"
            hint="Max required level."
            label="Max Req Level"
            placeholder="Max Req Lvl"
            max={MAX_REQ_LEVEL_RANGE.max}
            value={maxLevel}
            onChange={setMaxLevel}
            onClear={() => {
              commitMaxLevel(null);
            }}
            clearLabel="Clear max required level"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Share this view.</p>
              <CopyLinkHelpButton />
            </div>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
        </div>

        {state.name === null && (
          <div className="space-y-2">
            <PillRow label="Pieces">
              <Pills
                label="Pieces"
                options={pieces}
                value={state.pieces === null ? ALL : String(state.pieces)}
                onChange={(value) => {
                  update({ pieces: value === ALL ? null : Number(value) }, false);
                }}
              />
            </PillRow>
            <PillRow label="Class">
              <Pills
                label="Class"
                options={classes}
                value={state.cls ?? ALL}
                onChange={(value) => {
                  update({ cls: value === ALL ? null : value }, false);
                }}
              />
            </PillRow>
          </div>
        )}
      </FilterPanel>

      <ResultsBar
        summary={`Showing ${formatCount(shown.length)} of ${formatCount(sets.length)} sets`}
        chips={
          state.name !== null && (
            <ExactNameChip
              name={state.name}
              onClear={() => {
                update({ name: null }, false);
              }}
              scrollOnMount
            />
          )
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          onReset={() => {
            commitSearch('');
            commitMaxLevel(null);
            setSearchParams(encodeSetsState(EMPTY_SETS_STATE));
          }}
        />
      ) : (
        // One set per row on the Standard page; two from 1920 px, three from 2880 px (Wide and Full page widths)
        <div className="space-y-4 @9xl/page:grid @9xl/page:grid-cols-2 @9xl/page:items-start @9xl/page:gap-4 @9xl/page:space-y-0 @11xl/page:grid-cols-3">
          {shown.map((view) => (
            <SetCard key={view.set.id} set={view.set} highlighted={view.highlighted} sources={sources} tiers={tiers} />
          ))}
        </div>
      )}
    </div>
  );
}

function PillRow({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-12 shrink-0 pt-1.5 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function EmptyState({ onReset }: { readonly onReset: () => void }) {
  return (
    <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
      <p>No set matches.</p>
      <p>
        Try fewer words or a higher level, or{' '}
        <button
          type="button"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          onClick={onReset}
        >
          show every set
        </button>
        .
      </p>
    </div>
  );
}
