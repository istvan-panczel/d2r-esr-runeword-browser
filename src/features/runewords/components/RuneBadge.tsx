import { useLiveQuery } from 'dexie-react-hooks';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { db } from '@/core/db';
import { RuneTooltip } from './RuneTooltip';

// Background colors based on rune color (tier for ESR runes)
const BG_COLOR_MAP: Record<string, string> = {
  WHITE: 'bg-slate-200 dark:bg-slate-700',
  RED: 'bg-red-200 dark:bg-red-900',
  YELLOW: 'bg-yellow-100 dark:bg-yellow-800',
  ORANGE: 'bg-orange-200 dark:bg-orange-900',
  GREEN: 'bg-green-200 dark:bg-green-900',
  GOLD: 'bg-[#e8e5d7] dark:bg-[#3d3826]',
  PURPLE: 'bg-purple-200 dark:bg-purple-900',
};

// Default background colors for categories without stored color
const CATEGORY_BG_COLORS: Record<string, string> = {
  lodRunes: 'bg-[#e8e5d7] dark:bg-[#3d3826]',
  kanjiRunes: 'bg-blue-200 dark:bg-blue-900',
};

interface RuneBadgeProps {
  readonly runeName: string;
  /** Whether this rune belongs to a LoD runeword (affects lookup order for shared runes like Ko) */
  readonly isLod?: boolean;
}

export function RuneBadge({ runeName, isLod }: RuneBadgeProps) {
  // Strip " Rune" suffix for display
  const displayName = runeName.replace(' Rune', '');

  // Look up rune data to get color.
  // For LoD runewords, check LoD first to resolve shared runes (e.g. Ko) correctly.
  const runeInfo = useLiveQuery(async () => {
    if (isLod) {
      const lodRune = await db.lodRunes.get(runeName);
      if (lodRune) {
        return { color: null, category: 'lodRunes' };
      }
    }

    const esrRune = await db.esrRunes.get(runeName);
    if (esrRune) {
      return { color: esrRune.color, category: 'esrRunes' };
    }

    if (!isLod) {
      const lodRune = await db.lodRunes.get(runeName);
      if (lodRune) {
        return { color: null, category: 'lodRunes' };
      }
    }

    const kanjiRune = await db.kanjiRunes.get(runeName);
    if (kanjiRune) {
      return { color: null, category: 'kanjiRunes' };
    }

    return null;
  }, [runeName, isLod]);

  // Get background color class
  let bgColorClass = '';
  if (runeInfo) {
    if (runeInfo.color) {
      bgColorClass = BG_COLOR_MAP[runeInfo.color.toUpperCase()] ?? '';
    } else {
      bgColorClass = CATEGORY_BG_COLORS[runeInfo.category] ?? '';
    }
  }

  return (
    <RuneTooltip runeName={runeName} isLod={isLod}>
      <Badge variant="outline" className={cn('cursor-pointer hover:opacity-80', bgColorClass)}>
        {displayName}
      </Badge>
    </RuneTooltip>
  );
}
