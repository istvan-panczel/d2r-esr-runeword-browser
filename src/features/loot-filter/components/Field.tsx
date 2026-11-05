import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
  /** The control's id (the label's `htmlFor`). */
  readonly id: string;
  readonly label: string;
  readonly hint?: ReactNode;
  /** A smaller label and tighter spacing, for the Test tab's dense forms. */
  readonly dense?: boolean;
  readonly className?: string;
  /** Shown after the label (the rule editor's "advanced" tag). */
  readonly badge?: ReactNode;
  readonly children: ReactNode;
}

/** A label above its control, with an optional hint underneath. */
export function Field({ id, label, hint, dense = false, className, badge, children }: FieldProps) {
  const labelElement = (
    <Label htmlFor={id} className={dense ? 'text-xs' : undefined}>
      {label}
    </Label>
  );
  return (
    <div className={cn('flex min-w-0 flex-col', dense ? 'gap-1' : 'gap-1.5', className)}>
      {badge === undefined ? (
        labelElement
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {labelElement}
          {badge}
        </div>
      )}
      {children}
      {hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface CheckFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Shown after the label (the rule editor's "advanced" tag). */
  readonly badge?: ReactNode;
}

/** A checkbox with its label and a hint beside it. */
export function CheckField({ id, label, hint, checked, onChange, badge }: CheckFieldProps) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => {
          onChange(value === true);
        }}
      />
      <div className="grid min-w-0 gap-1">
        {badge === undefined ? (
          <Label htmlFor={id}>{label}</Label>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {badge}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
