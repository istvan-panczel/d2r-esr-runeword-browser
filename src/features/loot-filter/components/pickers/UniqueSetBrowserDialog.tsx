import { useId, useState } from 'react';
import { useSelector } from 'react-redux';
import { LayoutGrid, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { selectEditor } from '../../store/selectors';
import {
  allCodes,
  applyBrowserSelection,
  filterBrowser,
  initialBrowserSelection,
  toggleCodes,
  type BrowserGroup,
} from '../../utils/browserModel';
import { ambiguousIds, getUniqueBrowserModel, type SharedId, type UniqueBrowserModel } from '../../utils/uniqueBrowser';
import { BrowserGroupSection, type ToggleCodes } from './BrowserGroups';
import { BrowserTabs, type BrowserTab } from './BrowserTabs';

// `lootfilter` and `types` are the bundles the picker already loads (one cached request per file).
const BUNDLES = ['bases', 'types', 'lootfilter', 'tiers'] as const;

type UniqueSetTab = 'uniques' | 'sets';

const TABS: readonly BrowserTab<UniqueSetTab>[] = [
  { value: 'uniques', label: 'Uniques', noun: 'uniques' },
  { value: 'sets', label: 'Sets', noun: 'set items' },
];

/** How many shared ids the warning names before "and N more". */
const NAMED_SHARED_IDS = 3;

/** The quality condition of the rule being edited (the picker only appears in the editor of the selected rule). */
function useSelectedRuleQuality() {
  return useSelector((state: Parameters<typeof selectEditor>[0]) => {
    const editor = selectEditor(state);
    return editor.selectedRule === null ? undefined : editor.filter?.rules[editor.selectedRule]?.quality;
  });
}

function SharedIdWarning({ shared }: { readonly shared: readonly SharedId[] }) {
  if (shared.length === 0) return null;
  const more = shared.length - NAMED_SHARED_IDS;
  return (
    <p role="status" className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        {shared
          .slice(0, NAMED_SHARED_IDS)
          .map((entry) => `id ${entry.id} is both unique ${entry.unique} and set item ${entry.set}`)
          .join('; ')}
        {more > 0 && `; ${String(more)} more ticked ${more === 1 ? 'id is' : 'ids are'} in both tables`}; set the rule’s quality to unique
        or set.
      </span>
    </p>
  );
}

interface UniqueSetBrowserProps {
  readonly values: readonly number[];
  readonly onChange: (ids: readonly number[]) => void;
}

const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

interface FormProps {
  readonly model: UniqueBrowserModel;
  readonly values: readonly number[];
  readonly onApply: (ids: readonly number[]) => void;
  readonly onCancel: () => void;
}

function UniqueSetBrowserForm({ model, values, onApply, onCancel }: FormProps) {
  const idPrefix = useId();
  const quality = useSelectedRuleQuality();
  const valueKeys = values.map(String);
  // One draft for both tabs: the ids are one id space, so a ticked id is ticked on both tabs.
  const [draft, setDraft] = useState(() => initialBrowserSelection(valueKeys, model.codes));
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<UniqueSetTab>('uniques');
  const searching = query.trim() !== '';
  const filtered: Record<UniqueSetTab, readonly BrowserGroup[]> = {
    uniques: filterBrowser(model.uniques.groups, query),
    sets: filterBrowser(model.sets.groups, query),
  };
  const groups = filtered[tab];
  const noun = TABS.find((option) => option.value === tab)?.noun ?? 'items';

  const toggle: ToggleCodes = (codes, on) => {
    setDraft((current) => toggleCodes(current, codes, on));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 pb-3 sm:px-6">
        <BrowserTabs
          tabs={TABS}
          label="Unique or set"
          tab={tab}
          onChange={setTab}
          idPrefix={idPrefix}
          counts={searching ? { uniques: allCodes(filtered.uniques).length, sets: allCodes(filtered.sets).length } : null}
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Filter by name, base, set, type or id…"
          aria-label="Filter uniques and set items"
          className="h-8 min-w-0 flex-1 basis-56"
        />
        <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {draft.size} selected
        </span>
      </div>
      <div
        id={`${idPrefix}-panel`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${tab}`}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6"
      >
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No {noun} match “{query.trim()}”.
          </p>
        ) : (
          groups.map((group) => <BrowserGroupSection key={group.label} group={group} selected={draft} onToggle={toggle} />)
        )}
      </div>
      <div className="space-y-2 border-t px-4 py-3 sm:px-6">
        {tab === 'uniques' && model.couponCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {model.couponCount} coupon uniques are not listed: they are cubed from Ancient Coupons and never drop. Add one by name or id
            with “Add unique or set item”; ids already in the rule stay on Apply.
          </p>
        )}
        <SharedIdWarning shared={ambiguousIds(draft, model.shared, quality)} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(applyBrowserSelection(valueKeys, model.codes, draft).map(Number));
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}

function UniqueSetBrowserBody({ values, onApply, onCancel }: Omit<FormProps, 'model'>) {
  const gameData = useGameData(BUNDLES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') {
    return (
      <div className="overflow-y-auto px-4 pb-4 sm:px-6">
        <GameDataError error={gameData.error} onRetry={gameData.retry} />
      </div>
    );
  }
  const { lootfilter, types, bases, tiers } = gameData.data;
  return (
    <UniqueSetBrowserForm
      model={getUniqueBrowserModel(lootfilter, types, bases, tiers)}
      values={values}
      onApply={onApply}
      onCancel={onCancel}
    />
  );
}

/**
 * "Browse uniques and sets…": two tabs with checkboxes. Uniques: by the base's type group and item type, tiered bases as
 * Normal | Exceptional | Elite columns by required level, mythical bases below. Sets: one block per set. Both tabs edit
 * one draft of row ids (a unique and a set item can share an id; the footer warns while the rule's quality does not
 * tell them apart); Apply hands the picker its ids with the browser's ids replaced.
 */
export function UniqueSetBrowserDialog({ values, onChange }: UniqueSetBrowserProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
          <LayoutGrid className="size-3.5" aria-hidden />
          Browse uniques and sets…
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="px-4 pt-4 pb-3 pr-12 sm:px-6 sm:pr-12">
          <DialogTitle>Browse uniques and sets</DialogTitle>
          <DialogDescription>
            Tick uniques by base type and tier, or set items by set, then Apply. Rows with the same name and base are one entry (ticking it
            adds every row id). Unique and set item ids overlap: id 12 matches both the unique and the set item with that id unless the
            rule’s quality picks one.
          </DialogDescription>
        </DialogHeader>
        {/* The content unmounts on close, so every opening starts a fresh draft from the picker's values. */}
        <UniqueSetBrowserBody
          values={values}
          onApply={(ids) => {
            if (!sameList(ids, values)) onChange(ids);
            setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
