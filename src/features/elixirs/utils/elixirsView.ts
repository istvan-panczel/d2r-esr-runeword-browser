/**
 * Elixirs page: URL state, filters and the values of each elixir at the chosen character level, Utility Potion
 * Effectiveness / Duration and perks (elixirs.json formulas through `engine/elixirs.ts`).
 *
 * - `?name=` is an elixir's kebab slug (`greater-elixir-of-luck`): only that elixir shows; the other filters are ignored.
 * - `avail`: `everyone` (drops for every character) or `perk` (needs a perk to drop, or comes with one).
 * - `variant`: `regular` or `greater` (the special Elixir of Reincarnation shows under neither).
 * - `lvl`, `eff`, `dur`: character level, Utility Potion Effectiveness % and Duration %; `perks`: the toggled perk slugs.
 */
import { FILTER_URL_PARAM_KEYS, parseBoundedIntParam } from '@/core/utils/filterUrlParams';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { ELIXIR_STATS, evaluateElixirCalc, fillValue, framesToSeconds, type ElixirStats } from '@/features/game-data/engine/elixirs';
import type { ElixirInfo, ElixirPerk, ElixirsBundle } from '@/features/game-data/engine/schema';
import { MODIFIERS_ROUTE, MODIFIERS_URL_PARAMS } from '@/features/modifiers/utils/modifierRoutes';

export const ELIXIRS_ROUTE = 'elixirs';
/** The Specializations page (another feature); `tree` and `perk` are lower-case kebab names */
export const SPECIALIZATIONS_ROUTE = '/specializations';
export const ELIXIRS_GUIDE_NOTE = '/guide/elixirs';
/** The Modifiers page's Utility Potion Effectiveness and Duration block */
export const UTILITY_POTIONS_MODIFIER = `/${MODIFIERS_ROUTE}?${new URLSearchParams({ [MODIFIERS_URL_PARAMS.KIND]: 'utility-potions' }).toString()}`;

export const ELIXIRS_URL_PARAMS = {
  NAME: FILTER_URL_PARAM_KEYS.NAME,
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
  AVAIL: 'avail',
  VARIANT: 'variant',
  LVL: 'lvl',
  EFF: 'eff',
  DUR: 'dur',
  PERKS: 'perks',
} as const;

export type Availability = 'everyone' | 'perk';
export type VariantFilter = 'regular' | 'greater';

/** Highest Utility Potion Effectiveness / Duration the inputs take (percent) */
export const MAX_BONUS = 1000;

export interface ElixirsState {
  readonly name: string | null;
  readonly search: string;
  readonly avail: Availability | null;
  readonly variant: VariantFilter | null;
  readonly level: number;
  readonly effectiveness: number;
  readonly duration: number;
  /** Perk keys (`alchemy_4`) switched on */
  readonly perks: readonly string[];
}

export function defaultState(bundle: Pick<ElixirsBundle, 'maxLevel'>): ElixirsState {
  return { name: null, search: '', avail: null, variant: null, level: bundle.maxLevel, effectiveness: 0, duration: 0, perks: [] };
}

/**
 * The perks the page can switch on: the ones the formulas read (they change the values) and the ones the drop odds
 * depend on, in perk order
 */
export function togglePerks(bundle: Pick<ElixirsBundle, 'perks' | 'drops' | 'elixirs'>): ElixirPerk[] {
  const formulaText = bundle.elixirs
    .flatMap((elixir) => [elixir.duration, ...elixir.effects.flatMap((effect) => effect.formula ?? [])])
    .join(' ');
  const oddsPerks = new Set(bundle.drops.odds.flatMap((entry) => entry.perks));
  return bundle.perks.filter((perk) => oddsPerks.has(perk.key) || formulaText.includes(`'${perk.key}'`));
}

export function readElixirsState(params: URLSearchParams, bundle: ElixirsBundle): ElixirsState {
  const avail = params.get(ELIXIRS_URL_PARAMS.AVAIL);
  const variant = params.get(ELIXIRS_URL_PARAMS.VARIANT);
  const slug = params.get(ELIXIRS_URL_PARAMS.NAME);
  const toggles = togglePerks(bundle);
  const perkSlugs = new Set((params.get(ELIXIRS_URL_PARAMS.PERKS) ?? '').split(',').map((part) => part.trim()));
  return {
    name: slug !== null && bundle.elixirs.some((elixir) => elixir.slug === slug) ? slug : null,
    search: params.get(ELIXIRS_URL_PARAMS.SEARCH) ?? '',
    avail: avail === 'everyone' || avail === 'perk' ? avail : null,
    variant: variant === 'regular' || variant === 'greater' ? variant : null,
    level: parseBoundedIntParam(params.get(ELIXIRS_URL_PARAMS.LVL), { min: 1, max: bundle.maxLevel }) ?? bundle.maxLevel,
    effectiveness: parseBoundedIntParam(params.get(ELIXIRS_URL_PARAMS.EFF), { min: 0, max: MAX_BONUS }) ?? 0,
    duration: parseBoundedIntParam(params.get(ELIXIRS_URL_PARAMS.DUR), { min: 0, max: MAX_BONUS }) ?? 0,
    perks: toggles.filter((perk) => perkSlugs.has(perk.slug)).map((perk) => perk.key),
  };
}

export function encodeElixirsState(state: ElixirsState, bundle: ElixirsBundle): URLSearchParams {
  const params = new URLSearchParams();
  if (state.name !== null) params.set(ELIXIRS_URL_PARAMS.NAME, state.name);
  if (state.avail !== null) params.set(ELIXIRS_URL_PARAMS.AVAIL, state.avail);
  if (state.variant !== null) params.set(ELIXIRS_URL_PARAMS.VARIANT, state.variant);
  if (state.level !== bundle.maxLevel) params.set(ELIXIRS_URL_PARAMS.LVL, String(state.level));
  if (state.effectiveness !== 0) params.set(ELIXIRS_URL_PARAMS.EFF, String(state.effectiveness));
  if (state.duration !== 0) params.set(ELIXIRS_URL_PARAMS.DUR, String(state.duration));
  const slugs = bundle.perks.filter((perk) => state.perks.includes(perk.key)).map((perk) => perk.slug);
  if (slugs.length > 0) params.set(ELIXIRS_URL_PARAMS.PERKS, slugs.join(','));
  if (state.search.trim() !== '') params.set(ELIXIRS_URL_PARAMS.SEARCH, state.search.trim());
  return params;
}

/** `/elixirs?name=greater-elixir-of-luck` */
export function elixirHref(slug: string): string {
  return `/${ELIXIRS_ROUTE}?${new URLSearchParams({ [ELIXIRS_URL_PARAMS.NAME]: slug }).toString()}`;
}

/** `/specializations?tree=alchemist&perk=hidden-elixirs` */
export function perkHref(perk: Pick<ElixirPerk, 'tree' | 'slug'>): string {
  const tree = perk.tree.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${SPECIALIZATIONS_ROUTE}?${new URLSearchParams({ tree, perk: perk.slug }).toString()}`;
}

/** `/game-data/materials?name=Elixir%20of%20Luck` */
export function materialsHref(name: string): string {
  return `/game-data/materials?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.NAME]: name }).toString()}`;
}

// --- values -------------------------------------------------------------------------------------------------------

export interface ValueContext {
  readonly level: number;
  readonly effectiveness: number;
  readonly duration: number;
  readonly perks: readonly string[];
}

export function contextStats(context: ValueContext): ElixirStats {
  return {
    [ELIXIR_STATS.level]: context.level,
    [ELIXIR_STATS.effectiveness]: context.effectiveness,
    [ELIXIR_STATS.duration]: context.duration,
    ...Object.fromEntries(context.perks.map((key) => [key, 1])),
  };
}

export interface EffectLineView {
  /** The line with the value at the chosen settings (a fixed line as it is) */
  readonly text: string;
  /** The values at level 1 and at the top level with the same bonuses; null for a fixed line */
  readonly range: readonly [number, number] | null;
}

export interface ElixirValues {
  readonly tooltip: string;
  readonly lines: readonly EffectLineView[];
  /** Seconds at the chosen duration; null for an effect that lasts until it triggers */
  readonly seconds: number | null;
}

/** "Grants +%d%% Enhanced Damage …" with the value; `%%` → `%` */
export function fillTooltip(tooltip: string, value: number | null): string {
  return tooltip.replace(/%\+?d/g, value === null ? '?' : String(value)).replaceAll('%%', '%');
}

export function elixirValues(elixir: ElixirInfo, context: ValueContext, maxLevel: number): ElixirValues {
  const stats = contextStats(context);
  const at = (formula: string, level: number) => evaluateElixirCalc(formula, { ...stats, [ELIXIR_STATS.level]: level });
  const lines = elixir.effects.flatMap((effect) => {
    if (effect.formula === null) return effect.lines.map((text) => ({ text, range: null }));
    const formula = effect.formula;
    const value = at(formula, context.level);
    const low = at(formula, 1);
    const high = at(formula, maxLevel);
    const range = low === null || high === null ? null : ([low, high] as const);
    return effect.lines.map((line) => ({ text: value === null ? line.replaceAll('{v}', '?') : fillValue(line, value), range }));
  });
  const tooltipValue = elixir.tooltipFormula === undefined ? null : at(elixir.tooltipFormula, context.level);
  const frames = elixir.seconds === undefined ? null : evaluateElixirCalc(elixir.duration, stats);
  return {
    tooltip: elixir.tooltipFormula === undefined ? elixir.tooltip : fillTooltip(elixir.tooltip, tooltipValue),
    lines,
    seconds: frames === null ? null : framesToSeconds(frames),
  };
}

// --- drops --------------------------------------------------------------------------------------------------------

/** The odds entry for the switched-on perks (only the perks the odds depend on count) */
export function oddsFor(bundle: Pick<ElixirsBundle, 'drops'>, perks: readonly string[]): Readonly<Record<string, number>> {
  const relevant = (list: readonly string[]) => [...new Set(list)].sort().join(',');
  const known = new Set(bundle.drops.odds.flatMap((entry) => entry.perks));
  const wanted = relevant(perks.filter((perk) => known.has(perk)));
  return bundle.drops.odds.find((entry) => relevant(entry.perks) === wanted)?.chances ?? {};
}

/** "1 in 13 (7.69%)" */
export function oddsText(chance: number): string {
  if (chance <= 0) return 'never';
  const percent = Math.round(chance * 10000) / 100;
  const oneIn = 1 / chance;
  return Number.isInteger(Math.round(oneIn * 100) / 100)
    ? `1 in ${String(Math.round(oneIn))} (${String(percent)}%)`
    : `${String(percent)}%`;
}

// --- filtering ----------------------------------------------------------------------------------------------------

export function needsPerk(elixir: Pick<ElixirInfo, 'dropPerks' | 'perk'>): boolean {
  return elixir.perk !== undefined || (elixir.dropPerks?.length ?? 0) > 0;
}

function searchText(elixir: ElixirInfo, perks: ReadonlyMap<string, ElixirPerk>): string {
  return [
    elixir.name,
    elixir.code,
    elixir.tooltip,
    ...elixir.effects.flatMap((effect) => effect.lines),
    ...(elixir.dropPerks ?? []).map((key) => perks.get(key)?.title ?? ''),
    elixir.perk === undefined ? '' : (perks.get(elixir.perk)?.title ?? ''),
  ]
    .join(' ')
    .toLowerCase();
}

export function filterElixirs(bundle: Pick<ElixirsBundle, 'elixirs' | 'perks'>, state: ElixirsState): ElixirInfo[] {
  if (state.name !== null) return bundle.elixirs.filter((elixir) => elixir.slug === state.name);
  const perks = new Map(bundle.perks.map((perk) => [perk.key, perk]));
  const terms = parseSearchTerms(state.search);
  return bundle.elixirs.filter((elixir) => {
    if (state.avail === 'everyone' && needsPerk(elixir)) return false;
    if (state.avail === 'perk' && !needsPerk(elixir)) return false;
    if (state.variant !== null && elixir.variant !== state.variant) return false;
    if (terms.length === 0) return true;
    const text = searchText(elixir, perks);
    return terms.every((term) => text.includes(term));
  });
}
