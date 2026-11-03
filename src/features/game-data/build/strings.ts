/**
 * Loader for the `data/local/lng/strings/*.json` string tables.
 *
 * All files share one global key space. Duplicate keys are resolved by a fixed file priority
 * (first wins); every duplicate whose English text differs is reported as a warning.
 */

export interface StringsFile {
  /** File name, e.g. `item-names.json` */
  readonly name: string;
  readonly text: string;
}

export interface StringTable {
  readonly strings: ReadonlyMap<string, string>;
  /**
   * The numeric `id` of the entry each key resolved to (the winning file's). Saves store some names by this id: the
   * runeword field of an item is the id of its runes.txt `Name` key.
   */
  readonly ids: ReadonlyMap<string, number>;
  readonly warnings: readonly string[];
}

/** Files that win key conflicts, highest priority first. All other files follow in alphabetical order. */
export const STRING_FILE_PRIORITY = ['item-runes', 'item-nameaffixes', 'item-modifiers', 'item-names', 'skills'] as const;

/**
 * Files that lose every key conflict. `chinese-overlay.json` re-defines ~80 keys with the censored
 * names of the Chinese release (e.g. "Chipped Skull" → "Chipped Quartz", "Zombie" → "Rotten One").
 */
export const STRING_FILE_LAST = ['chinese-overlay'] as const;

const COLOR_CODE = /ÿc./g;

export function stripColorCodes(text: string): string {
  return text.replace(COLOR_CODE, '');
}

function baseName(fileName: string): string {
  return fileName.replace(/\.json$/i, '');
}

function priorityOf(fileName: string): number {
  const name = baseName(fileName);
  if ((STRING_FILE_LAST as readonly string[]).includes(name)) return STRING_FILE_PRIORITY.length + 1;
  const i = (STRING_FILE_PRIORITY as readonly string[]).indexOf(name);
  return i === -1 ? STRING_FILE_PRIORITY.length : i;
}

export function sortStringFiles<T extends { readonly name: string }>(files: readonly T[]): T[] {
  return [...files].sort((a, b) => priorityOf(a.name) - priorityOf(b.name) || a.name.localeCompare(b.name));
}

function readEntries(file: StringsFile): { key: string; enUS: string; id: number | null }[] {
  const parsed: unknown = JSON.parse(file.text.replace(/^\uFEFF/, ''));
  if (!Array.isArray(parsed)) throw new Error(`${file.name}: expected a JSON array`);
  const entries: { key: string; enUS: string; id: number | null }[] = [];
  for (const item of parsed as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const key: unknown = (item as Record<string, unknown>).Key;
    const enUS: unknown = (item as Record<string, unknown>).enUS;
    const id: unknown = (item as Record<string, unknown>).id;
    if (typeof key !== 'string' || typeof enUS !== 'string') continue;
    entries.push({ key, enUS: stripColorCodes(enUS), id: typeof id === 'number' && Number.isInteger(id) ? id : null });
  }
  return entries;
}

export function buildStringTable(files: readonly StringsFile[]): StringTable {
  const strings = new Map<string, string>();
  const ids = new Map<string, number>();
  const source = new Map<string, string>();
  const warnings: string[] = [];

  for (const file of sortStringFiles(files)) {
    for (const { key, enUS, id } of readEntries(file)) {
      const existing = strings.get(key);
      if (existing === undefined) {
        strings.set(key, enUS);
        if (id !== null) ids.set(key, id);
        source.set(key, file.name);
      } else if (existing !== enUS) {
        warnings.push(
          `string "${key}": kept ${JSON.stringify(existing)} (${source.get(key) ?? '?'}), ignored ${JSON.stringify(enUS)} (${file.name})`
        );
      }
    }
  }

  return { strings, ids, warnings };
}
