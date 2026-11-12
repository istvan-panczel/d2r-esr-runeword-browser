import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labelRgba } from '../engine/colors';
import type { SummaryPart } from '../utils/editorGroups';

interface FoldSectionProps {
  /** On the `<details>`, so script can move the focus to its header. */
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
 * A foldable group of the rule editor and the Styles tab (native `<details>`, open state held by the caller). The
 * header is the summary element: the heading keeps its level, and while folded a one-line summary of what the group
 * sets follows it (read with the button's name). At least 40 px high, for fingers.
 */
export function FoldSection({ id, title, summary, open, onOpenChange, variant, className, children }: FoldSectionProps) {
  const action = variant === 'action';
  return (
    <details
      id={id}
      className={cn(
        'group/fold min-w-0',
        action && 'border-t pt-1 first:border-t-0 first:pt-0 @8xl/page:rounded-lg @8xl/page:border @8xl/page:px-4 @8xl/page:py-1'
      )}
      open={open}
      onToggle={(event) => {
        onOpenChange(event.currentTarget.open);
      }}
    >
      <summary
        className={cn(
          'flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden',
          !action && 'border-b'
        )}
      >
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open/fold:rotate-90" aria-hidden />
        <h3
          className={cn(
            'shrink-0',
            action ? 'text-sm font-semibold' : 'text-xs font-semibold tracking-wide text-muted-foreground uppercase'
          )}
        >
          {title}
        </h3>
        <span className="min-w-0 truncate text-xs text-muted-foreground group-open/fold:hidden">
          <span className="sr-only">: </span>
          <Summary summary={summary} />
        </span>
      </summary>
      <div className={cn(action ? 'flex flex-col gap-3 pt-1 pb-3' : 'grid gap-4 pt-3 sm:grid-cols-2', className)}>{children}</div>
    </details>
  );
}
