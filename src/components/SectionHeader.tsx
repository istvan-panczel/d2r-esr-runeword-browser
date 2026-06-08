import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  readonly title: string;
  readonly icon?: LucideIcon;
  /** Optional right-aligned content (e.g. an action button or badge). */
  readonly action?: ReactNode;
  readonly className?: string;
}

/** A consistent section heading: optional icon + title with a hairline rule below. */
export function SectionHeader({ title, icon: Icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-2 border-b pb-2', className)}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {Icon && <Icon className="size-5 text-muted-foreground" aria-hidden />}
        <span>{title}</span>
      </h2>
      {action}
    </div>
  );
}
