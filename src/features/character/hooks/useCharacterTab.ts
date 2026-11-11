import { useSearchParams } from 'react-router-dom';
import { CHARACTER_TAB_PARAM, readCharacterTab, withCharacterTab, type CharacterTab } from '../engine/characterTabs';

/**
 * The My Character page's tab, kept in `?tab=` so a tab can be linked and survives a reload; unknown values fall back to
 * the Overview. Switching pushes a history entry (Back returns to the previous tab), like moving between pages.
 */
export function useCharacterTab(): readonly [CharacterTab, (tab: CharacterTab) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readCharacterTab(searchParams.get(CHARACTER_TAB_PARAM));
  const setTab = (next: CharacterTab) => {
    if (next === tab) return;
    setSearchParams((previous) => withCharacterTab(previous, next));
  };
  return [tab, setTab];
}
