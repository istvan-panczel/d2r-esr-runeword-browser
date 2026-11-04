import { cn } from '@/lib/utils';
import type { FactSource } from '../engine/types';
import { factSourceLabel } from '../utils/sourceLabels';
import { FACT_TONE_CLASS } from './mapStyles';

interface FactSourceLabelProps {
  readonly source: FactSource;
  readonly verify?: boolean;
  readonly className?: string;
}

/** The small trust chip after a curated fact: "Official Maps page", "Game files", "Vanilla, unconfirmed in ESR"… */
export function FactSourceLabel({ source, verify, className }: FactSourceLabelProps) {
  const label = factSourceLabel(source, verify);
  return (
    <span
      title={label.title}
      className={cn(
        'ml-1 inline-flex items-center rounded border px-1 align-[0.1em] text-[0.6875rem] leading-4 whitespace-nowrap',
        FACT_TONE_CLASS[label.tone],
        className
      )}
    >
      {label.text}
    </span>
  );
}
