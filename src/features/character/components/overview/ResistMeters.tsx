import { useState } from 'react';
import { ArrowDown, Check, ChevronsUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIFFICULTY_NAMES } from '../../engine/sheet/statLabels';
import type { DifficultyIndex } from '../../parser/types';
import { RESIST_SCALE, type ResistReadout, type ResistState } from '../../engine/sheetView';
import { SheetCard, SourcesPopover, StatusMark, ValueText, type ItemNamer } from './SheetParts';

/**
 * Status colours (dataviz reference status palette: good / warning / critical, the same in both themes). A colour never
 * carries the state alone: every row has the icon and the words ("At the cap", "11 below the cap").
 */
const STATE_STYLE: Readonly<Record<ResistState, { readonly icon: LucideIcon; readonly fill: string; readonly text: string }>> = {
  over: { icon: ChevronsUp, fill: 'bg-[#0ca30c]', text: 'text-emerald-700 dark:text-emerald-400' },
  at: { icon: Check, fill: 'bg-[#0ca30c]', text: 'text-emerald-700 dark:text-emerald-400' },
  below: { icon: ArrowDown, fill: 'bg-[#fab219]', text: 'text-amber-700 dark:text-amber-400' },
  negative: { icon: TriangleAlert, fill: 'bg-[#d03b3b]', text: 'text-red-700 dark:text-red-400' },
};

const DIFFICULTIES: readonly DifficultyIndex[] = [0, 1, 2];
const percentOf = (value: number) => `${String((Math.max(0, Math.min(value, RESIST_SCALE)) / RESIST_SCALE) * 100)}%`;

/** One resist: the shown value as a bar from 0, a tick at its cap, the gap up to the cap dashed, the surplus as text */
function ResistMeter({ readout }: { readonly readout: ResistReadout }) {
  const style = STATE_STYLE[readout.state];
  const shown = Math.max(0, readout.shown);
  return (
    <span className="relative block h-2 rounded-full bg-muted" aria-hidden>
      {readout.state !== 'negative' && (
        <span className={cn('absolute inset-y-0 left-0 rounded-full', style.fill)} style={{ width: percentOf(shown) }} />
      )}
      {(readout.state === 'below' || readout.state === 'negative') && (
        <span
          className="absolute inset-y-0 rounded-r-full border border-dashed border-[#fab219]/80 border-l-0"
          style={{ left: percentOf(shown), width: `calc(${percentOf(readout.cap)} - ${percentOf(shown)})` }}
        />
      )}
      <span className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/70" style={{ left: `calc(${percentOf(readout.cap)} - 1px)` }} />
    </span>
  );
}

function ResistRow({
  readout,
  itemName,
  showSums,
}: {
  readonly readout: ResistReadout;
  readonly itemName: ItemNamer;
  readonly showSums: boolean;
}) {
  const style = STATE_STYLE[readout.state];
  const Icon = style.icon;
  const text = `${String(readout.shown).replace('-', '−')}%`;
  return (
    <SourcesPopover
      title={`${readout.label} resistance`}
      text={text}
      value={readout.value}
      unbuffedText={readout.unbuffedText}
      itemName={itemName}
      extra={<p className="border-t pt-2 text-xs text-muted-foreground">{readout.detailText}.</p>}
      className="px-1.5 py-1"
    >
      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 @md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
        <span className="text-sm text-muted-foreground group-hover:text-foreground">{readout.label}</span>
        <span className="col-span-2 row-start-2 @md:col-span-1 @md:col-start-2 @md:row-start-1">
          <ResistMeter readout={readout} />
        </span>
        <span className="flex items-baseline justify-end gap-1.5 text-base font-semibold @md:col-start-3">
          <ValueText text={text} unbuffedText={readout.unbuffedText} />
          <StatusMark status={readout.value.status} className="self-center" />
        </span>
        <span className={cn('col-span-2 flex items-center gap-1 text-xs @md:col-span-3', style.text)}>
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span>
            {readout.stateText}
            <span className="text-muted-foreground"> (cap {readout.cap})</span>
          </span>
          {showSums && <span className="ml-auto text-muted-foreground tabular-nums">{readout.detailText}</span>}
        </span>
      </span>
    </SourcesPopover>
  );
}

interface ResistMetersProps {
  readonly readouts: readonly ResistReadout[];
  readonly difficulty: DifficultyIndex;
  readonly saveDifficulty: DifficultyIndex;
  readonly onDifficulty: (difficulty: DifficultyIndex) => void;
  readonly itemName: ItemNamer;
}

/** The six resistances against their caps, for the chosen difficulty (default: the one the save is in) */
export function ResistMeters({ readouts, difficulty, saveDifficulty, onDifficulty, itemName }: ResistMetersProps) {
  const [showSums, setShowSums] = useState(false);
  return (
    <SheetCard
      id="character-resists"
      title="Resistances"
      className="@container"
      actions={
        <div role="group" aria-label="Difficulty of the resist penalty" className="inline-flex rounded-md border bg-muted/40 p-0.5">
          {DIFFICULTIES.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={difficulty === entry}
              title={entry === saveDifficulty ? 'The difficulty the save is in' : undefined}
              className={cn(
                'rounded px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                difficulty === entry ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                onDifficulty(entry);
              }}
            >
              {DIFFICULTY_NAMES[entry]}
              {entry === saveDifficulty && <span className="sr-only"> (the save&apos;s difficulty)</span>}
              {entry === saveDifficulty && (
                <span aria-hidden className="ml-0.5">
                  *
                </span>
              )}
            </button>
          ))}
        </div>
      }
    >
      <ul className="-mx-1.5 space-y-0.5">
        {readouts.map((readout) => (
          <li key={readout.key}>
            <ResistRow readout={readout} itemName={itemName} showSums={showSums} />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>* the save&apos;s difficulty. The bar runs from 0 to {RESIST_SCALE}; the tick is the cap.</span>
        <button
          type="button"
          aria-pressed={showSums}
          className="rounded font-medium text-primary underline decoration-primary/40 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setShowSums((value) => !value);
          }}
        >
          {showSums ? 'Hide the sums' : 'Show sum, penalty and cap'}
        </button>
      </div>
    </SheetCard>
  );
}
