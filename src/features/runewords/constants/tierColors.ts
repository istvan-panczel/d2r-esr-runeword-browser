import type { RuneCategory } from '@/core/db';

// Text colors for ESR tiers (mapped by tier number)
export const ESR_TIER_TEXT_COLORS: Record<number, string> = {
  1: 'text-slate-600 dark:text-slate-300', // WHITE
  2: 'text-red-600 dark:text-red-400', // RED
  3: 'text-yellow-600 dark:text-yellow-400', // YELLOW
  4: 'text-orange-600 dark:text-orange-400', // ORANGE
  5: 'text-green-600 dark:text-green-400', // GREEN
  6: 'text-amber-600 dark:text-amber-400', // GOLD
  7: 'text-purple-600 dark:text-purple-400', // PURPLE
};

// Text colors for LoD tiers (Low, Mid, High)
export const LOD_TIER_TEXT_COLORS: Record<number, string> = {
  1: 'text-slate-600 dark:text-slate-300', // Low tier (El - Dol)
  2: 'text-amber-600 dark:text-amber-400', // Mid tier (Hel - Gul)
  3: 'text-purple-600 dark:text-purple-400', // High tier (Vex - Zod)
};

// Text colors for rune categories (for tier groups)
export const CATEGORY_TEXT_COLORS: Record<string, string> = {
  lodRunes: 'text-amber-600 dark:text-amber-400',
  kanjiRunes: 'text-blue-600 dark:text-blue-400',
};

/**
 * Get the text color class for a specific tier and category.
 */
export function getTierTextColor(tier: number, category: RuneCategory): string {
  if (category === 'esrRunes') {
    return ESR_TIER_TEXT_COLORS[tier] ?? '';
  }
  return LOD_TIER_TEXT_COLORS[tier] ?? '';
}

/**
 * Get the display label for a tier.
 * ESR: T1, T2, T3, T4, T5, T6, T7
 * LoD: LoD-L (Low), LoD-M (Mid), LoD-H (High)
 */
export function getTierLabel(tier: number, category: RuneCategory): string {
  if (category === 'esrRunes') {
    return `T${String(tier)}`;
  }
  // LoD tier labels
  const lodLabels: Record<number, string> = {
    1: 'LoD-L',
    2: 'LoD-M',
    3: 'LoD-H',
  };
  return lodLabels[tier] ?? `LoD-${String(tier)}`;
}
