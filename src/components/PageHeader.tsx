import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  readonly title: string;
  /** Optional right-aligned content (e.g. an action button). */
  readonly action?: ReactNode;
  readonly className?: string;
}

/** A consistent page title row with an optional trailing action. */
export function PageHeader({ title, action, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3', className)}>
      <h1 className="text-2xl font-bold">{title}</h1>
      {action}
    </div>
  );
}
