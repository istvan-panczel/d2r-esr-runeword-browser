import { FlaskConical } from 'lucide-react';
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
