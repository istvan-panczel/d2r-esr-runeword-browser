import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { FilterPanel } from '@/components/FilterPanel';
import { PageShell } from '@/components/PageShell';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { EnhanceSearch, NoMatches, Pills } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { ModifierFact } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { useMythicalNames } from '@/features/skills/hooks/useMythicalNames';
import { EntryChips, ModifierDetail, SourceLegend } from '../components/ModifierDetail';
import { RichText } from '../components/RichText';
import { MODIFIER_CONTENT, OPEN_QUESTIONS } from '../content';
import {
  ALL_CATEGORIES,
  buildModifiersView,
  CATEGORY_LABELS,
  CATEGORY_FILTERS,
  encodeModifiersState,
  filterModifiers,
  MODIFIERS_ROUTE,
  readModifiersState,
  statDisplayText,
  type CategoryFilter,
  type ModifierEntry,
  type ModifiersState,
  type ModifiersView,
} from '../utils/modifiersView';

const MODIFIER_FILES = ['modifiers'] as const;
const SEARCH_DEBOUNCE_MS = 250;

export function ModifiersScreen() {
  const gameData = useGameData(MODIFIER_FILES);
  return (
    <PageShell title="Modifiers">
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && (
        <ModifiersBrowser
          view={buildModifiersView(gameData.data.modifiers, MODIFIER_CONTENT, OPEN_QUESTIONS)}
          facts={gameData.data.modifiers.facts}
        />
      )}
    </PageShell>
  );
}

function listHref(state: ModifiersState, patch: Partial<ModifiersState>): string {
  const query = encodeModifiersState({ ...state, ...patch }).toString();
  return query === '' ? `/${MODIFIERS_ROUTE}` : `/${MODIFIERS_ROUTE}?${query}`;
}

/** The page state (focused modifier, category, search, Key / All) lives in the URL, so links and the back button keep it. */
function ModifiersBrowser({ view, facts }: { readonly view: ModifiersView; readonly facts: readonly ModifierFact[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readModifiersState(searchParams, view);
  const update = (patch: Partial<ModifiersState>, replace = false) => {
    setSearchParams(encodeModifiersState({ ...state, ...patch }), { replace });
  };
  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value }, true);
    },
    SEARCH_DEBOUNCE_MS
  );
  const mythicals = useMythicalNames();
  const focused = state.kind === null ? undefined : view.byKey.get(state.kind);

  // A newly focused modifier opens at the top of the page
  useEffect(() => {
    if (state.kind !== null) window.scrollTo({ top: 0 });
  }, [state.kind]);

  const list = filterModifiers(view, { ...state, search });
  const getShareUrl = () => buildShareUrl(MODIFIERS_ROUTE, encodeModifiersState({ ...state, search }));
  const categoryOptions = CATEGORY_FILTERS.map((category) => ({
    value: category,
    label: category === ALL_CATEGORIES ? 'All' : CATEGORY_LABELS[category],
    count: list.counts[category],
  }));

  return (
    <div className="space-y-4">
      {focused !== undefined ? (
        <ModifierDetail entry={focused} facts={facts} mythicals={mythicals} backHref={listHref(state, { kind: null, search })} />
      ) : (
        <>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              What the item modifiers do in ESR: Deadly Strike, Crushing Blow, leech, resists, procs, speed, Magic Find and every other stat
              ESR items carry. The numbers come from the ESR game files and the mod&apos;s loader plugin configs, next to vanilla D2R. Each
              claim carries its source:
            </p>
            <SourceLegend />
          </div>

          <FilterPanel>
            <div className="flex flex-wrap items-end gap-4">
              <EnhanceSearch
                id="modifiers-search"
                value={search}
                onChange={setSearch}
                onClear={() => {
                  commitSearch('');
                }}
                placeholder="Search modifiers..."
                hint="Search names, explanations and item line text;"
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Share this view.</p>
                <CopyLinkButton getShareUrl={getShareUrl} />
              </div>
            </div>
            <Pills
              label="Category"
              options={categoryOptions}
              value={state.category}
              onChange={(value) => {
                update({ category: value as CategoryFilter, kind: null });
              }}
            />
            <Pills
              label="Show"
              options={[
                { value: 'key', label: 'Key modifiers' },
                { value: 'all', label: 'All stats' },
              ]}
              value={state.view}
              onChange={(value) => {
                update({ view: value === 'all' ? 'all' : 'key', kind: null });
              }}
            />
          </FilterPanel>

          <section aria-label="Modifiers" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {list.entries.length} modifier{list.entries.length === 1 ? '' : 's'}
              {list.moreInAll > 0 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                    onClick={() => {
                      update({ view: 'all' });
                    }}
                  >
                    {list.moreInAll} more in All stats
                  </button>
                </>
              )}
            </p>
            {list.entries.length === 0 ? (
              <NoMatches />
            ) : (
              <ul className="grid gap-2 md:grid-cols-2 @8xl/page:grid-cols-3 @10xl/page:grid-cols-4">
                {list.entries.map((entry) => (
                  <ModifierListItem key={entry.key} entry={entry} href={listHref(state, { kind: entry.key, search })} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <ScrollToTopButton />
    </div>
  );
}

function ModifierListItem({ entry, href }: { readonly entry: ModifierEntry; readonly href: string }) {
  const firstText = entry.stats.find((stat) => stat.text !== undefined)?.text;
  return (
    <li className="min-w-0">
      <Link
        to={href}
        className="block h-full space-y-1.5 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
      >
        <span className="block font-semibold">{entry.title}</span>
        <span className="block text-sm text-muted-foreground">
          {entry.content !== null ? (
            <RichText line={entry.content.summary} />
          ) : firstText !== undefined ? (
            statDisplayText(firstText)
          ) : (
            entry.stats.map((stat) => stat.stat).join(', ')
          )}
        </span>
        <EntryChips entry={entry} />
      </Link>
    </li>
  );
}
