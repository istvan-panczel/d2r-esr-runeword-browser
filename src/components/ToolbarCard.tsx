import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ToolbarCardProps {
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * The card surface (`FilterPanel`'s look, compact padding) around a page's top controls: sub-tab rows (`SUBTAB_*`
 * classes), a search box, view toggles. The page title and intro stay outside it. Children are stacked with `space-y-3`.
 * A plain `div`: the controls inside name themselves (`nav aria-label`, `role="tablist"`, labelled inputs).
 */
export function ToolbarCard({ className, children }: ToolbarCardProps) {
  return <div className={cn('space-y-3 rounded-xl border bg-card p-2 shadow-sm sm:p-3', className)}>{children}</div>;
}
