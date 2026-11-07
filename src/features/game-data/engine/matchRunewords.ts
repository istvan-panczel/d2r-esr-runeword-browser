/**
 * Matches the HTM-derived runewords (Dexie `Runeword`, keyed name + variant) against the txt runewords bundle.
 *
 * Pass 1: same name and same ordered ingredients → 'exact'
 * Pass 2: same name and same ingredient multiset → 'multiset'
 * Pass 3: the name is unique on both sides (one txt key, one distinct HTM recipe) → 'name-only' ("recipe differs")
 *
 * Jewels are not part of either recipe (the HTM parser lists them separately, the bundle counts them in `jewels`),
 * so every per-socket HTM row of a recipe matches the same txt key.
 *
 * Several txt keys may share a name and recipe and differ only in item types (29 names in ESR 3.2.10, e.g. Rain:
 * Runeword658 wand/knif, 659 glov/boot/belt, 908 orb/mana, 909 staf). With `typeNames`, such ties are narrowed to
 * the keys whose itype/etype names equal the HTM allowed/excluded items; otherwise the match carries all tied keys.
 */
import type { TxtRuneword, TxtRunewordRow, TxtRunewordsBundle } from './schema.ts';

/** Structural subset of the Dexie `Runeword` model (src/core/db/models.ts). */
export interface HtmRunewordLike {
  readonly name: string;
  readonly variant: number;
  readonly sockets: number;
  readonly socketsMax?: number;
  /** All runes and gems in order; falls back to `runes` when absent */
  readonly ingredients?: readonly string[];
  readonly runes?: readonly string[];
  /** Item type display names ("Wand", "Any Shield"); used to break ties between txt keys */
  readonly allowedItems?: readonly string[];
  readonly excludedItems?: readonly string[];
}

export interface MatchOptions {
  /** Item type code → display name (`TypesBundle.types`); enables the allowed-items tie-break */
  typeNames?: ReadonlyMap<string, string>;
}

export type MatchQuality = 'exact' | 'multiset' | 'name-only';

export interface RunewordMatch {
  /** First matching txt key */
  key: string;
  /** All txt keys with the same name and recipe that fit the HTM allowed items (usually one) */
  keys: string[];
  name: string;
  rows: TxtRunewordRow[];
  quality: MatchQuality;
}

export interface RunewordMatchResult<T extends HtmRunewordLike = HtmRunewordLike> {
  /** Keyed by `${name}::${variant}` of the HTM runeword (see `htmRunewordId`) */
  byHtm: Map<string, RunewordMatch>;
  unmatchedHtm: T[];
  unmatchedTxt: TxtRuneword[];
}

const COLOR_CODE = /ÿc./g;
const APOSTROPHES = /[‘’‛`´′]/g;
const COMBINING_MARKS = /[̀-ͯ]/g;
const INGREDIENT_SUFFIX = / (?:rune|gem)$/;

/** Colour codes stripped, NFKD without combining marks, apostrophes unified, lowercased, whitespace collapsed. */
export function normalizeName(text: string): string {
  return text
    .replace(COLOR_CODE, '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(APOSTROPHES, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** `normalizeName` plus a trailing " rune" / " gem" removed ("Eth Rune" → "eth"). */
export function normalizeIngredient(text: string): string {
  return normalizeName(text).replace(INGREDIENT_SUFFIX, '');
}

export function htmRunewordId(runeword: Pick<HtmRunewordLike, 'name' | 'variant'>): string {
  return `${runeword.name}::${String(runeword.variant)}`;
}

function htmIngredients(runeword: HtmRunewordLike): readonly string[] {
  return runeword.ingredients ?? runeword.runes ?? [];
}

function orderedSignature(name: string, ingredients: readonly string[]): string {
  return `${normalizeName(name)}|${ingredients.map(normalizeIngredient).join(',')}`;
}

function multisetSignature(name: string, ingredients: readonly string[]): string {
  return `${normalizeName(name)}|${ingredients.map(normalizeIngredient).sort().join(',')}`;
}

/** Index of txt runewords by signature; a key is listed once per signature even if several rows share it. */
function indexTxt(runewords: readonly TxtRuneword[], signature: (name: string, ingredients: readonly string[]) => string) {
  const index = new Map<string, TxtRuneword[]>();
  for (const runeword of runewords) {
    const signatures = new Set(runeword.rows.map((row) => signature(runeword.name, row.ingredients)));
    for (const sig of signatures) {
      const list = index.get(sig) ?? [];
      list.push(runeword);
      index.set(sig, list);
    }
  }
  return index;
}

function toMatch(runewords: readonly TxtRuneword[], quality: MatchQuality): RunewordMatch | null {
  const first = runewords.at(0);
  if (first === undefined) return null;
  return {
    key: first.key,
    keys: runewords.map((runeword) => runeword.key),
    name: first.name,
    rows: runewords.flatMap((runeword) => runeword.rows),
    quality,
  };
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

/**
 * Labels the site uses instead of the itemtypes name. Type names that collide in itemtypes carry a " (code)" suffix
 * in the types bundle ("Helm (merc)"), which is stripped before comparing.
 */
const SITE_TYPE_LABELS: Readonly<Record<string, string>> = { tors: 'Body Armor' };

/** The name the ESR site uses for an itemtypes code, normalised (`normalizeName`): "tors" → "body armor". */
export function siteTypeLabel(code: string, typeNames: ReadonlyMap<string, string>): string {
  return normalizeName(SITE_TYPE_LABELS[code] ?? (typeNames.get(code) ?? code).replace(/ \([^)]*\)$/, ''));
}

function typeLabels(codes: readonly string[], typeNames: ReadonlyMap<string, string>): string {
  const labels = codes.map((code) => siteTypeLabel(code, typeNames));
  return [...new Set(labels)].sort().join('|');
}

function itemLabels(items: readonly string[] | undefined): string {
  return [...new Set((items ?? []).map(normalizeName))].sort().join('|');
}

/** Narrows tied txt keys to those whose item types read like the HTM allowed/excluded items; keeps all when none fit. */
function breakTie(candidates: readonly TxtRuneword[], runeword: HtmRunewordLike, typeNames: ReadonlyMap<string, string> | undefined) {
  if (candidates.length < 2 || typeNames === undefined || runeword.allowedItems === undefined) return candidates;
  const allowed = itemLabels(runeword.allowedItems);
  const excluded = itemLabels(runeword.excludedItems);
  const fitting = candidates.filter(
    (candidate) =>
      typeLabels(
        candidate.rows.flatMap((row) => row.itypes),
        typeNames
      ) === allowed &&
      typeLabels(
        candidate.rows.flatMap((row) => row.etypes),
        typeNames
      ) === excluded
  );
  return fitting.length > 0 ? fitting : candidates;
}

export function matchRunewords<T extends HtmRunewordLike>(
  htm: readonly T[],
  txt: TxtRunewordsBundle,
  options: MatchOptions = {}
): RunewordMatchResult<T> {
  const byHtm = new Map<string, RunewordMatch>();
  let remaining = [...htm];

  const runPass = (signature: (name: string, ingredients: readonly string[]) => string, quality: MatchQuality) => {
    const index = indexTxt(txt.runewords, signature);
    remaining = remaining.filter((runeword) => {
      const candidates = index.get(signature(runeword.name, htmIngredients(runeword))) ?? [];
      const match = toMatch(breakTie(candidates, runeword, options.typeNames), quality);
      if (match === null) return true;
      byHtm.set(htmRunewordId(runeword), match);
      return false;
    });
  };
  runPass(orderedSignature, 'exact');
  runPass(multisetSignature, 'multiset');

  // Pass 3: exactly one txt key with the name, and all HTM rows of the name share one recipe
  const txtByName = groupBy(txt.runewords, (runeword) => normalizeName(runeword.name));
  const htmByName = groupBy(htm, (runeword) => normalizeName(runeword.name));
  remaining = remaining.filter((runeword) => {
    const name = normalizeName(runeword.name);
    const candidates = txtByName.get(name) ?? [];
    const htmRecipes = new Set((htmByName.get(name) ?? []).map((other) => multisetSignature(other.name, htmIngredients(other))));
    const match = candidates.length === 1 && htmRecipes.size === 1 ? toMatch(candidates, 'name-only') : null;
    if (match === null) return true;
    byHtm.set(htmRunewordId(runeword), match);
    return false;
  });

  const matchedKeys = new Set([...byHtm.values()].flatMap((match) => match.keys));
  return {
    byHtm,
    unmatchedHtm: remaining,
    unmatchedTxt: txt.runewords.filter((runeword) => !matchedKeys.has(runeword.key)),
  };
}

/** Rows of a match whose socket count lies within the HTM recipe's socket range. */
export function rowsForSockets(
  rows: readonly TxtRunewordRow[],
  runeword: Pick<HtmRunewordLike, 'sockets' | 'socketsMax'>
): TxtRunewordRow[] {
  const max = runeword.socketsMax ?? runeword.sockets;
  return rows.filter((row) => row.sockets >= runeword.sockets && row.sockets <= max);
}
