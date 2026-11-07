/** Helpers for the texts a filter prints: per-language resolution, colour runs and placeholders. */
import { LANGUAGES, type FilterText, type Language, type LocalizedText } from './types.ts';

/** The language's text, else enUS, else the first one given. */
export function resolveText(text: FilterText | undefined, language: Language = 'enUS'): string | undefined {
  if (text === undefined || typeof text === 'string') return text;
  return text[language] ?? text.enUS ?? Object.values(text)[0];
}

/** The languages a per-language text has, in the guide's order (enUS first). */
export function textLanguages(text: LocalizedText): Language[] {
  return LANGUAGES.filter((language) => text[language] !== undefined);
}

/**
 * `text` with `language` set to `value`, the others kept. An edited language keeps its place (the file's key order), an
 * added one goes last, and an emptied one stays (as `''`) while it is edited: `pruneEmptyLanguages` drops it afterwards.
 */
export function withLanguage(text: LocalizedText, language: Language, value: string): LocalizedText {
  const entries = Object.entries(text).map(([key, current]) => [key, key === language ? value : current]);
  if (!(language in text)) entries.push([language, value]);
  return Object.fromEntries(entries) as LocalizedText;
}

/**
 * `text` without its empty languages (the editor's emptied fields), as the file is written. A text whose languages are
 * all empty stays an object with its shown language as `''`.
 */
export function pruneEmptyLanguages(text: LocalizedText): LocalizedText {
  const entries = Object.entries(text).filter(([, value]) => value !== '');
  if (entries.length === Object.keys(text).length) return text;
  return entries.length === 0 ? { [shownLanguage(text)]: '' } : Object.fromEntries(entries);
}

/** A text as the file writes it: a string as is, a per-language one without its emptied languages. */
export function fileText(text: FilterText): FilterText {
  return typeof text === 'string' ? text : pruneEmptyLanguages(text);
}

/** The language a per-language text shows by default (`resolveText` without a language): enUS, else its first one. */
export function shownLanguage(text: LocalizedText): Language {
  if (text.enUS !== undefined) return 'enUS';
  return LANGUAGES.find((language) => language === Object.keys(text)[0]) ?? 'enUS';
}

/** A filter level's name in the language (enUS by default), `''` when it has none. */
export function levelName(level: { readonly name: FilterText }, language?: Language): string {
  return resolveText(level.name, language) ?? '';
}

/**
 * A piece of a text: a run in one colour, or a line break (`\n` in the text).
 * `color` is the character after `ÿc` (e.g. `'4'`), or `null` before the first colour code, meaning the
 * colour the game would use by default there. A colour carries over line breaks.
 */
export type TextSegment = { readonly kind: 'text'; readonly color: string | null; readonly text: string } | { readonly kind: 'break' };

const COLOR_PREFIX = 'ÿc';

/** Splits on `ÿc` + one character and on `\n`; empty runs are left out. A trailing `ÿc` without a code stays text. */
export function splitColorRuns(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let color: string | null = null;
  let run = '';
  const flush = (): void => {
    if (run !== '') segments.push({ kind: 'text', color, text: run });
    run = '';
  };
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(COLOR_PREFIX, i) && i + COLOR_PREFIX.length < text.length) {
      flush();
      color = text.charAt(i + COLOR_PREFIX.length);
      i += COLOR_PREFIX.length + 1;
      continue;
    }
    const ch = text.charAt(i);
    if (ch === '\n') {
      flush();
      segments.push({ kind: 'break' });
    } else run += ch;
    i++;
  }
  flush();
  return segments;
}

/** Where a placeholder works: item names (replaceName, namePrefix, nameSuffix), chat lines, the drop line, the level change line. */
export type PlaceholderContext = 'names' | 'chat' | 'dropFormat' | 'levelChangeFormat';

export interface PlaceholderInfo {
  /** The placeholder as written, with `ID`, `PARAM` or `KEY` standing for its argument. */
  readonly token: string;
  /** Matches a placeholder found in a text (`{stat:36}`, `{stat:36,1}`…). */
  readonly pattern: RegExp;
  readonly contexts: readonly PlaceholderContext[];
  readonly description: string;
}

const ITEM: readonly PlaceholderContext[] = ['names', 'chat', 'dropFormat'];

const simple = (name: string, description: string, contexts: readonly PlaceholderContext[] = ITEM): PlaceholderInfo => ({
  token: `{${name}}`,
  pattern: new RegExp(`^\\{${name}\\}$`),
  contexts,
  description,
});

/** Every placeholder in the guide. */
export const PLACEHOLDERS: readonly PlaceholderInfo[] = [
  simple('name', "The item's name, translated by the game"),
  simple('code', "The item's code"),
  simple('quality', "The item's quality"),
  simple('baseTier', "The item's base tier"),
  simple('itemLevel', "The item's level"),
  simple('sockets', 'Its sockets'),
  simple('maxSockets', 'The most sockets its base can have'),
  simple('ethereal', 'Its ethereal flag'),
  simple('uniqueOrSetId', 'Its uniqueitems.txt or setitems.txt row'),
  simple('qualityColor', "The colour code of the item's name, after qualityColors"),
  {
    token: '{stat:ID}',
    pattern: /^\{stat:[^,{}]+(,-?\d+)?\}$/,
    contexts: ITEM,
    description: "One of the item's stats ({stat:ID} or {stat:ID,PARAM})",
  },
  {
    token: '{playerStat:ID}',
    pattern: /^\{playerStat:[^,{}]+(,-?\d+)?\}$/,
    contexts: ITEM,
    description: "One of your character's stats ({playerStat:ID} or {playerStat:ID,PARAM})",
  },
  {
    token: '{string:KEY}',
    pattern: /^\{string:[^{}]+\}$/,
    contexts: ['names', 'chat', 'dropFormat', 'levelChangeFormat'],
    description: "A game string in the player's language, e.g. {string:r01}",
  },
  simple('link', "Chat lines only: the item's name", ['chat', 'dropFormat']),
  simple('level', "The filter level's name", ['levelChangeFormat']),
  simple('filter', "The filter's title", ['levelChangeFormat']),
];

/** The `{...}` placeholders in a text, in order, as written (duplicates kept). */
export function listPlaceholders(text: string): string[] {
  return text.match(/\{[^{}]*\}/g) ?? [];
}

/** The guide's description of a placeholder as written in a text, or undefined when it is not one. */
export function findPlaceholder(token: string): PlaceholderInfo | undefined {
  return PLACEHOLDERS.find((placeholder) => placeholder.pattern.test(token));
}
