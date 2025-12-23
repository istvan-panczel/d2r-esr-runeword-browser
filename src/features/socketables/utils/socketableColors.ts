import type { SocketableCategory } from '../types';

// Map stored color names to Tailwind classes with dark/light variants
const COLOR_CLASS_MAP: Record<string, string> = {
  RED: 'text-red-700 dark:text-red-400',
  PURPLE: 'text-purple-700 dark:text-purple-400',
  YELLOW: 'text-yellow-700 dark:text-yellow-300',
  ORANGE: 'text-orange-700 dark:text-orange-400',
  GREEN: 'text-green-700 dark:text-green-400',
  GOLD: 'text-amber-700 dark:text-amber-400',
  WHITE: 'text-slate-600 dark:text-slate-300',
  BLUE: 'text-blue-700 dark:text-blue-400',
};

// Default colors for categories without stored color
const CATEGORY_DEFAULT_COLORS: Partial<Record<SocketableCategory, string>> = {
  lodRunes: 'text-amber-700 dark:text-amber-400', // Gold
  kanjiRunes: 'text-blue-700 dark:text-blue-400', // Blue
};

export function getSocketableColorClass(color: string | null, category: SocketableCategory): string | undefined {
  // If color exists, use the mapped class
  if (color) {
    return COLOR_CLASS_MAP[color.toUpperCase()];
  }

  // Fall back to category default
  return CATEGORY_DEFAULT_COLORS[category];
}
