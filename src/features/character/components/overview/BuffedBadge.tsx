import { FlaskConical, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The marker on every view that shows buffed numbers (Overview, Combat): they are not yet checked in game */
export function BuffedBadge({ className }: { readonly className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-amber-600/50 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300',
        className
      )}
      data-testid="buffed-badge"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      Includes buffs: not yet checked in game
    </span>
  );
}

/** The plain unbuffed label */
export function UnbuffedBadge({ className }: { readonly className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground',
        className
      )}
    >
      Unbuffed
    </span>
  );
}

/** The marker on every view whose numbers include what-if entries: not the character's real numbers */
export function WhatIfBadge({ className }: { readonly className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-violet-600/50 bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-800 dark:text-violet-300',
        className
      )}
      data-testid="what-if-badge"
    >
      <Lightbulb className="size-3.5 shrink-0" aria-hidden />
      Includes what-if entries: not your real numbers
    </span>
  );
}

/** The sheet's state as badges: Unbuffed or Includes buffs, and Includes what-if entries (Overview, Skills, Combat) */
export function SheetStateBadges({ buffed, whatIf }: { readonly buffed: boolean; readonly whatIf: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {buffed ? <BuffedBadge /> : <UnbuffedBadge />}
      {whatIf && <WhatIfBadge />}
    </span>
  );
}
