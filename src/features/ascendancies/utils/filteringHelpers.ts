import type { Ascendancy } from '@/core/db';

export function matchesSearch(item: Ascendancy, searchTerms: readonly string[]): boolean {
  if (searchTerms.length === 0) return true;

  const tierText = item.tiers.flatMap((t) => t.bonuses).join(' ');
  const footnoteText = item.footnotes.join(' ');
  const unlockText = item.unlockInputs?.join(' ') ?? '';
  const searchableText = `${item.name} ${tierText} ${footnoteText} ${unlockText}`.toLowerCase();

  return searchTerms.every((term) => searchableText.includes(term));
}
