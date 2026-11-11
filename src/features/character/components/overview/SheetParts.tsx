import { use, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { SheetStatus, SheetValue } from '../../engine/sheet/types';
import { STATUS_TEXT, sourceLines, type StatRow } from '../../engine/sheetView';
import { ShowItemContext } from './showItemContext';

/** Names a player item by its index (the sheet's item sources); null while the names load */
export type ItemNamer = (index: number) => string | null;

const MARK: Readonly<Record<Exclude<SheetStatus, 'verified'>, { readonly glyph: string; readonly className: string }>> = {
  inferred: { glyph: '≈', className: 'border-sky-600/50 text-sky-800 dark:text-sky-300' },
  unverified: { glyph: '?', className: 'border-amber-600/60 bg-amber-500/15 text-amber-800 dark:text-amber-300' },
};

/**
 * The small marker of a number that is not backed by the in-game screen: ≈ inferred, ? changed by a buff (not yet
 * checked in game). The glyph is decorative; the status is spoken as text.
 */
export function StatusMark({ status, className }: { readonly status: SheetStatus; readonly className?: string }) {
  if (status === 'verified') return null;
  const mark = MARK[status];
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} title={STATUS_TEXT[status].long}>
      <span
        aria-hidden
        className={cn(
          'inline-grid size-4 place-items-center rounded-full border text-[0.625rem] leading-none font-semibold',
          mark.className
        )}
      >
        {mark.glyph}
      </span>
      <span className="sr-only">({STATUS_TEXT[status].short})</span>
    </span>
  );
}

/** A number, with the unbuffed value struck through before it when a buff changed it */
export function ValueText({
  text,
  unbuffedText,
  className,
}: {
  readonly text: string;
  readonly unbuffedText: string | null;
  readonly className?: string;
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 tabular-nums', className)}>
      {unbuffedText !== null && (
        <span className="text-xs font-normal text-muted-foreground line-through decoration-muted-foreground/60">
          <span className="sr-only">unbuffed </span>
          {unbuffedText}
        </span>
      )}
      {unbuffedText !== null && <span className="sr-only">, with buffs </span>}
      <span>{text}</span>
    </span>
  );
}

interface SourcesBodyProps {
  readonly title: string;
  readonly text: string;
  readonly value: SheetValue;
  readonly unbuffedText: string | null;
  readonly itemName: ItemNamer;
  /** Extra lines under the sources (a resist's cap and penalty) */
  readonly extra?: ReactNode;
  /** Visible text beside the number the accessible name must carry too ("Over the cap by 57, cap 79") */
  readonly spoken?: string;
}

/** What the source popover shows: the number, its status, its sources adding up to it, the notes */
function SourcesBody({ title, text, value, unbuffedText, itemName, extra }: Omit<SourcesBodyProps, 'spoken'>) {
  const lines = sourceLines(value, itemName);
  const showItem = use(ShowItemContext);
  return (
    <div className="space-y-2">
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <ValueText text={text} unbuffedText={unbuffedText} className="font-semibold" />
      </p>
      {value.status !== 'verified' && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <StatusMark status={value.status} className="mt-px" />
          <span>{STATUS_TEXT[value.status].long}</span>
        </p>
      )}
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing adds to this number.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto text-xs" aria-label="Where it comes from">
          {lines.map((line) => (
            <li key={line.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                {showItem !== null && line.item !== null && line.where !== null ? (
                  <button
                    type="button"
                    className="rounded text-left text-foreground underline decoration-muted-foreground/50 underline-offset-2 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${line.label}: show on the Gear tab`}
                    onClick={() => {
                      if (line.item !== null) showItem(line.item);
                    }}
                  >
                    {line.label}
                  </button>
                ) : (
                  <span className="text-foreground">{line.label}</span>
                )}
                {line.where !== null && <span className="text-muted-foreground"> ({line.where})</span>}
                {line.where === null && <span className="block text-[0.6875rem] text-muted-foreground">{line.kind}</span>}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
      {extra}
      {value.notes !== undefined && value.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {value.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SourcesPopoverProps extends SourcesBodyProps {
  /** The trigger's content; the whole thing is one button */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * "Life 8,169: where it comes from (not yet checked in game, unbuffed 6,080)": the number, what the row says beside it
 * (a resist's state), its status and the unbuffed value
 */
function triggerLabel(title: string, text: string, status: SheetStatus, unbuffedText: string | null, spoken?: string): string {
  const extra = [
    spoken ?? null,
    status === 'verified' ? null : STATUS_TEXT[status].short.toLowerCase(),
    unbuffedText === null ? null : `unbuffed ${unbuffedText}`,
  ];
  const note = extra.filter((part) => part !== null).join(', ');
  return `${title} ${text}: where it comes from${note === '' ? '' : ` (${note})`}`;
}

/**
 * A number that opens where it comes from: a button (Enter / Space / tap) with a popover of its sources. Escape and an
 * outside click close it; focus returns to the button.
 */
export function SourcesPopover({ children, className, spoken, ...body }: SourcesPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel(body.title, body.text, body.value.status, body.unbuffedText, spoken)}
          className={cn(
            'group w-full rounded-md text-left transition-colors outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent/60',
            className
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-3 text-sm" aria-label={`${body.title}: where it comes from`}>
        <SourcesBody {...body} />
      </PopoverContent>
    </Popover>
  );
}

/** A two-column list of numbers, each opening its sources */
export function StatList({ rows, itemName }: { readonly rows: readonly StatRow[]; readonly itemName: ItemNamer }) {
  return (
    <ul className="-mx-1.5 text-sm">
      {rows.map((row) => (
        <li key={row.key}>
          <SourcesPopover title={row.label} text={row.text} value={row.value} unbuffedText={row.unbuffedText} itemName={itemName}>
            <span className="flex items-baseline justify-between gap-3 px-1.5 py-0.5">
              <span className="min-w-0 text-muted-foreground group-hover:text-foreground">{row.label}</span>
              <span className="flex items-baseline gap-1.5">
                <ValueText
                  text={row.text}
                  unbuffedText={row.unbuffedText}
                  className="underline decoration-muted-foreground/40 decoration-dotted underline-offset-4"
                />
                <StatusMark status={row.value.status} className="self-center" />
              </span>
            </span>
          </SourcesPopover>
        </li>
      ))}
    </ul>
  );
}

interface SheetCardProps {
  readonly id: string;
  readonly title: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** One card of the Overview's sheet */
export function SheetCard({ id, title, actions, children, className }: SheetCardProps) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-xl border bg-card p-4 shadow-sm', className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={id} className="font-semibold">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}
