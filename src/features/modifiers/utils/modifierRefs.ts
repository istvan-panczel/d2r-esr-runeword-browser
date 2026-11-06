/**
 * Modifier lines in item property lists ("+20% Deadly Strike", "+8% Physical Damage Leeched as Life", "Fire Resist
 * +30%", "Cannot Be Frozen"): which /modifiers entry a whole line is. The templates are the stat display strings of
 * modifiers.json, turned into canonical keys at build time (`modifierRefsBuild.ts`, `npm run modifiers:refs` writes
 * `data/modifierRefs.json`); a line matches when its canonical form equals a key, so modifier names inside prose
 * ("for every 1% Deadly Strike over the cap …") never match. See docs/features/MODIFIERS.md "Modifier peek".
 *
 * Imports only types and the attribute module: the app shell's line renderer uses it, the build script too (Node runs
 * it as is, hence the `.ts` extensions).
 */
import type { ModifierCategory, ModifierFact } from '../../game-data/engine/schema.ts';
import type { SourceKind } from './modifierContent.ts';
import type { ModifierRef } from './modifierRefData.ts';

export type { ModifierRef } from './modifierRefData.ts';

/** The /modifiers route and its focus param (copies of modifierRoutes.ts; modifierRefs.test.ts checks them) */
export const ROUTE = 'modifiers';
export const KIND_PARAM = 'kind';

/** One /modifiers entry a line can name: what the peek shows */
export interface ModifierRefEntry {
  /** Entry key (content key or key kind), the page's `?kind=` */
  readonly key: string;
  readonly title: string;
  readonly category: ModifierCategory;
  /** The hand-written one-line summary (content/modifiers/modifiers.md); null for a key kind without text */
  readonly summary: string | null;
  /** Where the explanation mostly comes from (the body's source tags; game files for a key kind without text) */
  readonly source: SourceKind;
}

/** `data/modifierRefs.json`: the generated templates, entries and the facts the peek quotes */
export interface ModifierRefsData {
  readonly entries: readonly ModifierRefEntry[];
  /** [canonical whole-line key, entries index] */
  readonly templates: readonly (readonly [string, number])[];
  /** [canonical key with `¤` wildcards (a class or skill tab name, a monster), entries index] */
  readonly patterns: readonly (readonly [string, number])[];
  /** The modifiers.json facts the peek's numbers use (modifierPeek.ts PEEK_FACT_KEYS) */
  readonly facts: readonly ModifierFact[];
  /** [title, kind key] of every kind the home search lists (`modifierSearchNames`) */
  readonly searchNames: readonly (readonly [string, string])[];
}

export interface ModifierRefIndex {
  readonly byKey: ReadonlyMap<string, ModifierRefEntry>;
  readonly templates: ReadonlyMap<string, ModifierRefEntry>;
  readonly patterns: readonly (readonly [RegExp, ModifierRefEntry])[];
  readonly facts: readonly ModifierFact[];
}

/** The modifiers.json facts the peek's numbers read (modifierPeek.ts); the generator copies them into the data */
export const PEEK_FACT_KEYS: readonly string[] = [
  'difficulty.LifeStealDivisor',
  'difficulty.ManaStealDivisor',
  'leech.precision',
  'crushingBlow.share',
  'criticalDamage.basePercent',
  'magicFind.dim',
  'magicFind.tail',
  'castRate.cap',
  'dodge.cap',
  'resist.physicalCap',
  'difficulty.ResistPenalty',
  'resist.maxBase',
  'resist.hardCap',
  'absorb.percentCap',
  'block.cap',
  'attackRating.curve',
  'difficulty.MonsterFreezeDivisor',
];

/** A wildcard in a canonical key: a name the template takes from elsewhere (`%s`, `%1`) */
export const WILDCARD = '¤';
/** A number in a canonical key */
export const NUMBER_MARK = '#';

/** A number as item lines print it: 15, +15, -15, 1.5, (10 to 20), +(10 to 20), -(5 to 8), (-5 to -8), 10-20 */
const NUMBER = /[+-]?(?:\([+-]?\d+(?:\.\d+)?(?:(?: to |-)[+-]?\d+(?:\.\d+)?)?\)|\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)/g;
const RANGE = /^([+-]?)\(?([+-]?\d+(?:\.\d+)?)(?:(?: to |-)([+-]?\d+(?:\.\d+)?))?\)?$/;
/** The descstr2 of the per-level stats */
const PER_LEVEL = '(based on character level)';

/** Lines too long to be a template are skipped without any work */
export const MAX_LINE_LENGTH = 160;

/** A line's canonical form: lower case, no colour codes, single spaces, no trailing footnote marks, numbers → `#` */
export function canonicalLine(line: string): { readonly key: string; readonly numbers: readonly string[] } {
  const numbers: string[] = [];
  const key = line
    .replace(/ÿc./g, '')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\*+$/, '')
    .replace(NUMBER, (number) => {
      numbers.push(number);
      return NUMBER_MARK;
    });
  return { key, numbers };
}

/** A printed number as [min, max] ("+(10 to 20)" → [10, 20], "-(5 to 8)" → [-5, -8]); null when it does not parse */
export function parseLineNumber(text: string): [number, number] | null {
  const match = RANGE.exec(text);
  if (match === null) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const min = Number(match[2]) * sign;
  const upper = match.at(3);
  const max = upper === undefined ? min : Number(upper) * sign;
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A wildcard key as a whole-line pattern over canonical lines */
export function patternRegExp(key: string): RegExp {
  return new RegExp(`^${key.split(WILDCARD).map(escapeRegExp).join('.+')}$`);
}

export function buildModifierRefIndex(data: ModifierRefsData): ModifierRefIndex {
  const entryAt = (index: number): ModifierRefEntry => {
    const entry = data.entries.at(index);
    if (entry === undefined) throw new Error(`modifierRefs.json: no entry ${String(index)}`);
    return entry;
  };
  return {
    byKey: new Map(data.entries.map((entry) => [entry.key, entry])),
    templates: new Map(data.templates.map(([key, index]) => [key, entryAt(index)])),
    patterns: data.patterns.map(([key, index]) => [patternRegExp(key), entryAt(index)] as const),
    facts: data.facts,
  };
}

/**
 * The modifier a whole item line is, or null (prose, skill lines, stats without an explanation). Costs one regex
 * replace and a Map lookup; the few wildcard patterns run only when that misses.
 */
export function findModifierRef(line: string, index: ModifierRefIndex): ModifierRef | null {
  if (line.length > MAX_LINE_LENGTH || line.length === 0) return null;
  const { key, numbers } = canonicalLine(line);
  let entry = index.templates.get(key);
  if (entry === undefined) {
    for (const [pattern, candidate] of index.patterns) {
      if (pattern.test(key)) {
        entry = candidate;
        break;
      }
    }
  }
  if (entry === undefined) return null;
  const first = numbers.at(0);
  const value = first === undefined ? null : parseLineNumber(first);
  return {
    key: entry.key,
    ...(value === null ? {} : { value }),
    ...(key.endsWith(PER_LEVEL) ? { perLevel: true as const } : {}),
  };
}

/** The /modifiers page focused on the entry */
export function modifierRefUrl(key: string): string {
  return `/${ROUTE}?${new URLSearchParams({ [KIND_PARAM]: key }).toString()}`;
}
