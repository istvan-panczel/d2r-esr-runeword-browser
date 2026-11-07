import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { ResultsBar } from '@/components/ResultsBar';
import type { BaseAutomod, BaseItem, SuperiorAffixes, TypesBundle } from '../engine/schema';
import { readSuperiorAffixes } from '../engine/superiorAffixes';
import { BASES_PAGE_SIZE } from '../constants/bases';
import { BaseCard } from '../components/BaseCard';
import { BaseFamilyTable } from '../components/BaseFamilyTable';
import { BaseFilters } from '../components/BaseFilters';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { useGameData } from '../hooks/useGameData';
import { useBasesUrlState } from '../hooks/useBasesUrlState';
import { selectBaseFilters, setBaseSearch, setBaseView, type BaseFilters as BaseFilterState } from '../store/gameDataSlice';
import { buildBaseFamilies } from '../utils/baseFamilies';
import { buildFamilyView } from '../utils/familyView';
import { filterBases } from '../utils/filterBases';
import { buildMasteryIndex, type MasteryIndex } from '../utils/masteries';
import { buildTypeGroups } from '../utils/typeGroups';

const BASES_FILES = ['types', 'bases', 'masteries'] as const;

export function BasesScreen() {
  const gameData = useGameData(BASES_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return (
    <BasesBrowser
      typesBundle={gameData.data.types}
      bases={gameData.data.bases.bases}
      automods={gameData.data.bases.automods ?? []}
      superior={readSuperiorAffixes(gameData.data.bases)}
      masteries={buildMasteryIndex(gameData.data.masteries)}
    />
  );
}

interface BasesBrowserProps {
  readonly typesBundle: TypesBundle;
  readonly bases: readonly BaseItem[];
  readonly automods: readonly BaseAutomod[];
  readonly superior: SuperiorAffixes | null;
  readonly masteries: MasteryIndex;
}

function BasesBrowser({ typesBundle, bases, automods, superior, masteries }: BasesBrowserProps) {
  const dispatch = useDispatch();
  const filters = useSelector(selectBaseFilters);
  const { types, classes } = typesBundle;

  const typeByCode = new Map(types.map((type) => [type.code, type]));
  const typeNames = new Map(types.map((type) => [type.code, type.name]));
  const knownTypes = new Set(typeByCode.keys());
  const baseByCode = new Map(bases.map((base) => [base.code, base]));
  const automodById = new Map(automods.map((automod) => [automod.id, automod]));
  const classNames = new Map<string, string>(classes.map((cls) => [cls.code, cls.name]));
  const typeGroups = buildTypeGroups(bases, types);
  const getShareUrl = useBasesUrlState(knownTypes);

  const handleSearch = (text: string) => {
    dispatch(setBaseSearch(text));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filtersBar = <BaseFilters classes={classes} typeGroups={typeGroups} typeNames={typeNames} getShareUrl={getShareUrl} />;

  if (filters.view === 'families') {
    return (
      <div>
        {filtersBar}
        <FamiliesView
          bases={bases}
          types={types}
          filters={filters}
          typeNames={typeNames}
          onSelect={(base) => {
            dispatch(setBaseView('cards'));
            handleSearch(`"${base.name}"`);
          }}
        />
        <ScrollToTopButton />
      </div>
    );
  }

  const filtered = filterBases(bases, filters, typeNames);

  return (
    <div>
      {filtersBar}

      <ResultsBar summary={`Showing ${String(filtered.length)} of ${String(bases.length)} bases`} />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No bases found. Try adjusting your filters.</p>
      ) : (
        // Re-mount (and reset "Show more") whenever the filters change
        <BaseList
          key={JSON.stringify(filters)}
          bases={filtered}
          renderBase={(base) => (
            <BaseCard
              base={base}
              typeByCode={typeByCode}
              baseByCode={baseByCode}
              automodById={automodById}
              classNames={classNames}
              superior={superior}
              masteries={masteries}
              onSearch={handleSearch}
            />
          )}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
}

interface FamiliesViewProps {
  readonly bases: readonly BaseItem[];
  readonly types: TypesBundle['types'];
  readonly filters: BaseFilterState;
  readonly typeNames: ReadonlyMap<string, string>;
  readonly onSelect: (base: BaseItem) => void;
}

function FamiliesView({ bases, types, filters, typeNames, onSelect }: FamiliesViewProps) {
  const view = buildFamilyView(buildBaseFamilies(bases, types), filters, typeNames);
  const { families, totalFamilies, members, matching, loners } = view.counts;
  const basesWord = (count: number) => (count === 1 ? 'base' : 'bases');

  return (
    <>
      <ResultsBar
        summary={
          <>
            Showing {families} of {totalFamilies} {totalFamilies === 1 ? 'family' : 'families'} ({matching} of {members}{' '}
            {basesWord(members)} matching the filters) and {loners} {basesWord(loners)} without a family
          </>
        }
      />
      {families === 0 && loners === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No bases found. Try adjusting your filters.</p>
      ) : (
        <BaseFamilyTable view={view} onSelect={onSelect} />
      )}
    </>
  );
}

interface BaseListProps {
  readonly bases: readonly BaseItem[];
  readonly renderBase: (base: BaseItem) => React.ReactNode;
}

function BaseList({ bases, renderBase }: BaseListProps) {
  const [visibleCount, setVisibleCount] = useState(BASES_PAGE_SIZE);
  const visible = bases.slice(0, visibleCount);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7 gap-4">
        {visible.map((base) => (
          <div key={base.code} className="card-visibility-auto">
            {renderBase(base)}
          </div>
        ))}
      </div>
      {visibleCount < bases.length && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setVisibleCount((count) => count + BASES_PAGE_SIZE);
            }}
          >
            Show more ({bases.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </>
  );
}
