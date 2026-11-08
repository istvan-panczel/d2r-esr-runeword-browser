import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterPanel } from '@/components/FilterPanel';
import { SectionHeader } from '@/components/SectionHeader';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { CUBE_QUALITIES, type CubeBundle, type CubeQuality } from '../engine/schema';
import { useGuide } from '@/features/guide/hooks/useGuide';
import { CubeFamilySection, CubeNotes, DocsLink, GuideLinks, type CubeGuideNote } from '../components/CubeFamilySection';
import { EnhanceSearch } from '../components/EnhanceParts';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { useGameData } from '../hooks/useGameData';
import {
  CUBE_DOCS_URL,
  CUBE_QUALITY_LABELS,
  buildCubeTree,
  encodeCubeState,
  familyGuideNotes,
  filterCubeTree,
  focusCubeTree,
  formatCount,
  isFiltering,
  readCubeState,
  sectionDocsUrl,
  shownRowCount,
  type CubeSectionView,
  type CubeState,
} from '../utils/cube';

const CUBE_FILES = ['cube'] as const;
const CUBE_ROUTE = 'game-data/cube';
const SEARCH_DEBOUNCE_MS = 300;
/** The "Show all families" line above a focused family, scrolled into view */
const FOCUS_ANCHOR = 'cube-family-focus';

export function CubeScreen() {
  const gameData = useGameData(CUBE_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return <CubeBrowser bundle={gameData.data.cube} />;
}

/** The page state lives in the URL (searches, qualities, focused family), so links and the back button keep it. */
function CubeBrowser({ bundle }: { readonly bundle: CubeBundle }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readCubeState(searchParams, bundle);
  const tree = buildCubeTree(bundle);
  // The guide links are a bonus: the page works without the guide bundle (loading or failed)
  const guide = useGuide();
  const notesIndex = guide.status === 'ready' ? guide.data.bundle : null;
  const titles = new Map(guide.status === 'ready' ? guide.data.bundle.notes.map((note) => [note.slug, note.title]) : []);
  const known = new Set(titles.keys());
  const guideNotes = (slugs: readonly string[]): CubeGuideNote[] => slugs.map((slug) => ({ slug, title: titles.get(slug) ?? slug }));

  const update = (patch: Partial<CubeState>, replace = true) => {
    setSearchParams(encodeCubeState({ ...state, ...patch }), { replace });
  };

  const [input, setInput, commitInput] = useDebouncedFilterValue(
    state.input,
    (value) => {
      update({ input: value });
    },
    SEARCH_DEBOUNCE_MS
  );
  const [output, setOutput, commitOutput] = useDebouncedFilterValue(
    state.output,
    (value) => {
      update({ output: value });
    },
    SEARCH_DEBOUNCE_MS
  );

  // A focused family scrolls into view (from a guide link or a family chip)
  useEffect(() => {
    if (state.family === null) return;
    document.getElementById(FOCUS_ANCHOR)?.scrollIntoView({ block: 'start' });
  }, [state.family]);

  const getShareUrl = () => buildShareUrl(CUBE_ROUTE, encodeCubeState({ ...state, input, output }));
  const filtered = filterCubeTree(tree, state);
  const filtering = isFiltering(state);
  // Remounts the family sections on a new filter so "Show all" starts closed
  const filterKey = [state.search, state.input, state.output, state.qualities.join(',')].join('|');
  const toggleQuality = (quality: CubeQuality) => {
    const qualities = state.qualities.includes(quality)
      ? state.qualities.filter((entry) => entry !== quality)
      : [...state.qualities, quality];
    update({ qualities: CUBE_QUALITIES.filter((entry) => qualities.includes(entry)) });
  };
  const shown = focusCubeTree(filtered, state.family);
  const total = bundle.families.reduce((sum, family) => sum + family.rowCount, 0);
  const focus = (family: string | null) => {
    update({ family }, false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every cube recipe in the game files: {formatCount(total)} cubemain rows in {formatCount(bundle.families.length)} families, grouped
        like the <DocsLink href={CUBE_DOCS_URL}>official Cube Recipes page</DocsLink>. Rows that only differ in the base type, quality or
        class are merged into one line.
      </p>

      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            id="cube-input-search"
            label="Ingredient"
            value={input}
            onChange={setInput}
            onClear={() => {
              commitInput('');
            }}
            placeholder="Ingredient, e.g. perfect gem..."
            hint="Ingredient: what goes in;"
          />
          <EnhanceSearch
            id="cube-output-search"
            label="Result"
            value={output}
            onChange={setOutput}
            onClear={() => {
              commitOutput('');
            }}
            placeholder="Result, e.g. unique, sockets, life..."
            hint="Result: the item and its bonuses;"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Share this view.</p>
              <CopyLinkHelpButton />
            </div>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Result quality</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {CUBE_QUALITIES.map((quality) => (
              <label key={quality} className="flex h-7 cursor-pointer items-center gap-1">
                <Checkbox
                  checked={state.qualities.includes(quality)}
                  onCheckedChange={() => {
                    toggleQuality(quality);
                  }}
                />
                <span className="text-sm">{CUBE_QUALITY_LABELS[quality]}</span>
              </label>
            ))}
          </div>
        </div>

        {state.search !== '' && (
          <p className="text-sm text-muted-foreground">
            Matching “{state.search}” in ingredients or results (from an older link).{' '}
            <button
              type="button"
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              onClick={() => {
                update({ search: '' });
              }}
            >
              Clear
            </button>
          </p>
        )}

        {state.family === null ? (
          <FamilyIndex
            tree={filtered}
            searching={filtering}
            onFocus={(family) => {
              focus(family);
            }}
          />
        ) : (
          <p id={FOCUS_ANCHOR} className="scroll-mt-20 text-sm">
            <button
              type="button"
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              onClick={() => {
                focus(null);
              }}
            >
              ← Show all families
            </button>
          </p>
        )}
      </FilterPanel>

      {state.family === null && !filtering && <HiddenRowsCards bundle={bundle} />}

      {shown.length === 0 ? (
        <EmptyState focused={state.family !== null} />
      ) : (
        <div className="space-y-8">
          {shown.map(({ section, families }) => (
            <div key={section.id} className="space-y-5">
              <div className="space-y-2">
                <SectionHeader title={section.label} />
                {section.notes !== undefined && <CubeNotes notes={section.notes} className="text-sm" />}
                <GuideLinks notes={guideNotes((section.guide ?? []).filter((slug) => known.has(slug)))} />
                {section.page !== undefined && (
                  <p className="text-xs">
                    <Link
                      to={section.page.path}
                      className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                    >
                      {section.page.label}
                    </Link>
                  </p>
                )}
              </div>
              {families.map((view) => (
                <CubeFamilySection
                  key={`${view.family.id}|${filterKey}`}
                  view={view}
                  section={section}
                  searching={filtering}
                  icons={bundle.icons}
                  guideNotes={guideNotes(familyGuideNotes(section, view.family.id, notesIndex, known, true))}
                  onFocus={(family) => {
                    focus(family);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      <ScrollToTopButton />
    </div>
  );
}

interface FamilyIndexProps {
  readonly tree: readonly CubeSectionView[];
  readonly searching: boolean;
  readonly onFocus: (family: string) => void;
}

/** The families by section, with their row counts (matching rows while searching); a chip focuses one family */
function FamilyIndex({ tree, searching, onFocus }: FamilyIndexProps) {
  if (tree.length === 0) return null;
  return (
    <nav aria-label="Recipe families" className="border-t pt-4">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        {tree.map(({ section, families }) => {
          const docs = sectionDocsUrl(section);
          return (
            <div key={section.id} className="contents">
              <dt className="pt-0.5 text-xs font-semibold text-muted-foreground">
                {docs === null ? section.label : <DocsLink href={docs}>{section.label}</DocsLink>}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {families.map((view) => (
                  <button
                    key={view.family.id}
                    type="button"
                    onClick={() => {
                      onFocus(view.family.id);
                    }}
                    className="rounded-full border bg-background px-2.5 py-0.5 text-xs transition-colors hover:bg-accent"
                  >
                    {view.family.label}
                    <span className="ml-1.5 text-muted-foreground">
                      {formatCount(searching ? shownRowCount(view) : view.family.rowCount)}
                    </span>
                  </button>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </nav>
  );
}

/** Where the rows that are not listed went: the Enhance page and the stocker bookkeeping */
function HiddenRowsCards({ bundle }: { readonly bundle: CubeBundle }) {
  const { hidden } = bundle;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="py-3">
        <CardContent className="space-y-1 px-4 text-sm">
          <p className="font-medium">Corruption, anointment and the Vessel of Souls</p>
          <p className="text-muted-foreground">
            Their {formatCount(hidden.enhance)} rows (one per roll) are summarised as outcome lists on the{' '}
            <Link to="/game-data/enhance" className="font-medium text-primary underline decoration-primary/40 underline-offset-2">
              Enhance page
            </Link>
            .
          </p>
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardContent className="space-y-1 px-4 text-sm">
          <p className="font-medium">Stockers and cans</p>
          <p className="text-muted-foreground">
            Storing items in a Multi Stocker, Rune Stocker, Gem Can, Crystal Can or Rerolling Orb, taking them out and cycling the selected
            item take {formatCount(hidden.stockers)} rows; they are left out, as are {formatCount(hidden.traps + hidden.old + hidden.dummy)}{' '}
            internal blocker and unused rows. Their upgrades, point conversions and rerolls are listed with the other recipes. The{' '}
            <DocsLink href={CUBE_DOCS_URL}>official Cube Recipes page</DocsLink> explains the stockers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ focused }: { readonly focused: boolean }) {
  return (
    <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
      <p>{focused ? 'Nothing in this family matches the filters.' : 'No cube recipe matches the filters.'}</p>
      <p>
        Try fewer words or qualities, or look it up on the <DocsLink href={CUBE_DOCS_URL}>official Cube Recipes page</DocsLink>.
      </p>
    </div>
  );
}
