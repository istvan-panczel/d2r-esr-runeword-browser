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

export interface CharmLineParts {
  readonly name: string;
  /** What follows the first ": "; null for a name-only line such as "Annihilus" or "9x Java GCs" */
  readonly stats: string | null;
}

/** Splits a stored charm line ("Coral Small Charm: Lightning Resist +11%") for display. */
export function splitCharmLine(line: string): CharmLineParts {
  const separator = line.indexOf(': ');
  if (separator <= 0) return { name: line, stats: null };
  const stats = line.slice(separator + 2).trim();
  return stats === '' ? { name: line, stats: null } : { name: line.slice(0, separator), stats };
}
