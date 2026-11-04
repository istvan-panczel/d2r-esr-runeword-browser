import { useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ExternalLink } from '@/components/ExternalLink';
import { FilterPanel } from '@/components/FilterPanel';
import { PageShell } from '@/components/PageShell';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { FRAME_TABLE_URL } from '@/core/navigation/navConfig';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { EnhanceSearch, Pills } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import type { SkillDetail } from '@/features/game-data/engine/schema';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { SkillClassTrees } from '../components/SkillClassTrees';
import { SkillDetailCard } from '../components/SkillDetailCard';
import { SkillTile } from '../components/SkillTile';
import { SkillTreesLayout } from '../components/SkillTreesLayout';
import { useDetailScroll } from '../hooks/useDetailScroll';
import { useMythicalNames } from '../hooks/useMythicalNames';
import {
  buildSkillsView,
  disambiguation,
  duplicateNames,
  encodeSkillsState,
  ITEM_SKILLS,
  readSkillsState,
  searchSkills,
  selectionMarks,
  SKILLS_ROUTE,
  type SkillsState,
  type SkillsView,
  type SkillTileMark,
} from '../utils/skills';

const SKILL_FILES = ['skills', 'skilldetails'] as const;
const SEARCH_DEBOUNCE_MS = 250;

export function SkillsScreen() {
  const gameData = useGameData(SKILL_FILES);
  return (
    <PageShell title="Skills">
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && <SkillsBrowser view={buildSkillsView(gameData.data.skills, gameData.data.skilldetails)} />}
    </PageShell>
  );
}

/** The page state (class, tab, skill, search) lives in the URL, so links and the back button keep it. */
function SkillsBrowser({ view }: { readonly view: SkillsView }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readSkillsState(searchParams, view);
  const update = (patch: Partial<SkillsState>, replace = false) => {
    setSearchParams(encodeSkillsState({ ...state, ...patch }), { replace });
  };
  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value }, true);
    },
    SEARCH_DEBOUNCE_MS
  );
  const mythicals = useMythicalNames();

  const selected = state.skill === null ? undefined : view.byId.get(state.skill);
  const markOf = selectionMarks(view, state.skill);
  const { ref: detailRef, requestScroll } = useDetailScroll(state.skill);
  const select = (id: string) => {
    const detail = view.byId.get(id);
    if (detail === undefined) return;
    requestScroll();
    commitSearch('');
    update({ skill: id, view: detail.cls ?? ITEM_SKILLS, tab: detail.page ?? state.tab, search: '' });
  };

  const cls = view.classes.find((entry) => entry.code === state.view);
  const results = search.trim() === '' ? null : searchSkills(view, search);
  const classOptions = [
    ...view.classes.map((entry) => ({ value: entry.code, label: entry.name })),
    { value: ITEM_SKILLS, label: 'Item skills', count: view.itemSkills.length },
  ];
  const getShareUrl = () => buildShareUrl(SKILLS_ROUTE, encodeSkillsState({ ...state, search }));

  const detailCard =
    selected === undefined ? null : (
      <div ref={detailRef} className="scroll-mt-20">
        <SkillDetailCard
          key={selected.id}
          view={view}
          skill={selected}
          mythicals={mythicals}
          onSelect={select}
          onClose={() => {
            update({ skill: null });
          }}
        />
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every class skill tree from the ESR game files, plus the skills only items grant. Pick a skill for its description, mana cost,
        synergies and the uniques, set items and runewords that grant it. Per-level values are formulas in the game files and are not shown.
        For attack and cast speed breakpoints see the official{' '}
        <ExternalLink
          href={FRAME_TABLE_URL}
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
          iconClassName="size-3"
        >
          Frame Table
        </ExternalLink>
        .
      </p>

      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            value={search}
            onChange={setSearch}
            onClear={() => {
              commitSearch('');
            }}
            placeholder="Search skills by name..."
            hint="Search every class and item skill by name;"
          />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Share this view.</p>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
        </div>

        <Pills
          label="Class"
          options={classOptions}
          value={state.view}
          onChange={(value) => {
            update({ view: value, skill: null, tab: 1 });
          }}
        />
      </FilterPanel>

      <SkillTreesLayout aside={detailCard} placeholder="Pick a skill to see its details and the items that grant it.">
        {results !== null ? (
          <SearchResults view={view} results={results} onSelect={select} />
        ) : cls !== undefined ? (
          <SkillClassTrees
            cls={cls}
            tab={state.tab}
            onTabChange={(tab) => {
              update({ tab }, true);
            }}
            markOf={markOf}
            onSelect={select}
          />
        ) : (
          <ItemSkills view={view} markOf={markOf} onSelect={select} />
        )}
      </SkillTreesLayout>
      <ScrollToTopButton />
    </div>
  );
}

function ItemSkills({
  view,
  markOf,
  onSelect,
}: {
  readonly view: SkillsView;
  readonly markOf: (id: string) => SkillTileMark;
  readonly onSelect: (id: string) => void;
}) {
  const duplicates = duplicateNames(view.itemSkills);
  return (
    <section aria-label="Item skills" className="space-y-2 rounded-lg border bg-card p-2">
      <p className="px-1 text-xs text-muted-foreground">
        Skills no class has in its tree, granted by uniques, set items and runewords (procs, item-only spells, ESR's elemental surges and
        masteries). Many have no description text in the game files.
      </p>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 @8xl/page:grid-cols-10 @9xl/page:grid-cols-12 @10xl/page:grid-cols-14 @11xl/page:grid-cols-16">
        {view.itemSkills.map((skill) => {
          const variant = disambiguation(skill, duplicates);
          const count = grantCount(skill.grantedBy?.length ?? 0);
          return (
            <SkillTile
              key={skill.id}
              skill={skill}
              mark={markOf(skill.id)}
              onSelect={onSelect}
              subtitle={variant === null ? count : `${variant} · ${count}`}
            />
          );
        })}
      </div>
    </section>
  );
}

function grantCount(count: number): string {
  return `${String(count)} item${count === 1 ? '' : 's'}`;
}

function SearchResults({
  view,
  results,
  onSelect,
}: {
  readonly view: SkillsView;
  readonly results: readonly SkillDetail[];
  readonly onSelect: (id: string) => void;
}) {
  if (results.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No skill matches.</p>;
  return (
    <section aria-label="Search results" className="space-y-2 rounded-lg border bg-card p-2">
      <p className="px-1 text-xs text-muted-foreground">
        {String(results.length)} skill{results.length === 1 ? '' : 's'} found
      </p>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 @8xl/page:grid-cols-10 @9xl/page:grid-cols-12 @10xl/page:grid-cols-14 @11xl/page:grid-cols-16">
        {results.map((skill) => (
          <SkillTile
            key={skill.id}
            skill={skill}
            mark={null}
            onSelect={onSelect}
            subtitle={skill.cls === null ? 'Item skill' : (view.classNames.get(skill.cls) ?? skill.cls)}
          />
        ))}
      </div>
    </section>
  );
}
