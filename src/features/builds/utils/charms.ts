export interface CharmEntry {
  readonly id: string;
  readonly text: string;
}

let charmIdCounter = 0;

/** Creates a charm entry with a stable id (used as a React key while editing). */
export function newCharmEntry(text = ''): CharmEntry {
  charmIdCounter += 1;
  return { id: `charm-${String(charmIdCounter)}`, text };
}

/** Converts stored charm strings into editable entries. */
export function toCharmEntries(texts: readonly string[]): CharmEntry[] {
  return texts.map((text) => newCharmEntry(text));
}

/** Trims entries and drops empty ones for persistence. */
export function charmTexts(entries: readonly CharmEntry[]): string[] {
  return entries.map((entry) => entry.text.trim()).filter((text) => text.length > 0);
}
