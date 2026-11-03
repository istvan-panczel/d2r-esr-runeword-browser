import { cn } from '@/lib/utils';

export interface SummaryChip {
  readonly value: number | string;
  readonly label: string;
}

/** A row of number + label chips above a stash page's table ("217 kinds of coupon owned") */
export function SummaryChips({ chips, className }: { readonly chips: readonly SummaryChip[]; readonly className?: string }) {
  return (
    <ul className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', className)} aria-label="Summary">
      {chips.map((chip) => (
        <li key={chip.label} className="rounded-lg border bg-card px-3 py-2 shadow-sm">
          <span className="block text-lg font-semibold tabular-nums">{chip.value}</span>
          <span className="block text-xs text-muted-foreground">{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}
