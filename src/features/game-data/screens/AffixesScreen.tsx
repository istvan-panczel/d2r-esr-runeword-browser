import { useDispatch, useSelector } from 'react-redux';
import { ResultsBar } from '@/components/ResultsBar';
import { ToolbarCard } from '@/components/ToolbarCard';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { cn } from '@/lib/utils';
import type { Affix, BaseItem, SuperiorAffixes, TypesBundle } from '../engine/schema';
import { eligibleAffixes } from '../engine/affixEligibility';
import { readSuperiorAffixes } from '../engine/superiorAffixes';
import { AFFIX_VIEWS, AFFIX_VIEW_LABELS } from '../constants/affixes';
import type { ComboOption } from '../components/ComboPicker';
import { AffixCard } from '../components/AffixCard';
import { AffixFilters } from '../components/AffixFilters';
import { AffixList } from '../components/AffixList';
import { AffixRollPanel } from '../components/AffixRollPanel';
import { AffixRollResults } from '../components/AffixRollResults';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { SuperiorAffixesView } from '../components/SuperiorAffixesView';
import { useGameData } from '../hooks/useGameData';
import { useAffixesUrlState } from '../hooks/useAffixesUrlState';
import { selectAffixFilters, setAffixView } from '../store/gameDataSlice';
import { affixTypeCodes, filterAffixes } from '../utils/filterAffixes';

const AFFIXES_FILES = ['types', 'bases', 'affixes'] as const;

export function AffixesScreen() {
  const gameData = useGameData(AFFIXES_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return (
    <AffixesBrowser
      typesBundle={gameData.data.types}
      bases={gameData.data.bases.bases}
      superior={readSuperiorAffixes(gameData.data.bases)}
      affixes={gameData.data.affixes.affixes}
    />
  );
}

interface AffixesBrowserProps {
  readonly typesBundle: TypesBundle;
  readonly bases: readonly BaseItem[];
  /** null for a bases bundle without the superior keys (the view is then hidden) */
  readonly superior: SuperiorAffixes | null;
  readonly affixes: readonly Affix[];
}

function baseOptions(bases: readonly BaseItem[], typeNames: ReadonlyMap<string, string>): ComboOption[] {
  return [...bases]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((base) => {
      const typeName = typeNames.get(base.type) ?? base.type;
      return {
        id: base.code,
        label: base.name,
        detail: `${typeName} · ${base.code} · qlvl ${String(base.qlvl)}`,
        search: `${base.name} ${typeName} ${base.code}`.toLowerCase(),
      };
    });
}

function AffixesBrowser({ typesBundle, bases, superior, affixes }: AffixesBrowserProps) {
  const dispatch = useDispatch();
  const filters = useSelector(selectAffixFilters);
  const { types, classes } = typesBundle;

  const typeNames = new Map(types.map((type) => [type.code, type.name]));
  const classNames = new Map<string, string>(classes.map((cls) => [cls.code, cls.name]));
  const baseByCode = new Map(bases.map((base) => [base.code, base]));
  const knownTypes = new Set(typeNames.keys());
  const knownBases = new Set(baseByCode.keys());
  const getShareUrl = useAffixesUrlState(knownTypes, knownBases);

  const typeOptions = affixTypeCodes(affixes)
    .map((code) => ({ code, name: typeNames.get(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const base = filters.base === null ? undefined : baseByCode.get(filters.base);
  const eligible =
    base === undefined
      ? null
      : eligibleAffixes({
          affixes,
          base,
          ancestors: base.ancestors,
          ilvl: filters.ilvl,
          quality: filters.quality,
          includeAutomagic: filters.includeAutomagic,
        });

  const viewTabs = superior !== null && (
    <ToolbarCard className="mb-4">
      <nav className="flex flex-wrap gap-1" aria-label="Affix lists">
        {AFFIX_VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={filters.view === view}
            onClick={() => dispatch(setAffixView(view))}
            className={cn(SUBTAB_BASE, filters.view === view ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)}
          >
            {AFFIX_VIEW_LABELS[view]}
          </button>
        ))}
      </nav>
    </ToolbarCard>
  );

  if (superior !== null && filters.view === 'superior') {
    return (
      <div>
        {viewTabs}
        <SuperiorAffixesView superior={superior} typeNames={typeNames} getShareUrl={getShareUrl} />
      </div>
    );
  }

  return (
    <div>
      {viewTabs}
      <AffixRollPanel baseOptions={baseOptions(bases, typeNames)} base={base} alvl={eligible?.alvl ?? null} />
      <AffixFilters classes={classes} typeOptions={typeOptions} rollMode={base !== undefined} getShareUrl={getShareUrl} />

      {base !== undefined && eligible !== null ? (
        <AffixRollResults base={base} eligible={eligible} filters={filters} typeNames={typeNames} classNames={classNames} />
      ) : (
        <BrowseResults affixes={affixes} typeNames={typeNames} classNames={classNames} />
      )}
    </div>
  );
}

interface BrowseResultsProps {
  readonly affixes: readonly Affix[];
  readonly typeNames: ReadonlyMap<string, string>;
  readonly classNames: ReadonlyMap<string, string>;
}

function BrowseResults({ affixes, typeNames, classNames }: BrowseResultsProps) {
  const filters = useSelector(selectAffixFilters);
  const filtered = filterAffixes(affixes, filters);

  return (
    <>
      <ResultsBar summary={`Showing ${String(filtered.length)} of ${String(affixes.length)} affixes`} />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No affixes found. Try adjusting your filters.</p>
      ) : (
        <AffixList
          // Re-mount (and reset "Show more") whenever the filters change
          key={JSON.stringify(filters)}
          items={filtered}
          render={(visible) => (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7 gap-4">
              {visible.map((affix) => (
                <div key={`${affix.kind}-${String(affix.id)}`} className="card-visibility-auto">
                  <AffixCard affix={affix} typeNames={typeNames} classNames={classNames} />
                </div>
              ))}
            </div>
          )}
        />
      )}
    </>
  );
}
