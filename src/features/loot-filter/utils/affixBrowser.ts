/**
 * The affix browser's model: one row per item stat some affix writes, with the affixes that write it, so a filter author
 * who thinks in affix names ("Cruel", "of Mastery") finds the stat the plugin checks. Built from affixes.json (`stats`).
 */
import type { Affix, AffixesBundle } from '@/features/game-data/engine/schema';
import { statQuirk } from '../engine/statQuirks';
import type { StatCheck } from '../engine/types';
import { exceptionOf, newExceptionCheck, newStatCheck } from './statChecks';

export type AffixKind = 'prefix' | 'suffix' | 'automagic';

export interface AffixBrowserAffix {
  /** '' for a nameless automod */
  readonly name: string;
  readonly kind: AffixKind;
  /** The lowest affix level among the rows with this name, kind and stat set */
  readonly lvl: number;
  /** Labels of the other stats the affix writes (a hybrid), by label */
  readonly hybridWith: readonly string[];
}

export interface AffixBrowserRow {
  readonly id: number;
  /** itemstatcost name, what a new check writes */
  readonly name: string;
  readonly label: string;
  /** By level, then name */
  readonly affixes: readonly AffixBrowserAffix[];
  /** Lower-case label, name and affix names */
  readonly search: string;
  /** Why the plugin may read the stat as 0 on some items (`STAT_QUIRKS`) */
  readonly note?: string;
}

export interface AffixBrowserModel {
  /** By label */
  readonly rows: readonly AffixBrowserRow[];
  /** itemstatcost name → id, for every listed stat */
  readonly ids: ReadonlyMap<string, number>;
}

const KINDS: Readonly<Record<Affix['kind'], AffixKind>> = { p: 'prefix', s: 'suffix', a: 'automagic' };

/**
 * Enhanced damage (`dmg%`) writes both item_maxdamage_percent and item_mindamage_percent. The browser shows them as one
 * "Enhanced Damage" row on the max stat (a check on it finds every ED affix) and hides the min stat wherever both are
 * written; an affix writing only one of them keeps it as its own row.
 */
const ED_MAX = 'item_maxdamage_percent';
const ED_MIN = 'item_mindamage_percent';
const ED_LABEL = 'Enhanced Damage';

const byLabel = (a: { readonly label: string }, b: { readonly label: string }) => a.label.localeCompare(b.label);

export function buildAffixBrowserModel(bundle: AffixesBundle): AffixBrowserModel {
  const stats = new Map(bundle.stats.map((stat) => [stat.id, stat]));
  const edMax = bundle.stats.find((stat) => stat.name === ED_MAX)?.id;
  const edMin = bundle.stats.find((stat) => stat.name === ED_MIN)?.id;
  const shownStats = (affix: Affix) =>
    edMax !== undefined && affix.stats.includes(edMax) ? affix.stats.filter((id) => id !== edMin) : affix.stats;

  let edMerged = false;
  for (const affix of bundle.affixes) if (shownStats(affix).length < affix.stats.length) edMerged = true;
  const labelOf = (id: number) => (edMerged && id === edMax ? ED_LABEL : (stats.get(id)?.label ?? `Stat ${String(id)}`));

  // stat id → affix key → affix (one entry per name, kind and stat set: ESR repeats rows per item type / level band)
  const byStat = new Map<number, Map<string, AffixBrowserAffix>>();
  for (const affix of bundle.affixes) {
    const ids = shownStats(affix).filter((id) => stats.has(id));
    for (const id of ids) {
      const hybridWith = ids
        .filter((other) => other !== id)
        .map(labelOf)
        .sort((a, b) => a.localeCompare(b));
      const entry: AffixBrowserAffix = { name: affix.name, kind: KINDS[affix.kind], lvl: affix.lvl, hybridWith };
      const key = `${entry.kind}|${entry.name}|${hybridWith.join('|')}`;
      const entries = byStat.get(id) ?? new Map<string, AffixBrowserAffix>();
      const known = entries.get(key);
      if (known === undefined || entry.lvl < known.lvl) entries.set(key, entry);
      byStat.set(id, entries);
    }
  }

  const rows = [...byStat].map(([id, entries]): AffixBrowserRow => {
    const name = stats.get(id)?.name ?? String(id);
    const label = labelOf(id);
    const affixes = [...entries.values()].sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
    const search = [label, name, ...affixes.map((affix) => affix.name)].join('\n').toLowerCase();
    const note = statQuirk(id)?.note;
    return { id, name, label, affixes, search, ...(note === undefined ? {} : { note }) };
  });
  rows.sort((a, b) => byLabel(a, b) || a.id - b.id);
  return { rows, ids: new Map(rows.map((row) => [row.name, row.id])) };
}

// One model per loaded bundle (bundles are cached for the page's lifetime).
let cached: { bundle: AffixesBundle; model: AffixBrowserModel } | null = null;

export function getAffixBrowserModel(bundle: AffixesBundle): AffixBrowserModel {
  if (cached?.bundle !== bundle) cached = { bundle, model: buildAffixBrowserModel(bundle) };
  return cached.model;
}

// --- Search ---

function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** A term matches the label, the stat name, an affix name, or (all digits) the stat id. */
const termMatches = (row: AffixBrowserRow, term: string) => row.search.includes(term) || (/^\d+$/.test(term) && Number(term) === row.id);

/** The rows matching every whitespace-separated term of `query`; an empty query returns them all. */
export function filterAffixBrowser(rows: readonly AffixBrowserRow[], query: string): readonly AffixBrowserRow[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return rows;
  return rows.filter((row) => terms.every((term) => termMatches(row, term)));
}

/** Whether a term of `query` is part of the affix's name (for marking the affixes a search found). */
export function affixMatches(affix: AffixBrowserAffix, query: string): boolean {
  const name = affix.name.toLowerCase();
  return name !== '' && searchTerms(query).some((term) => name.includes(term));
}

// --- Display ---

const KIND_NOUNS: Readonly<Record<AffixKind, readonly [string, string]>> = {
  prefix: ['prefix', 'prefixes'],
  suffix: ['suffix', 'suffixes'],
  automagic: ['automod', 'automods'],
};

/** "Cruel", "of Mastery (+Increased Attack Speed)", "Sharp (automod, +Attack Rating)", "unnamed automod". */
export function affixText(affix: AffixBrowserAffix): string {
  if (affix.name === '') return affix.hybridWith.length === 0 ? 'unnamed automod' : `unnamed automod (+${affix.hybridWith.join(', +')})`;
  const tags = [...(affix.kind === 'automagic' ? ['automod'] : []), ...affix.hybridWith.map((label) => `+${label}`)];
  return tags.length === 0 ? affix.name : `${affix.name} (${tags.join(', ')})`;
}

/** "21 prefixes, 1 suffix" (prefixes, suffixes, automods; kinds without affixes left out). */
export function affixKindCounts(affixes: readonly AffixBrowserAffix[]): string {
  return (['prefix', 'suffix', 'automagic'] as const)
    .map((kind) => {
      const count = affixes.filter((affix) => affix.kind === kind).length;
      const [one, many] = KIND_NOUNS[kind];
      return count === 0 ? '' : `${String(count)} ${count === 1 ? one : many}`;
    })
    .filter(Boolean)
    .join(', ');
}

// --- Selection ---

/**
 * The id a check's stat (an itemstatcost name or id) has in the browser; undefined when it does not list it. Each mode
 * owns its own checks: the inverted (exception) mode only exception checks (`<`, `<=`, `!=`, see `exceptionOf`), the
 * plain mode every other check, so neither shows the other's checks as ticked nor removes them on Apply.
 */
function listedId(check: StatCheck, model: AffixBrowserModel, inverted: boolean): number | undefined {
  if (inverted !== (exceptionOf(check) !== undefined)) return undefined;
  if (typeof check.stat === 'number') return model.rows.some((row) => row.id === check.stat) ? check.stat : undefined;
  return model.ids.get(check.stat);
}

/**
 * The draft: the listed stats that already have a check in the list (any value or param; a `<`, `<=` or `!=` check is
 * an exception and counts only when `inverted`).
 */
export function initialAffixSelection(checks: readonly StatCheck[] | undefined, model: AffixBrowserModel, inverted = false): Set<number> {
  const selected = new Set<number>();
  for (const check of checks ?? []) {
    const id = listedId(check, model, inverted);
    if (id !== undefined) selected.add(id);
  }
  return selected;
}

/**
 * The list after Apply: checks on stats the browser does not list, and on ticked stats, stay as they are; checks on
 * listed stats that were unticked go; each newly ticked stat appends a presence check (`>= 1`, by name) in display order.
 * `inverted` (the "Except items with…" mode of a hide rule): only exception checks are the browser's, and a new tick
 * appends the opposite of presence (`< 1`). An emptied list is `undefined`. Returns the same array when nothing changes.
 */
export function applyAffixSelection(
  checks: readonly StatCheck[] | undefined,
  model: AffixBrowserModel,
  draft: ReadonlySet<number>,
  inverted = false
): readonly StatCheck[] | undefined {
  const current = checks ?? [];
  const kept = current.filter((check) => {
    const id = listedId(check, model, inverted);
    return id === undefined || draft.has(id);
  });
  const present = initialAffixSelection(kept, model, inverted);
  const added = model.rows
    .filter((row) => draft.has(row.id) && !present.has(row.id))
    .map((row) => (inverted ? newExceptionCheck(row.name) : newStatCheck(row.name)));
  if (added.length === 0 && kept.length === current.length) return checks;
  const next = [...kept, ...added];
  return next.length === 0 ? undefined : next;
}
