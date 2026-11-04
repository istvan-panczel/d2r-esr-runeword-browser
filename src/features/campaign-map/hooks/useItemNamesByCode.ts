import { useItemIcons } from '@/features/game-data/hooks/useItemIcons';

/**
 * Quest item names by code (icons.json `quest` entries carry the name stashnames.json gives the code: `vip` is "Top of
 * the Horadric Staff"), for the detail panel and the search. Shares the icon store the quest item icons load: null
 * until then, and on a failed load (the panel then shows the quest without the item name).
 */
export function useItemNamesByCode(): ReadonlyMap<string, string> | null {
  const { index } = useItemIcons();
  if (index === null) return null;
  return new Map([...index.quest].map(([code, icon]) => [code, icon.name]));
}
