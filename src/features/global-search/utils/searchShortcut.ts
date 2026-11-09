/**
 * The global search shortcut. Kept apart from the dialog code: this file is in the entry bundle.
 * Cmd+K on a Mac, Ctrl+K elsewhere: Ctrl+K on a Mac is the system's delete-to-end-of-line in text fields and CodeMirror.
 */

/** The modifier and key state the shortcut reads (a `KeyboardEvent` has them) */
export type ShortcutKeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

export function isMacUserAgent(userAgent: string): boolean {
  return /Mac|iPhone|iPad/.test(userAgent);
}

export function isSearchShortcut(event: ShortcutKeyEvent, isMac: boolean): boolean {
  if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey) return false;
  return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

export function searchShortcutLabel(isMac: boolean): string {
  return isMac ? '⌘K' : 'Ctrl+K';
}
