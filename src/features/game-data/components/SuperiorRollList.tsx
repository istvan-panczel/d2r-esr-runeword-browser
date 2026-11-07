import { cn } from '@/lib/utils';
import type { SuperiorRow } from '../engine/schema';
import { formatSuperiorChance } from '../engine/superiorAffixes';
import { BonusLines } from './EnhanceParts';

/** Rows under 1% get the amber "rare" colour (the +skills, max resist and -enemy resist rows players chase) */
const RARE_CHANCE = 0.01;

export interface SuperiorRollItem {
  readonly row: SuperiorRow;
  readonly chance: number;
}

interface SuperiorRollListProps {
  readonly rolls: readonly SuperiorRollItem[];
  /** Compact = the base card panel: chance and lines only (weight and row number in the tooltip) */
  readonly compact?: boolean;
  readonly className?: string;
}

function rollTitle(row: SuperiorRow): string {
  return `qualityitems.txt row ${String(row.row)}, weight ${String(row.weight)}`;
}

/** Superior rows with their chance, weight and row number, then the rendered stat lines. */
export function SuperiorRollList({ rolls, compact = false, className }: SuperiorRollListProps) {
  return (
    <ul className={cn('divide-y', className)}>
      {rolls.map(({ row, chance }) => (
        <li key={row.row} className={cn('flex gap-3', compact ? 'py-1' : 'px-3 py-2')} title={compact ? rollTitle(row) : undefined}>
          <div className={cn('shrink-0 text-right', compact ? 'w-12' : 'w-20')}>
            <div
              className={cn(
                'font-mono',
                compact ? 'text-xs leading-5' : 'text-sm',
                chance < RARE_CHANCE && 'text-amber-700 dark:text-amber-400'
              )}
            >
              {row.weight === 0 ? 'never' : formatSuperiorChance(chance)}
            </div>
            {!compact && (
              <div className="text-xs whitespace-nowrap text-muted-foreground" title={rollTitle(row)}>
                w {row.weight} · #{row.row}
              </div>
            )}
          </div>
          {row.text.length > 0 ? (
            <BonusLines lines={row.text} className="min-w-0 text-sm" />
          ) : (
            <span className="text-sm text-muted-foreground">No bonus</span>
          )}
        </li>
      ))}
    </ul>
  );
}
