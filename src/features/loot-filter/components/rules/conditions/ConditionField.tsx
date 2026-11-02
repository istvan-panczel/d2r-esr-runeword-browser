import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConditionFieldProps {
  /** Base id; the label gets `${id}-label` and labels the group, the hint `${id}-hint` and describes it. */
  readonly id: string;
  readonly label: string;
  /** One line from the guide. */
  readonly hint?: string;
  /** The file had a wrong-shaped value for this key (kept in passthrough until the field is edited). */
  readonly invalid?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** A labelled condition control with a one-line hint. */
export function ConditionField({ id, label, hint, invalid = false, className, children }: ConditionFieldProps) {
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hint === undefined ? undefined : hintId}
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
    >
      <span id={labelId} className="text-sm leading-none font-medium">
        {label}
      </span>
      {children}
      {invalid && (
        <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert className="size-3" aria-hidden />
          The file&apos;s value has the wrong shape, so the plugin most likely switches the whole rule off (not verified; the Test tab skips
          it). It is kept until you set this field (see the JSON tab).
        </p>
      )}
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

interface ConditionSectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

/** A small heading over a group of fields. */
export function ConditionSection({ title, children, className }: ConditionSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="border-b pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>
    </section>
  );
}
