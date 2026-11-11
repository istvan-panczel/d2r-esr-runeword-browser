/** The tabs of the My Character page, kept in `?tab=` (like the loot filter editor and the campaign map); Overview is the default and has no param. */
export const CHARACTER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'gear', label: 'Gear' },
  { id: 'skills', label: 'Skills' },
  { id: 'combat', label: 'Combat' },
  { id: 'storage', label: 'Storage' },
  { id: 'progress', label: 'Progress' },
] as const;

export type CharacterTab = (typeof CHARACTER_TABS)[number]['id'];

export const DEFAULT_CHARACTER_TAB: CharacterTab = 'overview';
export const CHARACTER_TAB_PARAM = 'tab';
export const CHARACTER_ROUTE = '/character';

export function isCharacterTab(value: string | null): value is CharacterTab {
  return CHARACTER_TABS.some((tab) => tab.id === value);
}

/** The tab of a `?tab=` value; unknown values (and none) are the Overview. Case-insensitive, like the router's paths. */
export function readCharacterTab(value: string | null): CharacterTab {
  const lower = value?.trim().toLowerCase() ?? null;
  return isCharacterTab(lower) ? lower : DEFAULT_CHARACTER_TAB;
}

/** The params with the tab set (the default tab removes the param); other params are kept. */
export function withCharacterTab(params: URLSearchParams, tab: CharacterTab): URLSearchParams {
  const next = new URLSearchParams(params);
  if (tab === DEFAULT_CHARACTER_TAB) next.delete(CHARACTER_TAB_PARAM);
  else next.set(CHARACTER_TAB_PARAM, tab);
  return next;
}

/** The page's URL on a tab (`/character?tab=gear`) */
export function characterTabUrl(tab: CharacterTab): string {
  const query = withCharacterTab(new URLSearchParams(), tab).toString();
  return query === '' ? CHARACTER_ROUTE : `${CHARACTER_ROUTE}?${query}`;
}

/** DOM ids of the tab row and its panel */
export const CHARACTER_TAB_PANEL_ID = 'character-tab-panel';
export const characterTabId = (tab: CharacterTab) => `character-tab-${tab}`;

/**
 * The tab a key moves to in the tab bar (the WAI-ARIA tabs pattern): Left / Right wrap around, Home / End go to the first
 * / last; null for any other key
 */
export function tabAfterKey(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
