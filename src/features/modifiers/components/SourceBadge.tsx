import { cn } from '@/lib/utils';
import type { SourceTag } from '../utils/modifierContent';
import { SOURCE_KINDS } from '../utils/sourceKinds';

interface SourceBadgeProps {
  readonly tag: SourceTag;
  /** The badge label (fact tables, legend) instead of the short inline one */
  readonly long?: boolean;
  readonly className?: string;
}

/** A claim's source: short inline, the full meaning and the detail ("D2MOO SUnitDmg.cpp:…") on hover */
export function SourceBadge({ tag, long = false, className }: SourceBadgeProps) {
  const kind = SOURCE_KINDS[tag.kind];
  const version = tag.version === undefined ? '' : ` ${tag.version}`;
  const label = long ? kind.label : `${kind.short}${version}`;
  const title = [kind.full + (tag.version === undefined ? '' : ` (ESR ${tag.version})`), tag.detail]
    .filter((part) => part !== undefined)
    .join('. ');
  return (
    <span
      title={title}
      className={cn(
        'mx-0.5 inline-block rounded border px-1 py-px align-baseline text-[0.68rem] leading-tight font-medium whitespace-nowrap',
        long && 'whitespace-normal',
        kind.className,
        className
      )}
    >
      {label}
      <span className="sr-only">{` (source: ${title})`}</span>
    </span>
  );
}
