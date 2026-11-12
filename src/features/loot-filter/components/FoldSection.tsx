import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labelRgba } from '../engine/colors';
import type { SummaryPart } from '../utils/editorGroups';

interface FoldSectionProps {
  /** On the group's wrapper, so script can move the focus to its header button (`:scope > h3 > button`). */
  readonly id?: string;
  readonly title: string;
  /** What the group sets, shown in the header while it is folded (`utils/editorGroups.ts`). */
  readonly summary: string | readonly SummaryPart[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * `action`: a ruled section of the actions editor (a bordered tile on wide pages); `condition`: a small uppercase
   * heading over a grid of condition fields.
   */
  readonly variant: 'action' | 'condition';
  /** The body's classes (a condition group's grid columns). */
  readonly className?: string;
  readonly children: ReactNode;
}

function Summary({ summary }: { readonly summary: string | readonly SummaryPart[] }) {
  if (typeof summary === 'string') return summary;
  return summary.map((part, index) => (
    <span key={part.text}>
      {index > 0 && ' · '}
      {part.swatch !== undefined && (
        <span
          className="mr-1 inline-block size-3 rounded-sm border border-foreground/30 align-[-0.1em]"
          style={{ background: labelRgba(part.swatch, 255) }}
          aria-hidden
        />
      )}
      {part.text}
    </span>
  ));
}

/**
 * A foldable group of the rule editor and the Styles tab, as a disclosure: a heading holding a button
 * (`aria-expanded`, `aria-controls` the panel), so screen readers keep the heading and announce a button (a heading
 * inside a `<summary>` is flattened into the summary's button). The open state is held by the caller
 * (`hooks/useGroupFolds.ts`). While folded, a one-line summary of what the group sets follows the title, inside the
 * button, so it is read with its name (up to two lines, then cut). At least 40 px high, for fingers.
 */
export function FoldSection({ id, title, summary, open, onOpenChange, variant, className, children }: FoldSectionProps) {
  const action = variant === 'action';
  const panelId = useId();
  return (
    <div
      id={id}
      data-open={open}
      className={cn(
        'group/fold min-w-0 border-t pt-1',
        action && 'first:border-t-0 first:pt-0 @8xl/page:rounded-lg @8xl/page:border @8xl/page:px-4 @8xl/page:py-1'
      )}
    >
      <h3 className="text-sm font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-10 w-full cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            onOpenChange(!open);
          }}
        >
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[open=true]/fold:rotate-90"
            aria-hidden
          />
          <span className="shrink-0">{title}</span>
          {!open && (
            // Up to two lines: a phone's narrow header would cut most summaries after a few words.
            <span className="line-clamp-2 min-w-0 py-1 text-xs font-normal text-muted-foreground">
              <span className="sr-only">: </span>
              <Summary summary={summary} />
            </span>
          )}
        </button>
      </h3>
      <div
        id={panelId}
        hidden={!open}
        className={cn(action ? 'flex flex-col gap-3 pt-1 pb-3' : 'grid gap-4 pt-1 pb-3 sm:grid-cols-2', className)}
      >
        {children}
      </div>
    </div>
  );
}
