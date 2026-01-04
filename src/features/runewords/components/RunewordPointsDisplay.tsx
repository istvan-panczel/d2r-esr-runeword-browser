import type { TierPointTotal } from '@/core/db';
import { getTierTextColor, getTierLabel } from '../constants/tierColors';

interface RunewordPointsDisplayProps {
  readonly tierTotals: readonly TierPointTotal[];
}

/**
 * Displays the pre-calculated tier point totals for a runeword.
 * Each tier total is shown with its appropriate color.
 */
export function RunewordPointsDisplay({ tierTotals }: RunewordPointsDisplayProps) {
  if (tierTotals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
      {tierTotals.map((total) => {
        const colorClass = getTierTextColor(total.tier, total.category);
        const label = getTierLabel(total.tier, total.category);
        return (
          <span key={`${total.category}:${String(total.tier)}`} className={colorClass}>
            {label}: {total.totalPoints}
          </span>
        );
      })}
    </div>
  );
}
