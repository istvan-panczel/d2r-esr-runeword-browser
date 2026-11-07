/**
 * Enhance page (corruption, anointment, sanctification, Vessel of Souls): URL state, search and the summary texts built from
 * enhance.json.
 */
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import {
  ENHANCE_QUALITIES,
  type AnointmentOutcome,
  type AnointmentSlot,
  type CorruptionBrickResult,
  type CorruptionOutcome,
  type CorruptionSlot,
  type EnhanceBundle,
  type EnhanceQuality,
  type SanctificationOutcome,
  type VesselMaterial,
  type VesselRecipe,
  type VesselTransform,
} from '../engine/schema';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';

export const ENHANCE_TABS = ['corruption', 'anointment', 'sanctification', 'vessel'] as const;
export type EnhanceTab = (typeof ENHANCE_TABS)[number];

export const ENHANCE_TAB_LABELS: Record<EnhanceTab, string> = {
  corruption: 'Corruption',
  anointment: 'Anointment',
  sanctification: 'Sanctification',
  vessel: 'Vessel of Souls',
};

/** Anointment pools that are not equipment slots */
export const ANOINTMENT_EXTRA_POOLS = [
  { pool: 'charm', label: 'Unique Charm' },
  { pool: 'vessel', label: 'Vessel of Souls' },
] as const;

/** Equipment slot of the anointment pools (`AnointmentSlot.group`) → label */
const ANOINTMENT_GROUP_LABELS: Readonly<Partial<Record<string, string>>> = {
  weapon: 'Weapons',
  helm: 'Helms',
  shield: 'Shields',
  body: 'Body Armor',
  gloves: 'Gloves',
  belt: 'Belts',
  boots: 'Boots',
  ring: 'Rings',
  amulet: 'Amulets',
};

export interface AnointmentGroup {
  readonly group: string;
  readonly label: string;
  /** Its item type pools, in bundle (cubemain) order */
  readonly slots: readonly AnointmentSlot[];
}

/** The anointment pools by equipment slot (ESR 3.3 has one pool per item type), groups in first-pool order */
export function anointmentGroups(slots: readonly AnointmentSlot[]): AnointmentGroup[] {
  const groups: { group: string; label: string; slots: AnointmentSlot[] }[] = [];
  for (const slot of slots) {
    const entry = groups.find((group) => group.group === slot.group);
    if (entry !== undefined) entry.slots.push(slot);
    else groups.push({ group: slot.group, label: ANOINTMENT_GROUP_LABELS[slot.group] ?? slot.group, slots: [slot] });
  }
  return groups;
}

/** The Vessel tab's completion section (tier param value) */
export const VESSEL_COMPLETION = 'completion';

export const QUALITY_LABELS: Record<EnhanceQuality, string> = {
  uni: 'Unique',
  set: 'Set',
  rar: 'Rare',
  crf: 'Crafted',
  mag: 'Magic',
  hiq: 'Superior',
  nor: 'Normal',
  low: 'Low Quality',
};

export interface EnhanceState {
  readonly tab: EnhanceTab;
  /** Corruption slot or anointment pool */
  readonly slot: string;
  /** Vessel tier number as text, or VESSEL_COMPLETION */
  readonly tier: string;
  readonly search: string;
}

const KEYS = {
  TAB: GAME_DATA_URL_PARAM_KEYS.TAB,
  SLOT: GAME_DATA_URL_PARAM_KEYS.SLOT,
  TIER: GAME_DATA_URL_PARAM_KEYS.TIER,
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
} as const;

/** The slots / pools / tiers the tab offers, first = default */
export function slotOptions(bundle: EnhanceBundle, tab: EnhanceTab): string[] {
  if (tab === 'corruption') return bundle.corruptionSlots.map((slot) => slot.slot);
  if (tab === 'anointment')
    return [...bundle.anointmentSlots.map((slot) => slot.slot), ...ANOINTMENT_EXTRA_POOLS.map((entry) => entry.pool)];
  return [];
}

export function tierOptions(bundle: EnhanceBundle): string[] {
  return [...bundle.vesselTiers.map((tier) => String(tier.tier)), VESSEL_COMPLETION];
}

/**
 * The anointment pool of an ESR 3.2 link's slot id (`slot=weapon`, `slot=body` …, one pool per slot then): the first
 * pool of the slot's group, as picking that slot does. Undefined for anything else.
 */
function legacyAnointmentPool(bundle: EnhanceBundle, slot: string): string | undefined {
  return bundle.anointmentSlots.find((entry) => entry.group === slot)?.slot;
}

/** URL → state; unknown values fall back to the tab's first option */
export function readEnhanceState(params: URLSearchParams, bundle: EnhanceBundle): EnhanceState {
  const tabParam = params.get(KEYS.TAB);
  const tab = ENHANCE_TABS.find((entry) => entry === tabParam) ?? 'corruption';
  const slots = slotOptions(bundle, tab);
  const slotParam = params.get(KEYS.SLOT) ?? '';
  const tiers = tierOptions(bundle);
  const tierParam = params.get(KEYS.TIER) ?? '';
  const slot = slots.includes(slotParam)
    ? slotParam
    : ((tab === 'anointment' ? legacyAnointmentPool(bundle, slotParam) : undefined) ?? slots.at(0) ?? '');
  return {
    tab,
    slot,
    tier: tiers.includes(tierParam) ? tierParam : (tiers[0] ?? ''),
    search: params.get(KEYS.SEARCH) ?? '',
  };
}

/** State → URL params; only what the tab uses and what differs from the defaults */
export function encodeEnhanceState(state: EnhanceState, bundle: EnhanceBundle): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab !== 'corruption') params.set(KEYS.TAB, state.tab);
  if (state.tab === 'vessel') {
    if (state.tier !== tierOptions(bundle)[0]) params.set(KEYS.TIER, state.tier);
  } else {
    const slots = slotOptions(bundle, state.tab);
    // Sanctification has no slots
    if (slots.length > 0 && state.slot !== slots[0]) params.set(KEYS.SLOT, state.slot);
  }
  if (state.search.trim() !== '') params.set(KEYS.SEARCH, state.search.trim());
  return params;
}

// --- search -------------------------------------------------------------------------------------------------------

function matchesTerms(texts: readonly string[], terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = texts.join('\n').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function filterCorruptionOutcomes(outcomes: readonly CorruptionOutcome[], search: string): CorruptionOutcome[] {
  const terms = parseSearchTerms(search);
  return outcomes.filter((outcome) =>
    matchesTerms([...outcome.lines, ...(outcome.variants ?? []).flatMap((variant) => variant.lines)], terms)
  );
}

export function filterAnointmentOutcomes(outcomes: readonly AnointmentOutcome[], search: string): AnointmentOutcome[] {
  const terms = parseSearchTerms(search);
  return outcomes.filter((outcome) => matchesTerms([outcome.label ?? '', ...outcome.lines], terms));
}

export function filterSanctificationOutcomes(outcomes: readonly SanctificationOutcome[], search: string): SanctificationOutcome[] {
  const terms = parseSearchTerms(search);
  return outcomes.filter((outcome) => matchesTerms(outcome.lines, terms));
}

export function filterVesselRecipes(recipes: readonly VesselRecipe[], search: string): VesselRecipe[] {
  const terms = parseSearchTerms(search);
  return recipes.filter((recipe) => matchesTerms([...recipe.materials.map((material) => material.name), ...recipe.lines], terms));
}

export function filterVesselTransforms(transforms: readonly VesselTransform[], search: string): VesselTransform[] {
  const terms = parseSearchTerms(search);
  return transforms.filter((transform) =>
    matchesTerms([...transform.materials.map((material) => material.name), transform.output.name], terms)
  );
}

// --- texts --------------------------------------------------------------------------------------------------------

/** 0.75 → "75%", 2/3 → "66.7%" */
export function formatRate(rate: number): string {
  return `${String(Math.round(rate * 1000) / 10)}%`;
}

export function qualityList(qualities: readonly EnhanceQuality[]): string {
  return joinWords(qualities.map((quality) => QUALITY_LABELS[quality]));
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

/** "2× Heart" or "Heart" */
export function materialText(material: VesselMaterial): string {
  return material.qty > 1 ? `${String(material.qty)}× ${material.name}` : material.name;
}

/**
 * Where a brick lands: the most common result, then the exceptions — qualities that keep their quality
 * ("Crafted stays Crafted") and more specific item rows ("Odd Charm → Rare Grand Charm").
 */
export function brickSummary(results: readonly CorruptionBrickResult[]): { main: string; exceptions: string[] } {
  const plain = results.filter((result) => result.type === null);
  const counts = new Map<string, number>();
  for (const result of plain) counts.set(result.result, (counts.get(result.result) ?? 0) + 1);
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const others = plain.filter((result) => result.result !== main);
  const kept = new Set(
    others.filter((result) => result.result === `${QUALITY_LABELS[result.quality]} item of the same type`).map((result) => result.quality)
  );
  const keeps = ENHANCE_QUALITIES.filter((quality) => kept.has(quality));
  const exceptions: string[] = [];
  if (keeps.length === 1) exceptions.push(`${qualityList(keeps)} stays ${qualityList(keeps)}`);
  else if (keeps.length > 1) exceptions.push(`${qualityList(keeps)} keep their quality`);
  for (const result of others) {
    if (!keeps.includes(result.quality)) exceptions.push(`${QUALITY_LABELS[result.quality]} → ${result.result}`);
  }
  for (const result of results) {
    if (result.type !== null) exceptions.push(`${result.typeName ?? result.type} → ${result.result}`);
  }
  return { main, exceptions };
}

/** Qualities that cannot be corrupted in a slot: neither outcome rows nor a roll row */
export function missingQualities(slot: CorruptionSlot): EnhanceQuality[] {
  return ENHANCE_QUALITIES.filter((quality) => !slot.qualities.includes(quality) && !slot.rollOnlyQualities.includes(quality));
}
