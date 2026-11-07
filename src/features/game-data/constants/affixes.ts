import type { Affix } from '../engine/schema';

export type AffixKind = Affix['kind'];
export type AffixQuality = 'magic' | 'rare';

export const AFFIX_KINDS: readonly AffixKind[] = ['p', 's', 'a'];

/** The page's two lists: magic / rare / automod affixes, or the superior quality rows (qualityitems.txt) */
export const AFFIX_VIEWS = ['affixes', 'superior'] as const;
export type AffixView = (typeof AFFIX_VIEWS)[number];
export const AFFIX_VIEW_LABELS: Record<AffixView, string> = { affixes: 'Magic & rare', superior: 'Superior' };

export function isAffixView(value: string): value is AffixView {
  return (AFFIX_VIEWS as readonly string[]).includes(value);
}
export const AFFIX_KIND_LABELS: Record<AffixKind, string> = { p: 'Prefix', s: 'Suffix', a: 'Automod' };

export const AFFIX_SORT_KEYS = ['name', 'lvl', 'group', 'freq'] as const;
export type AffixSortKey = (typeof AFFIX_SORT_KEYS)[number];

export function isAffixSortKey(value: string): value is AffixSortKey {
  return (AFFIX_SORT_KEYS as readonly string[]).includes(value);
}

export const AFFIX_SORT_LABELS: Record<AffixSortKey, string> = {
  name: 'Name',
  lvl: 'Affix level',
  group: 'Group',
  freq: 'Frequency',
};

/** Item level / affix level range (level cap 99). */
export const AFFIX_LEVEL_RANGE = { min: 1, max: 99 } as const;

/** Number of affixes rendered initially and added per "Show more" click. */
export const AFFIXES_PAGE_SIZE = 200;
