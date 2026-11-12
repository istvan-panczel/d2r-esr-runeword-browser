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
  /** Shown after the label (the Basic view's "advanced" tag on a set Advanced field). */
  readonly badge?: React.ReactNode;
  readonly children: React.ReactNode;
}

/** A labelled condition control with a one-line hint. */
export function ConditionField({ id, label, hint, invalid = false, className, badge, children }: ConditionFieldProps) {
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const labelElement = (
    <span id={labelId} className="text-sm leading-none font-medium">
      {label}
    </span>
  );
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hint === undefined ? undefined : hintId}
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
    >
      {badge === undefined ? (
        labelElement
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {labelElement}
          {badge}
        </div>
      )}
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
