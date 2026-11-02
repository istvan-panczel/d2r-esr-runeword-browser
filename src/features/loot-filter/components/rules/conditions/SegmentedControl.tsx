import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Not pickable now; `title` says why. */
  readonly disabled?: boolean;
  readonly title?: string;
}

interface SegmentedControlProps<T extends string> {
  /** undefined: none pressed. */
  readonly value: T | undefined;
  readonly options: readonly SegmentedOption<T>[];
  readonly onChange: (value: T) => void;
  readonly 'aria-label': string;
  readonly className?: string;
}

/** A row of toggle buttons where one is pressed (the mode of a match, any / yes / no…). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex rounded-md border bg-muted/40 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          title={option.title}
          className={cn(
            'rounded-sm px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            option.value === value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
