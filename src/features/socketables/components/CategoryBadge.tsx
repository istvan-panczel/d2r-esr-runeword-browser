import { Badge } from '@/components/ui/badge';
import type { SocketableCategory } from '../types';

interface CategoryBadgeProps {
  readonly category: SocketableCategory;
}

// Theme-aware badge colors matching socketable item colors
const CATEGORY_CONFIG: Record<SocketableCategory, { label: string; className: string }> = {
  // Gems: Amethyst purple
  gems: {
    label: 'Gem',
    className: 'bg-purple-200 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-900',
  },
  // ESR Runes: Tier 2 red
  esrRunes: {
    label: 'ESR',
    className: 'bg-red-200 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-900',
  },
  // LoD Runes: Gold/amber
  lodRunes: {
    label: 'LoD',
    className: 'bg-amber-200 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-900',
  },
  // Kanji Runes: Blue
  kanjiRunes: {
    label: 'Kanji',
    className: 'bg-blue-200 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-900',
  },
  // Crystals: Peridot green
  crystals: {
    label: 'Crystal',
    className: 'bg-green-200 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-900',
  },
};

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category];

  return <Badge className={config.className}>{config.label}</Badge>;
}
