import { useLiveQuery } from 'dexie-react-hooks';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { db } from '@/core/db';
import { RuneTooltip } from './RuneTooltip';

// Background colors based on rune color (tier for ESR runes)
const BG_COLOR_MAP: Record<string, string> = {
  WHITE: 'bg-slate-200 dark:bg-slate-700',
  RED: 'bg-red-200 dark:bg-red-900',
  YELLOW: 'bg-yellow-200 dark:bg-yellow-800',
  ORANGE: 'bg-orange-200 dark:bg-orange-900',
  GREEN: 'bg-green-200 dark:bg-green-900',
  GOLD: 'bg-amber-200 dark:bg-amber-900',
  PURPLE: 'bg-purple-200 dark:bg-purple-900',
};

// Default background colors for categories without stored color
const CATEGORY_BG_COLORS: Record<string, string> = {
  lodRunes: 'bg-amber-200 dark:bg-amber-900',
  kanjiRunes: 'bg-blue-200 dark:bg-blue-900',
};

interface RuneBadgeProps {
  readonly runeName: string;
}

export function RuneBadge({ runeName }: RuneBadgeProps) {
  // Strip " Rune" suffix for display
  const displayName = runeName.replace(' Rune', '');

  // Look up rune data to get color
  const runeInfo = useLiveQuery(async () => {
    const esrRune = await db.esrRunes.get(runeName);
    if (esrRune) {
      return { color: esrRune.color, category: 'esrRunes' };
    }

    const lodRune = await db.lodRunes.get(runeName);
    if (lodRune) {
      return { color: null, category: 'lodRunes' };
    }

    const kanjiRune = await db.kanjiRunes.get(runeName);
    if (kanjiRune) {
      return { color: null, category: 'kanjiRunes' };
    }

    return null;
  }, [runeName]);

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
    <RuneTooltip runeName={runeName}>
      <Badge variant="outline" className={cn('cursor-pointer hover:opacity-80', bgColorClass)}>
        {displayName}
      </Badge>
    </RuneTooltip>
  );
}
