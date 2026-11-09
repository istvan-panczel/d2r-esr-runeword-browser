import { Link, useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { ExactNameChip } from '@/core/components/ExactNameChip';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { useGuide } from '@/features/guide/hooks/useGuide';
import { cn } from '@/lib/utils';
import type { MaterialsBundle } from '../engine/schema';
import { EnhanceSearch, Pills } from '../components/EnhanceParts';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { MaterialRow } from '../components/MaterialRow';
import { LIST_CARD_CLASS, LIST_CARD_HEADER_CLASS, LIST_CARD_SUBHEAD_CLASS, ROW_LIST_COLUMNS } from '../components/rowListColumns';
import { useGameData } from '../hooks/useGameData';
import { formatCount } from '../utils/cube';
import {
  buildMaterialsTree,
  encodeMaterialsState,
  filterMaterialsTree,
  itemCount,
  itemGuideNotes,
  readMaterialsState,
  type GuideNoteIndex,
  type MaterialsState,
} from '../utils/materials';

const MATERIALS_FILES = ['materials'] as const;
const MATERIALS_ROUTE = 'game-data/materials';
const SEARCH_DEBOUNCE_MS = 300;
const ALL_GROUPS = '';

export function MaterialsScreen() {
  const gameData = useGameData(MATERIALS_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return <MaterialsBrowser bundle={gameData.data.materials} />;
}

/** The page state lives in the URL (search, group, exact name), so links and the back button keep it. */
function MaterialsBrowser({ bundle }: { readonly bundle: MaterialsBundle }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readMaterialsState(searchParams, bundle);
  // The guide notes are a bonus: the page works without the guide bundle (loading or failed)
  const guide = useGuide();
  const notesIndex: GuideNoteIndex | null = guide.status === 'ready' ? guide.data.bundle : null;
  const titles = new Map(guide.status === 'ready' ? guide.data.bundle.notes.map((note) => [note.slug, note.title]) : []);
  const knownNotes = new Set(titles.keys());

  const update = (patch: Partial<MaterialsState>, replace = true) => {
    setSearchParams(encodeMaterialsState({ ...state, ...patch }), { replace });
  };

  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );

  const labels = new Map(bundle.families.map((family) => [family.id, family.label]));
  const familyLabel = (id: string) => labels.get(id) ?? id;
  const tree = buildMaterialsTree(bundle);
  const shown = filterMaterialsTree(tree, state, familyLabel);
  const getShareUrl = () => buildShareUrl(MATERIALS_ROUTE, encodeMaterialsState({ ...state, search }));
  const shownItems = shown.reduce((sum, view) => sum + itemCount(view), 0);
  const totalItems = tree.reduce((sum, view) => sum + itemCount(view), 0);
  const variants = bundle.items.reduce((sum, item) => sum + (item.variants ?? 1), 0);
  const groupOptions = [
    { value: ALL_GROUPS, label: 'All', count: bundle.items.length },
    ...tree.map((view) => ({ value: view.group.code, label: view.group.label, count: itemCount(view) })),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every rune, gem, organ, Dragon Stone, coupon, potion and other misc item from the game files ({formatCount(bundle.items.length)}{' '}
        rows for {formatCount(variants)} items; stockers, cans and coupons are folded together): where it comes from, which{' '}
        <Link to="/game-data/cube" className="font-medium text-primary underline decoration-primary/40 underline-offset-2">
          cube recipes
        </Link>{' '}
        use it and the guide notes about it. Sources are derived from the game files and may be incomplete.
      </p>

      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            value={search}
            onChange={setSearch}
            onClear={() => {
              commitSearch('');
            }}
            placeholder="Search items, sources or recipes..."
            hint="Search names, sources and recipe families;"
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
          <Pills
            label="Item groups"
            options={groupOptions}
            value={state.group ?? ALL_GROUPS}
            onChange={(value) => {
              update({ group: value === ALL_GROUPS ? null : value }, false);
            }}
          />
        )}
      </FilterPanel>

      <ResultsBar
        summary={`Showing ${formatCount(shownItems)} of ${formatCount(totalItems)} items`}
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
            update({ search: '', group: null, name: null }, false);
          }}
        />
      ) : (
        <div className="space-y-6">
          {shown.map((view) => (
            <section key={view.group.code} aria-labelledby={`materials-${view.group.code}`} className={LIST_CARD_CLASS}>
              <header className={LIST_CARD_HEADER_CLASS}>
                <h2 id={`materials-${view.group.code}`} className="flex items-baseline gap-2 text-lg font-semibold">
                  <span>{view.group.label}</span>
                  <span className="text-sm font-normal text-muted-foreground">{formatCount(itemCount(view))}</span>
                </h2>
              </header>
              <div className="divide-y">
                {view.blocks.map((block) => (
                  <div key={block.code}>
                    {view.blocks.length > 1 && <h3 className={LIST_CARD_SUBHEAD_CLASS}>{block.label}</h3>}
                    <ul className={cn('divide-y', ROW_LIST_COLUMNS)}>
                      {block.items.map((item) => (
                        <MaterialRow
                          key={item.code}
                          item={item}
                          familyLabel={familyLabel}
                          notes={itemGuideNotes(item, notesIndex, knownNotes).map((slug) => ({ slug, title: titles.get(slug) ?? slug }))}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onReset }: { readonly onReset: () => void }) {
  return (
    <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
      <p>No item matches.</p>
      <p>
        Try fewer words, or{' '}
        <button
          type="button"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          onClick={onReset}
        >
          show every item
        </button>
        .
      </p>
    </div>
  );
}
