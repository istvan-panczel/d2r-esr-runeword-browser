import { useState } from 'react';
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

/** Compact integer input: commits every valid value while typing and shows the stored value again on blur. */
export function LevelInput({ id, value, min, max, onCommit, 'aria-label': ariaLabel, className }: LevelInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
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
        setDraft(e.target.value);
        const parsed = Number(e.target.value);
        if (e.target.value !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max) onCommit(parsed);
      }}
      onBlur={() => {
        setDraft(null);
      }}
      autoComplete="off"
      className={cn('h-8 w-16 px-2 tabular-nums', className)}
    />
  );
}
