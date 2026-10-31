/**
 * The affix browser's model: one row per item stat some affix writes, with the affixes that write it, so a filter author
 * who thinks in affix names ("Cruel", "of Mastery") finds the stat the plugin checks. Built from affixes.json (`stats`,
 * and `layers` for the params of the skill, skill tab, class, event and charged stats, named through `StatParamData`).
 */
import type { Affix, AffixesBundle } from '@/features/game-data/engine/schema';
import { statLayerKind, type StatLayerKind } from '@/features/game-data/engine/statLayers';
import { statQuirk } from '../engine/statQuirks';
import type { StatCheck } from '../engine/types';
import { exceptionOf, newExceptionCheck, newStatCheck } from './statChecks';
import { EMPTY_STAT_PARAMS, statParamLabel, type StatParamData } from './statParams';

export type AffixKind = 'prefix' | 'suffix' | 'automagic';

/** One param of a layered stat (a skill tab, class, skill, or skill and level) */
export interface AffixBrowserParam {
  readonly param: number;
  /** "Martial Arts (Assassin)", "Orb of Winter lvl 15"; "param N" when the data does not name it */
  readonly label: string;
}

export interface AffixBrowserAffix {
  /** '' for a nameless automod */
  readonly name: string;
  readonly kind: AffixKind;
  /** The lowest affix level among the rows with this name, kind and stat set */
  readonly lvl: number;
  /** Labels of the other stats the affix writes (a hybrid), by label */
  readonly hybridWith: readonly string[];
  /** The params it writes for the row's stat (a layered stat), by param; the union over the merged rows */
  readonly params?: readonly AffixBrowserParam[];
}

export interface AffixBrowserRow {
  readonly id: number;
  /** itemstatcost name, what a new check writes */
  readonly name: string;
  readonly label: string;
  /** By level, then name */
  readonly affixes: readonly AffixBrowserAffix[];
  /** Lower-case label, name, affix names and param labels */
  readonly search: string;
  /** Why the plugin may read the stat as 0 on some items (`STAT_QUIRKS`) */
  readonly note?: string;
  /** A layered stat whose affixes name params: a tick needs a param (the union of the affixes' params, by param) */
  readonly layerKind?: StatLayerKind;
  readonly params?: readonly AffixBrowserParam[];
}

export interface AffixBrowserModel {
  /** By label */
  readonly rows: readonly AffixBrowserRow[];
  /** itemstatcost name → id, for every listed stat */
  readonly ids: ReadonlyMap<string, number>;
  /** A param of a layered row by name ("param N" when the data does not name it), also one no affix writes */
  readonly paramOf: (row: AffixBrowserRow, param: number) => AffixBrowserParam;
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

const byParam = (a: AffixBrowserParam, b: AffixBrowserParam) => a.param - b.param;

/** The union of two param lists, by param */
function mergeParams(a: readonly AffixBrowserParam[], b: readonly AffixBrowserParam[]): AffixBrowserParam[] {
  const params = new Map([...a, ...b].map((entry) => [entry.param, entry]));
  return [...params.values()].sort(byParam);
}

export function buildAffixBrowserModel(bundle: AffixesBundle, params: StatParamData = EMPTY_STAT_PARAMS): AffixBrowserModel {
  const stats = new Map(bundle.stats.map((stat) => [stat.id, stat]));
  const edMax = bundle.stats.find((stat) => stat.name === ED_MAX)?.id;
  const edMin = bundle.stats.find((stat) => stat.name === ED_MIN)?.id;
  const shownStats = (affix: Affix) =>
    edMax !== undefined && affix.stats.includes(edMax) ? affix.stats.filter((id) => id !== edMin) : affix.stats;

  let edMerged = false;
  for (const affix of bundle.affixes) if (shownStats(affix).length < affix.stats.length) edMerged = true;
  const labelOf = (id: number) => (edMerged && id === edMax ? ED_LABEL : (stats.get(id)?.label ?? `Stat ${String(id)}`));

  const kindOf = (id: number) => statLayerKind(stats.get(id)?.name ?? '');
  const paramOf = (kind: StatLayerKind, param: number): AffixBrowserParam => ({
    param,
    label: statParamLabel(kind, param, params) ?? `param ${String(param)}`,
  });

  // stat id → affix key → affix (one entry per name, kind and stat set: ESR repeats rows per item type / level band)
  const byStat = new Map<number, Map<string, AffixBrowserAffix>>();
  for (const affix of bundle.affixes) {
    const ids = shownStats(affix).filter((id) => stats.has(id));
    for (const id of ids) {
      const hybridWith = ids
        .filter((other) => other !== id)
        .map(labelOf)
        .sort((a, b) => a.localeCompare(b));
      const kind = kindOf(id);
      const layers =
        kind === undefined ? [] : (affix.layers ?? []).filter((layer) => layer.stat === id).map((layer) => paramOf(kind, layer.param));
      const entry: AffixBrowserAffix = {
        name: affix.name,
        kind: KINDS[affix.kind],
        lvl: affix.lvl,
        hybridWith,
        ...(layers.length === 0 ? {} : { params: layers.sort(byParam) }),
      };
      const key = `${entry.kind}|${entry.name}|${hybridWith.join('|')}`;
      const entries = byStat.get(id) ?? new Map<string, AffixBrowserAffix>();
      const known = entries.get(key);
      const merged = known === undefined ? entry : { ...(entry.lvl < known.lvl ? entry : known) };
      const union = mergeParams(known?.params ?? [], entry.params ?? []);
      entries.set(key, union.length === 0 ? merged : { ...merged, params: union });
      byStat.set(id, entries);
    }
  }

  const rows = [...byStat].map(([id, entries]): AffixBrowserRow => {
    const name = stats.get(id)?.name ?? String(id);
    const label = labelOf(id);
    const affixes = [...entries.values()].sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
    const rowParams = affixes.reduce<AffixBrowserParam[]>((all, affix) => mergeParams(all, affix.params ?? []), []);
    const search = [label, name, ...affixes.map((affix) => affix.name), ...rowParams.map((entry) => entry.label)].join('\n').toLowerCase();
    const note = statQuirk(id)?.note;
    const layerKind = kindOf(id);
    return {
      id,
      name,
      label,
      affixes,
      search,
      ...(note === undefined ? {} : { note }),
      ...(layerKind === undefined || rowParams.length === 0 ? {} : { layerKind, params: rowParams }),
    };
  });
  rows.sort((a, b) => byLabel(a, b) || a.id - b.id);
  return {
    rows,
    ids: new Map(rows.map((row) => [row.name, row.id])),
    paramOf: (row, param) => (row.layerKind === undefined ? { param, label: `param ${String(param)}` } : paramOf(row.layerKind, param)),
  };
}

// One model per loaded bundle and param names (both are cached for the page's lifetime).
let cached: { bundle: AffixesBundle; params: StatParamData; model: AffixBrowserModel } | null = null;

export function getAffixBrowserModel(bundle: AffixesBundle, params: StatParamData): AffixBrowserModel {
  if (cached?.bundle !== bundle || cached.params !== params) cached = { bundle, params, model: buildAffixBrowserModel(bundle, params) };
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

/** Every term is in the row's label or stat name or in `own`, and at least one is in `own`. */
function namesOwnText(own: string, row: Pick<AffixBrowserRow, 'label' | 'name'> | undefined, terms: readonly string[]): boolean {
  const text = own.toLowerCase();
  const base = row === undefined ? '' : `${row.label}\n${row.name}`.toLowerCase();
  return terms.some((term) => text.includes(term)) && terms.every((term) => text.includes(term) || base.includes(term));
}

/**
 * Whether the search names the affix (for marking the affixes a search found): its name and param labels hold at least
 * one term, and every term is in them or in the row's label or stat name (`row`; without it, in the affix alone).
 */
export function affixMatches(affix: AffixBrowserAffix, query: string, row?: Pick<AffixBrowserRow, 'label' | 'name'>): boolean {
  const terms = searchTerms(query);
  if (terms.length === 0 || affix.name === '') return false;
  return namesOwnText([affix.name, ...(affix.params ?? []).map((entry) => entry.label)].join('\n'), row, terms);
}

/**
 * The row's params a search names: every term is in the row's label or stat name or in the param's own text (its label
 * and the names of the affixes writing it), and at least one term is in the param's text ("martial" → Martial Arts,
 * "chance orb winter" → the Orb of Winter levels). Empty for an empty query or when no param is named.
 */
export function matchingParams(row: AffixBrowserRow, query: string): number[] {
  const terms = searchTerms(query);
  if (terms.length === 0 || row.params === undefined) return [];
  return row.params
    .filter((entry) => {
      const writers = row.affixes.filter((affix) => affix.params?.some((p) => p.param === entry.param)).map((affix) => affix.name);
      return namesOwnText([entry.label, ...writers].join('\n'), row, terms);
    })
    .map((entry) => entry.param);
}

// --- Display ---

const KIND_NOUNS: Readonly<Record<AffixKind, readonly [string, string]>> = {
  prefix: ['prefix', 'prefixes'],
  suffix: ['suffix', 'suffixes'],
  automagic: ['automod', 'automods'],
};

/**
 * The param chips of a ticked layered row: the params the search names plus the picked ones, else all of the row's;
 * picked params no affix writes (a check the list already had) come too, so they can be seen and unpicked.
 */
export function shownParams(
  row: AffixBrowserRow,
  query: string,
  picked: ReadonlySet<number>,
  model: Pick<AffixBrowserModel, 'paramOf'>
): AffixBrowserParam[] {
  const named = new Set(matchingParams(row, query));
  const rowParams = row.params ?? [];
  const listed = new Set(rowParams.map((entry) => entry.param));
  const extra = [...picked].filter((param) => !listed.has(param)).map((param) => model.paramOf(row, param));
  const shown = rowParams.filter((entry) => named.size === 0 || named.has(entry.param) || picked.has(entry.param));
  return [...shown, ...extra].sort(byParam);
}

/** Affix params named in its text; more are counted ("[35 skills]"). */
const NAMED_PARAMS = 3;

const PARAM_NOUNS: Readonly<Record<StatLayerKind, string>> = {
  tab: 'tabs',
  class: 'classes',
  skill: 'skills',
  event: 'skills',
  charged: 'skills',
};

/**
 * Event and charged params by skill, levels joined: "Bone Wave lvl 15, 25, 35"; just "lvl 15, 25, 35" when the affix is
 * named after the skill ("of Bone Wave").
 */
function skillLevelTexts(params: readonly AffixBrowserParam[], affixName: string): string[] {
  const bySkill = new Map<number, AffixBrowserParam[]>();
  for (const entry of params) bySkill.set(entry.param >> 6, [...(bySkill.get(entry.param >> 6) ?? []), entry]);
  return [...bySkill.values()].map((entries) => {
    const levels = entries.map((entry) => String(entry.param & 63));
    const name = /^(.*) lvl \d+$/.exec(entries[0].label)?.[1];
    if (name === undefined) return entries.map((entry) => entry.label).join(', ');
    const named = bySkill.size === 1 && affixName.toLowerCase().includes(name.toLowerCase());
    return `${named ? '' : `${name} `}lvl ${levels.join(', ')}`;
  });
}

/**
 * "Cruel", "of Mastery (+Increased Attack Speed)", "Sharp (automod, +Attack Rating)", "unnamed automod"; a layered
 * stat's params follow in brackets ("Apprentice's [Demon Skills (Warlock)]", "Skillful [35 skills]"), since ESR reuses
 * affix names across classes.
 */
export function affixText(affix: AffixBrowserAffix, layerKind?: StatLayerKind): string {
  const params = affix.params ?? [];
  const texts = layerKind === 'event' || layerKind === 'charged' ? skillLevelTexts(params, affix.name) : params.map((entry) => entry.label);
  const named =
    texts.length === 0
      ? ''
      : texts.length <= NAMED_PARAMS || layerKind === undefined
        ? ` [${texts.join(', ')}]`
        : ` [${String(texts.length)} ${PARAM_NOUNS[layerKind]}]`;
  if (affix.name === '') {
    return affix.hybridWith.length === 0 ? `unnamed automod${named}` : `unnamed automod${named} (+${affix.hybridWith.join(', +')})`;
  }
  const tags = [...(affix.kind === 'automagic' ? ['automod'] : []), ...affix.hybridWith.map((label) => `+${label}`)];
  return tags.length === 0 ? `${affix.name}${named}` : `${affix.name}${named} (${tags.join(', ')})`;
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

/** Picked params per layered stat id (the browser's param chips). */
export type AffixParamSelection = ReadonlyMap<number, ReadonlySet<number>>;

/**
 * The params already checked per listed layered stat (checks of the mode, as in `initialAffixSelection`); every layered
 * row with a check gets an entry, an empty one when its checks have no param.
 */
export function initialAffixParams(
  checks: readonly StatCheck[] | undefined,
  model: AffixBrowserModel,
  inverted = false
): Map<number, Set<number>> {
  const layered = new Set(model.rows.filter((row) => row.layerKind !== undefined).map((row) => row.id));
  const params = new Map<number, Set<number>>();
  for (const check of checks ?? []) {
    const id = listedId(check, model, inverted);
    if (id === undefined || !layered.has(id)) continue;
    const set = params.get(id) ?? new Set<number>();
    if (check.param !== undefined) set.add(check.param);
    params.set(id, set);
  }
  return params;
}

/**
 * The ticked layered rows Apply cannot write: no param picked and no paramless check of the mode to keep. Apply waits
 * until each has a param (or is unticked).
 */
export function rowsMissingParams(
  checks: readonly StatCheck[] | undefined,
  model: AffixBrowserModel,
  draft: ReadonlySet<number>,
  params: AffixParamSelection,
  inverted = false
): AffixBrowserRow[] {
  const paramless = new Set(
    (checks ?? []).flatMap((check) => {
      const id = check.param === undefined ? listedId(check, model, inverted) : undefined;
      return id === undefined ? [] : [id];
    })
  );
  return model.rows.filter(
    (row) => row.layerKind !== undefined && draft.has(row.id) && (params.get(row.id)?.size ?? 0) === 0 && !paramless.has(row.id)
  );
}

/**
 * The list after Apply: checks on stats the browser does not list, and on ticked stats, stay as they are; checks on
 * listed stats that were unticked go; each newly ticked stat appends a presence check (`>= 1`, by name) in display order.
 * `inverted` (the "Except items with…" mode of a hide rule): only exception checks are the browser's, and a new tick
 * appends the opposite of presence (`< 1`). `params` (layered rows with an entry): one check per picked param; a check
 * whose param was unpicked goes, a check without param stays. An emptied list is `undefined`. Returns the same array
 * when nothing changes.
 */
export function applyAffixSelection(
  checks: readonly StatCheck[] | undefined,
  model: AffixBrowserModel,
  draft: ReadonlySet<number>,
  inverted = false,
  params: AffixParamSelection = new Map()
): readonly StatCheck[] | undefined {
  const current = checks ?? [];
  const kept = current.filter((check) => {
    const id = listedId(check, model, inverted);
    if (id === undefined) return true;
    if (!draft.has(id)) return false;
    const picked = params.get(id);
    return picked === undefined || check.param === undefined || picked.has(check.param);
  });
  const present = initialAffixSelection(kept, model, inverted);
  const keptParams = initialAffixParams(kept, model, inverted);
  const newCheck = (row: AffixBrowserRow, param?: number): StatCheck => {
    const check = inverted ? newExceptionCheck(row.name) : newStatCheck(row.name);
    return param === undefined ? check : { ...check, param };
  };
  const added = model.rows
    .filter((row) => draft.has(row.id))
    .flatMap((row) => {
      const picked = params.get(row.id);
      if (picked === undefined) return present.has(row.id) ? [] : [newCheck(row)];
      const have = keptParams.get(row.id) ?? new Set<number>();
      return [...picked]
        .filter((param) => !have.has(param))
        .sort((a, b) => a - b)
        .map((param) => newCheck(row, param));
    });
  if (added.length === 0 && kept.length === current.length) return checks;
  const next = [...kept, ...added];
  return next.length === 0 ? undefined : next;
}
