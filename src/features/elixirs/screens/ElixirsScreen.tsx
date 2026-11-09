import { Link, useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { PageShell } from '@/components/PageShell';
import { ResultsBar } from '@/components/ResultsBar';
import { ExactNameChip } from '@/core/components/ExactNameChip';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { cn } from '@/lib/utils';
import { EnhanceSearch, NoMatches, Pills } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { ElixirsBundle } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import { LevelInput, LevelStepper } from '@/features/skills/components/LevelInput';
import { ElixirCard } from '../components/ElixirCard';
import { DropsPanel, NameClashNote, PerksSection, RecipesSection } from '../components/ElixirSections';
import {
  defaultState,
  elixirValues,
  ELIXIRS_GUIDE_NOTE,
  ELIXIRS_ROUTE,
  encodeElixirsState,
  filterElixirs,
  MAX_BONUS,
  oddsFor,
  readElixirsState,
  togglePerks,
  UTILITY_POTIONS_MODIFIER,
  type ElixirsState,
} from '../utils/elixirsView';

const ELIXIR_FILES = ['elixirs'] as const;
const SEARCH_DEBOUNCE_MS = 250;
const ALL = '';
/** Quick character levels next to the level input (the top level is added) */
const QUICK_LEVELS = [1, 30, 60, 90] as const;
const META_LINK = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

export function ElixirsScreen() {
  const gameData = useGameData(ELIXIR_FILES);
  const version = useManifest()?.esrVersion ?? null;
  return (
    <PageShell
      title="Elixirs"
      meta={
        <>
          The drinkable utility elixirs{version === null ? '' : ` of ESR ${version}`}, read from the game files: what each one gives at your
          level, how they drop and which Alchemist perks change them. Read more in the guide&apos;s{' '}
          <Link to={ELIXIRS_GUIDE_NOTE} className={META_LINK}>
            Elixirs note
          </Link>{' '}
          and on the Modifiers page&apos;s{' '}
          <Link to={UTILITY_POTIONS_MODIFIER} className={META_LINK}>
            Utility Potion Effectiveness and Duration
          </Link>
          .
        </>
      }
    >
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && <ElixirsBrowser bundle={gameData.data.elixirs} />}
    </PageShell>
  );
}

function ElixirsBrowser({ bundle }: { readonly bundle: ElixirsBundle }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readElixirsState(searchParams, bundle);
  const update = (patch: Partial<ElixirsState>, replace = true) => {
    setSearchParams(encodeElixirsState({ ...state, ...patch }, bundle), { replace });
  };
  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );

  const perks = new Map(bundle.perks.map((perk) => [perk.key, perk]));
  const toggles = togglePerks(bundle);
  const shown = filterElixirs(bundle, state);
  const odds = oddsFor(bundle, state.perks);
  const byCode = new Map(bundle.elixirs.map((elixir) => [elixir.code, elixir]));
  const focused = state.name === null ? null : (bundle.elixirs.find((elixir) => elixir.slug === state.name) ?? null);
  const getShareUrl = () => buildShareUrl(ELIXIRS_ROUTE, encodeElixirsState({ ...state, search }, bundle));
  const levels = [...QUICK_LEVELS.filter((level) => level < bundle.maxLevel), bundle.maxLevel];

  return (
    <div className="space-y-6">
      <DropsPanel bundle={bundle} perks={perks} />

      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            value={search}
            onChange={setSearch}
            onClear={() => {
              commitSearch('');
            }}
            placeholder="Search elixirs, effects or perks..."
            hint="Search names, effects and perks;"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Share this view.</p>
              <CopyLinkHelpButton />
            </div>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="space-y-1">
            <label htmlFor="elixir-level" className="text-xs text-muted-foreground">
              Character level
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <LevelStepper
                id="elixir-level"
                label="character level"
                value={state.level}
                min={1}
                max={bundle.maxLevel}
                onCommit={(level) => {
                  update({ level });
                }}
              />
              <div className="flex flex-wrap gap-1" role="group" aria-label="Quick character levels">
                {levels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={state.level === level}
                    onClick={() => {
                      update({ level });
                    }}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs tabular-nums transition-colors',
                      state.level === level ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <BonusInput
            id="elixir-effectiveness"
            label="Utility Potion Effectiveness %"
            value={state.effectiveness}
            onCommit={(effectiveness) => {
              update({ effectiveness });
            }}
          />
          <BonusInput
            id="elixir-duration"
            label="Utility Potion Duration %"
            value={state.duration}
            onCommit={(duration) => {
              update({ duration });
            }}
          />
        </div>

        {toggles.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Alchemist perks you have (they change the values or the drop odds)</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Alchemist perks">
              {toggles.map((perk) => {
                const active = state.perks.includes(perk.key);
                return (
                  <button
                    key={perk.key}
                    type="button"
                    aria-pressed={active}
                    title={perk.description}
                    onClick={() => {
                      update({ perks: active ? state.perks.filter((key) => key !== perk.key) : [...state.perks, perk.key] }, false);
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {perk.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.name === null && (
          <div className="space-y-2">
            <PillRow label="Drops">
              <Pills
                label="Who finds them"
                options={[
                  { value: ALL, label: 'All' },
                  { value: 'everyone', label: 'For everyone' },
                  { value: 'perk', label: 'Needs a perk' },
                ]}
                value={state.avail ?? ALL}
                onChange={(value) => {
                  update({ avail: value === 'everyone' || value === 'perk' ? value : null }, false);
                }}
              />
            </PillRow>
            <PillRow label="Variant">
              <Pills
                label="Variant"
                options={[
                  { value: ALL, label: 'All' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'greater', label: 'Greater' },
                ]}
                value={state.variant ?? ALL}
                onChange={(value) => {
                  update({ variant: value === 'regular' || value === 'greater' ? value : null }, false);
                }}
              />
            </PillRow>
          </div>
        )}
      </FilterPanel>

      <div>
        <ResultsBar
          summary={`Showing ${String(shown.length)} of ${String(bundle.elixirs.length)} elixirs at character level ${String(state.level)}`}
          chips={
            focused !== null && (
              <ExactNameChip
                name={focused.name}
                onClear={() => {
                  update({ name: null }, false);
                }}
                scrollOnMount
              />
            )
          }
          actions={
            (state.effectiveness !== 0 || state.duration !== 0 || state.perks.length > 0 || state.level !== bundle.maxLevel) && (
              <button
                type="button"
                className="text-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                onClick={() => {
                  const reset = defaultState(bundle);
                  update({ level: reset.level, effectiveness: 0, duration: 0, perks: [] }, false);
                }}
              >
                Reset level, bonuses and perks
              </button>
            )
          }
        />
        {shown.length === 0 ? (
          <NoMatches />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5">
            {shown.map((elixir) => {
              const pair = elixir.pair === undefined ? undefined : byCode.get(elixir.pair);
              return (
                <ElixirCard
                  key={elixir.code}
                  elixir={elixir}
                  values={elixirValues(elixir, state, bundle.maxLevel)}
                  maxLevel={bundle.maxLevel}
                  chance={elixir.dropPerks === undefined ? null : (odds[elixir.code] ?? 0)}
                  perks={perks}
                  pairName={pair?.name ?? null}
                  pairSlug={pair?.slug ?? null}
                  highlighted={state.name === elixir.slug}
                />
              );
            })}
          </div>
        )}
      </div>

      <PerksSection perks={bundle.perks} />
      <RecipesSection recipes={bundle.recipes} />
      <NameClashNote otherUtilityPotions={bundle.otherUtilityPotions} />
    </div>
  );
}

function BonusInput({
  id,
  label,
  value,
  onCommit,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onCommit: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        {label}
      </label>
      <LevelInput id={id} value={value} min={0} max={MAX_BONUS} onCommit={onCommit} className="w-20" />
    </div>
  );
}

function PillRow({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-14 shrink-0 pt-1.5 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
