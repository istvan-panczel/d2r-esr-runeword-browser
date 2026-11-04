import { useState } from 'react';
import { Check, ChevronsDownUp, ChevronsUpDown, Layers, Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { EquipmentSlot, ItemAlternative, ItemRef, WeaponSwapSlot } from '../buildData';
import type { CraftDataState } from '../hooks/useCraftData';
import { itemRefName } from '../utils/buildSnapshot';
import type { ItemDiff } from '../utils/itemDiff';
import { SlotCell } from './SlotCell';

const SMALL_BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none';

/** The first non-blank line of a note, for the alternatives list. */
function firstLine(note: string | undefined): string | undefined {
  return note
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

interface SlotAlternativesViewProps {
  readonly slot: EquipmentSlot | WeaponSwapSlot;
  /** The slot's main item and its note (the first entry of the list). */
  readonly mainItem: ItemRef | null;
  readonly mainNote: string | undefined;
  readonly alternatives: readonly ItemAlternative[];
  /** Index-aligned with `alternatives`; undefined while the diffs are not ready. */
  readonly alternativeDiffs: readonly ItemDiff[] | undefined;
  /** The alternative shown in place of the main item, or -1 for the main item. */
  readonly shownIndex: number;
  readonly onPick: (index: number) => void;
  readonly showAll: boolean;
  readonly onToggleShowAll: () => void;
  readonly craftData: CraftDataState;
  /** Set pieces an alternative's card counts under "Show all" (as if it were worn); absent for the weapon swap. */
  readonly setPiecesFor?: (ref: ItemRef) => number | undefined;
}

/**
 * The read-only footer of a slot with alternative items: "+N alternatives" opens a list to swap one in place of the
 * shown item (view only, never saved), and "Show all" stacks every alternative under the main item.
 */
export function SlotAlternativesView({
  slot,
  mainItem,
  mainNote,
  alternatives,
  alternativeDiffs,
  shownIndex,
  onPick,
  showAll,
  onToggleShowAll,
  craftData,
  setPiecesFor,
}: SlotAlternativesViewProps) {
  const [open, setOpen] = useState(false);
  const count = alternatives.length;
  const entries = [
    { key: 'main', index: -1, label: 'Main', name: mainItem !== null ? itemRefName(mainItem) : '—', note: firstLine(mainNote) },
    ...alternatives.map((alternative, index) => ({
      key: `alt-${String(index)}`,
      index,
      label: `Alt ${String(index + 1)}`,
      name: itemRefName(alternative.ref),
      note: firstLine(alternative.note),
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {!showAll && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={SMALL_BUTTON_CLASS}>
                <Layers className="size-3" />+{count} {count === 1 ? 'alternative' : 'alternatives'}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-1">
              <ul className="flex flex-col" aria-label="Items for this slot">
                {entries.map((entry) => {
                  const shown = entry.index === shownIndex;
                  return (
                    <li key={entry.key}>
                      <button
                        type="button"
                        aria-pressed={shown}
                        onClick={() => {
                          onPick(entry.index);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent',
                          shown && 'bg-accent/60'
                        )}
                      >
                        <Check className={cn('mt-0.5 size-4 shrink-0', shown ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">
                            <span className="mr-1.5 text-xs text-muted-foreground">{entry.label}</span>
                            {entry.name}
                          </span>
                          {entry.note !== undefined && <span className="truncate text-xs text-muted-foreground">{entry.note}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        )}
        <button type="button" aria-expanded={showAll} onClick={onToggleShowAll} className={SMALL_BUTTON_CLASS}>
          {showAll ? <ChevronsDownUp className="size-3" /> : <ChevronsUpDown className="size-3" />}
          {showAll ? 'Show less' : 'Show all'}
        </button>
      </div>

      {showAll && (
        <div className="flex flex-col gap-3 border-t border-dashed pt-2">
          {alternatives.map((alternative, index) => (
            <SlotCell
              key={`${String(index)}-${itemRefName(alternative.ref)}`}
              label={`Alternative ${String(index + 1)} of ${String(count)}`}
              slot={slot}
              item={alternative.ref}
              diff={alternativeDiffs?.[index]}
              note={alternative.note}
              crafts={alternative.crafts}
              craftData={craftData}
              setPieces={setPiecesFor?.(alternative.ref)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SlotAlternativeLabelProps {
  /** The alternative shown in place of the main item, or -1 for the main item. */
  readonly shownIndex: number;
  readonly count: number;
  readonly showAll: boolean;
  readonly onBackToMain: () => void;
}

/** The label row tag of a slot with alternatives: which alternative is shown, with a way back to the main item. */
export function SlotAlternativeLabel({ shownIndex, count, showAll, onBackToMain }: SlotAlternativeLabelProps) {
  if (showAll) return <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Main</span>;
  if (shownIndex < 0) return null;
  return (
    <span className="ml-auto inline-flex items-center gap-0.5">
      <span
        className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
        title={`Showing alternative ${String(shownIndex + 1)} of ${String(count)}`}
      >
        Alt {shownIndex + 1}/{count}
      </span>
      <button
        type="button"
        onClick={onBackToMain}
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Back to the main item"
        title="Back to main"
      >
        <Undo2 className="size-3" />
      </button>
    </span>
  );
}
