import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface LevelInputProps {
  readonly id?: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onCommit: (value: number) => void;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/**
 * A pause in typing (or in holding a spinner arrow) after which a valid value is committed. The Skills page writes
 * every commit to the URL (`replaceState`), which browsers throttle (Safari throws after ~100 calls in 10 s).
 */
const COMMIT_DELAY_MS = 250;

/**
 * Compact integer input: commits a valid value after a short pause in typing, at once on Enter (which never submits a
 * surrounding form) or blur, and shows the stored value again on blur. A new stored value (a quick button, a − / + step) replaces what was being typed.
 */
export function LevelInput({ id, value, min, max, onCommit, 'aria-label': ariaLabel, className }: LevelInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [shown, setShown] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  // Clear the draft when the committed value changes from outside (compared during render, no effect)
  if (shown !== value) {
    setShown(value);
    setDraft(null);
  }
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    []
  );

  const valid = (text: string): number | null => {
    if (!/^\d+$/.test(text.trim())) return null;
    const parsed = Number(text);
    return parsed >= min && parsed <= max ? parsed : null;
  };
  const commit = (text: string) => {
    window.clearTimeout(timer.current);
    const parsed = valid(text);
    if (parsed !== null && parsed !== value) onCommit(parsed);
  };

  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft ?? String(value)}
      aria-label={ariaLabel}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        window.clearTimeout(timer.current);
        if (valid(text) !== null)
          timer.current = window.setTimeout(() => {
            commit(text);
          }, COMMIT_DELAY_MS);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        // Enter never submits a surrounding form (the build editor's Save)
        e.preventDefault();
        if (draft !== null) commit(draft);
      }}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      autoComplete="off"
      className={cn('h-8 w-16 px-2 tabular-nums', className)}
    />
  );
}

interface LevelStepperProps extends LevelInputProps {
  /** The input's accessible name, also used for the −/+ buttons ("Decrease skill level") */
  readonly label: string;
  /** Classes of the number input (its width) */
  readonly inputClassName?: string;
}

const STEP_BUTTON =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-foreground aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-background aria-disabled:hover:text-muted-foreground';

/**
 * A LevelInput between − and + buttons (one step each). At a bound the button is aria-disabled, not disabled, so a
 * keyboard user pressing + up to the max keeps the focus.
 */
export function LevelStepper({ label, inputClassName, className, value, min, max, onCommit, ...input }: LevelStepperProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-1', className)}>
      <button
        type="button"
        className={STEP_BUTTON}
        aria-label={`Decrease ${label}`}
        aria-disabled={value <= min}
        onClick={() => {
          if (value > min) onCommit(value - 1);
        }}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <LevelInput
        {...input}
        value={value}
        min={min}
        max={max}
        onCommit={onCommit}
        aria-label={input['aria-label'] ?? label}
        className={cn(
          'h-7 w-12 [appearance:textfield] px-1 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          inputClassName
        )}
      />
      <button
        type="button"
        className={STEP_BUTTON}
        aria-label={`Increase ${label}`}
        aria-disabled={value >= max}
        onClick={() => {
          if (value < max) onCommit(value + 1);
        }}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
