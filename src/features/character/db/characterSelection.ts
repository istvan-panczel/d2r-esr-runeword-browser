/**
 * Which stored character the My Character page shows, remembered in this browser (not in the URL: a shared link must
 * not name someone's character). localStorage can throw or be empty (private window, blocked site data); the page then
 * falls back to the most recently uploaded character.
 */
export const SELECTED_CHARACTER_STORAGE_KEY = 'myCharacter.selected';

export function loadSelectedCharacter(): string | null {
  try {
    return localStorage.getItem(SELECTED_CHARACTER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remembers the selection; null forgets it. */
export function saveSelectedCharacter(characterName: string | null): void {
  try {
    if (characterName === null) localStorage.removeItem(SELECTED_CHARACTER_STORAGE_KEY);
    else localStorage.setItem(SELECTED_CHARACTER_STORAGE_KEY, characterName);
  } catch {
    // Storage blocked: the selection simply is not remembered
  }
}
