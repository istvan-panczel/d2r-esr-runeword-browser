import { cn } from '@/lib/utils';

export type BadgeTone = 'success' | 'info' | 'warning' | 'neutral';

const TONE_CLASS: Readonly<Record<BadgeTone, string>> = {
  success: 'border-emerald-600/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  info: 'border-sky-600/40 bg-sky-500/15 text-sky-800 dark:text-sky-300',
  warning: 'border-amber-600/40 bg-amber-500/15 text-amber-800 dark:text-amber-300',
  neutral: 'border-border bg-muted/50 text-muted-foreground',
};

/** A small rounded status badge in one of the stash pages' tones */
export function ToneBadge({ label, tone, className }: { readonly label: string; readonly tone: BadgeTone; readonly className?: string }) {
  return (
    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs whitespace-nowrap', TONE_CLASS[tone], className)}>
      {label}
    </span>
  );
}
