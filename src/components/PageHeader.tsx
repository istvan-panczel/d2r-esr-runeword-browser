import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  readonly title: ReactNode;
  /** Number of results, rendered right after the title as "Title (count)" */
  readonly count?: number;
  /** Right-aligned content of the title row (e.g. a "Create" button); wraps under the title on phones */
  readonly actions?: ReactNode;
  /** Subtitle or meta line(s) under the title */
  readonly meta?: ReactNode;
  readonly className?: string;
}

/**
 * The page title block: title (+ count), optional actions on the right, and an optional meta line.
 * Rendered by `PageShell`; use it directly only where a layout route already sets the page width.
 */
export function PageHeader({ title, count, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-4 space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold">
          {title}
          {count !== undefined && <span className="tabular-nums"> ({count})</span>}
        </h1>
        {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta !== undefined && <div className="text-sm text-muted-foreground">{meta}</div>}
    </div>
  );
}
