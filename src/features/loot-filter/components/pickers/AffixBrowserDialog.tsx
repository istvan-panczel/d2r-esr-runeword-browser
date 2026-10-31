import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { cn } from '@/lib/utils';
import type { StatCheck } from '../../engine/types';
import {
  affixKindCounts,
  affixMatches,
  affixText,
  applyAffixSelection,
  filterAffixBrowser,
  getAffixBrowserModel,
  initialAffixSelection,
  type AffixBrowserModel,
  type AffixBrowserRow,
} from '../../utils/affixBrowser';

const BUNDLES = ['affixes'] as const;

/** Affix names shown before "+N more". */
const SHOWN_AFFIXES = 8;

/**
 * Which stat list the browser edits and how: `itemStats` (all of) or `itemStatsAnyOf` (any of) with presence checks,
 * or a hide rule's exceptions with inverted checks (`except-any` into `itemStats`, `except-all` into `itemStatsAnyOf`).
 */
export type AffixBrowserMode = 'all' | 'any' | 'except-any' | 'except-all';

const isInverted = (mode: AffixBrowserMode) => mode === 'except-any' || mode === 'except-all';

const FOOTER_NOTES: Readonly<Record<AffixBrowserMode, string | undefined>> = {
  all: undefined,
  any: 'An item matches when ANY ticked stat is present; a hybrid affix gives all its stats, tick them in the all-of list to require both.',
  'except-any': 'Ticked stats are written as “less than 1” checks into Item stats, all of: the rule hides only items with none of them.',
  'except-all': 'Ticked stats are written as “less than 1” checks into Item stats, any of: the rule keeps only items with all of them.',
};

type StatChecks = readonly StatCheck[] | undefined;

interface AffixStatRowProps {
  readonly row: AffixBrowserRow;
  readonly checked: boolean;
  readonly onToggle: (on: boolean) => void;
  readonly query: string;
}

function AffixStatRow({ row, checked, onToggle, query }: AffixStatRowProps) {
  const [expanded, setExpanded] = useState(false);
  const matched = row.affixes.map((affix) => query.trim() !== '' && affixMatches(affix, query));
  // A search that found an affix past the first few shows the whole list, so the match is visible.
  const open = expanded || matched.slice(SHOWN_AFFIXES).some(Boolean);
  const shown = open ? row.affixes : row.affixes.slice(0, SHOWN_AFFIXES);
  const hidden = row.affixes.length - SHOWN_AFFIXES;
  return (
    <li className="py-1.5">
      <label className="flex cursor-pointer items-baseline gap-2">
        <input
          type="checkbox"
          className="size-4 shrink-0 translate-y-0.5 accent-primary"
          checked={checked}
          onChange={(event) => {
            onToggle(event.target.checked);
          }}
        />
        <span className="text-sm font-medium">{row.label}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{row.name}</span>
      </label>
      {row.note !== undefined && <p className="pl-6 text-xs text-amber-700 dark:text-amber-400">{row.note}</p>}
      <p className="pl-6 text-xs text-muted-foreground">
        {shown.map((affix, index) => (
          <span key={`${affix.kind}|${affix.name}|${affix.hybridWith.join('|')}`}>
            {index > 0 && ', '}
            <span className={cn(matched[index] && 'font-medium text-foreground')}>{affixText(affix)}</span>
          </span>
        ))}
        {!open && hidden > 0 && '…'} ({affixKindCounts(row.affixes)})
        {hidden > 0 && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ml-1 h-auto p-0 text-xs"
            aria-expanded={open}
            onClick={() => {
              setExpanded(!open);
            }}
          >
            {open ? 'Show less' : `+${String(hidden)} more`}
          </Button>
        )}
      </p>
    </li>
  );
}

interface AffixBrowserFormProps {
  readonly model: AffixBrowserModel;
  readonly mode: AffixBrowserMode;
  readonly value: StatChecks;
  readonly onApply: (value: StatChecks) => void;
  readonly onCancel: () => void;
}

function AffixBrowserForm({ model, mode, value, onApply, onCancel }: AffixBrowserFormProps) {
  const inverted = isInverted(mode);
  const footerNote = FOOTER_NOTES[mode];
  const [draft, setDraft] = useState(() => initialAffixSelection(value, model, inverted));
  const [query, setQuery] = useState('');
  const rows = filterAffixBrowser(model.rows, query);

  const toggle = (id: number, on: boolean) => {
    setDraft((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 pb-3 sm:px-6">
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Filter by affix, stat or id…"
          aria-label="Filter stats and affixes"
          className="h-8 min-w-0 flex-1 basis-56"
        />
        <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {draft.size} {draft.size === 1 ? 'stat' : 'stats'} selected
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-6">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No stats or affixes match “{query.trim()}”.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <AffixStatRow
                key={row.id}
                row={row}
                checked={draft.has(row.id)}
                query={query}
                onToggle={(on) => {
                  toggle(row.id, on);
                }}
              />
            ))}
          </ul>
        )}
      </div>
      <DialogFooter className="items-center border-t px-4 py-3 sm:px-6">
        {footerNote !== undefined && <p className="mr-auto text-xs text-muted-foreground">{footerNote}</p>}
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            onApply(applyAffixSelection(value, model, draft, inverted));
          }}
        >
          Apply
        </Button>
      </DialogFooter>
    </>
  );
}

function AffixBrowserBody(props: Omit<AffixBrowserFormProps, 'model'>) {
  const gameData = useGameData(BUNDLES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') {
    return (
      <div className="overflow-y-auto px-4 pb-4 sm:px-6">
        <GameDataError error={gameData.error} onRetry={gameData.retry} />
      </div>
    );
  }
  return <AffixBrowserForm model={getAffixBrowserModel(gameData.data.affixes)} {...props} />;
}

interface AffixBrowserDialogProps {
  readonly mode: AffixBrowserMode;
  readonly value: StatChecks;
  /** Called only when Apply changes the list. */
  readonly onChange: (value: StatChecks) => void;
}

/**
 * "Browse affixes…": the item stats magic affixes write, each with the affixes that write it, as checkboxes. The draft
 * starts from the stats that already have a check; Apply keeps those checks as they are, removes unticked ones and
 * appends `>= 1` checks for new ticks (see `applyAffixSelection`).
 */
export function AffixBrowserDialog({ mode, value, onChange }: AffixBrowserDialogProps) {
  const [open, setOpen] = useState(false);
  const inverted = isInverted(mode);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
          <ListChecks className="size-3.5" aria-hidden />
          {inverted ? 'Browse affixes for exceptions…' : 'Browse affixes…'}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="px-4 pt-4 pb-3 pr-12 sm:px-6 sm:pr-12">
          <DialogTitle>{inverted ? 'Browse affixes: except items with…' : 'Browse affixes'}</DialogTitle>
          <DialogDescription>
            {inverted
              ? 'The game checks item stats, not affix names. Tick the stats whose items this hide rule should keep, then Apply: each one is written as the opposite check, “less than 1”; set the number afterwards. Prefix and suffix values add up on one item.'
              : 'The game checks item stats, not affix names. Find an affix (Cruel, of Mastery…), tick the stat it gives, then Apply: new checks are “at least 1”; set the number afterwards. Prefix and suffix values add up on one item.'}
          </DialogDescription>
        </DialogHeader>
        {/* The content unmounts on close, so every opening starts a fresh draft from the list. */}
        <AffixBrowserBody
          mode={mode}
          value={value}
          onApply={(next) => {
            if (next !== value) onChange(next);
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
