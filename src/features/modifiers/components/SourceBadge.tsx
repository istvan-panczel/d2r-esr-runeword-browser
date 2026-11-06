import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { SourceTag } from '../utils/modifierContent';
import { SOURCE_KINDS } from '../utils/sourceKinds';

interface SourceBadgeProps {
  readonly tag: SourceTag;
  /** The badge label (fact tables, legend) instead of the short inline one */
  readonly long?: boolean;
  /** A tag with a detail is a button that opens it (touch has no hover); off inside links */
  readonly details?: boolean;
  readonly className?: string;
}

/**
 * A claim's source: short inline, the full meaning and the detail ("D2MOO SUnitDmg.cpp:…") on hover, and for a tag
 * with a detail also in a popover on click or tap.
 */
export function SourceBadge({ tag, long = false, details = false, className }: SourceBadgeProps) {
  const kind = SOURCE_KINDS[tag.kind];
  const version = tag.version === undefined ? '' : ` ${tag.version}`;
  const label = long ? kind.label : `${kind.short}${version}`;
  const meaning = kind.full + (tag.version === undefined ? '' : ` (ESR ${tag.version})`);
  const title = [meaning, tag.detail].filter((part) => part !== undefined).join('. ');
  const classes = cn(
    'mx-0.5 inline-block rounded border px-1 py-px align-baseline text-[0.68rem] leading-tight font-medium whitespace-nowrap',
    long && 'whitespace-normal',
    kind.className,
    className
  );

  if (!details || tag.detail === undefined) {
    return (
      <span title={title} className={classes}>
        {label}
        <span className="sr-only">{` (source: ${title})`}</span>
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" title={title} className={cn(classes, 'cursor-pointer underline decoration-dotted underline-offset-2')}>
          {label}
          <span className="sr-only">{` (source: ${meaning}; show the detail)`}</span>
        </button>
      </PopoverTrigger>
      {/* collisionPadding: on a phone the popover keeps a 16px gutter instead of sitting flush at the screen edge */}
      <PopoverContent side="top" collisionPadding={16} className="w-auto max-w-[min(20rem,calc(100vw-2rem))] space-y-0.5 p-2 text-xs">
        <p className="font-medium">{meaning}</p>
        <p className="font-mono break-words text-muted-foreground">{tag.detail}</p>
      </PopoverContent>
    </Popover>
  );
}
