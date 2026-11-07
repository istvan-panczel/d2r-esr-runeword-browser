import type {
  SpecializationPerk,
  SpecializationRules,
  SpecializationsBundle,
  SpecializationTree,
} from '@/features/game-data/engine/schema';
import { SPECIALIZATIONS_URL_PARAMS } from '@/features/game-data/engine/specializationLinks';

/** The route path without the leading slash (buildShareUrl) */
export const SPECIALIZATIONS_ROUTE = 'specializations';
/** The guide note about the system (written by the guide; `/guide/<slug>`) */
export const SPECIALIZATIONS_GUIDE_PATH = '/guide/specializations';

export interface SpecializationsState {
  tree: SpecializationTree;
  /** The focused perk (`?perk=`), null when none */
  perk: SpecializationPerk | null;
  /** A `?tree=` or `?perk=` value that names nothing (shown as a note), null when the URL is fine */
  unknown: string | null;
}

/**
 * The page state from the URL: `?tree=<slug>` picks the tab (the first tree by default), `?perk=<slug>` focuses a
 * perk of that tree; a perk link without a tree (or with the wrong one) opens the tree that has the perk. Null when
 * the bundle has no trees.
 */
export function readSpecializationsState(params: URLSearchParams, bundle: SpecializationsBundle): SpecializationsState | null {
  const first = bundle.trees.at(0);
  if (first === undefined) return null;
  const treeSlug = params.get(SPECIALIZATIONS_URL_PARAMS.TREE);
  const perkSlug = params.get(SPECIALIZATIONS_URL_PARAMS.PERK);
  const named = treeSlug === null ? undefined : bundle.trees.find((tree) => tree.slug === treeSlug);
  if (perkSlug !== null) {
    const owners = bundle.trees.filter((tree) => tree.perks.some((perk) => perk.slug === perkSlug));
    const tree = owners.find((owner) => owner === named) ?? owners.at(0);
    const perk = tree?.perks.find((entry) => entry.slug === perkSlug);
    if (tree !== undefined && perk !== undefined) return { tree, perk, unknown: null };
    return { tree: named ?? first, perk: null, unknown: perkSlug };
  }
  if (treeSlug !== null && named === undefined) return { tree: first, perk: null, unknown: treeSlug };
  return { tree: named ?? first, perk: null, unknown: null };
}

/** `?tree=…[&perk=…]` */
export function specializationsParams(tree: string, perk: string | null = null): URLSearchParams {
  const params = new URLSearchParams({ [SPECIALIZATIONS_URL_PARAMS.TREE]: tree });
  if (perk !== null) params.set(SPECIALIZATIONS_URL_PARAMS.PERK, perk);
  return params;
}

/** DOM id of a perk card */
export function perkAnchor(perk: string): string {
  return `perk-${perk}`;
}

export interface TokenPoints {
  /** First character level of the band */
  from: number;
  /** Last level of the band; null for the open-ended last band */
  to: number | null;
  points: number;
}

/**
 * The points a Tesseract gives by the level it is used at: the unlock points plus one per point level already reached,
 * capped at the maximum (`token.levels` read from its formula; the config's `pointLevels` when the formula gave none).
 */
export function tokenPointsByLevel(rules: SpecializationRules): TokenPoints[] {
  const levels = [...(rules.token.levels.length > 0 ? rules.token.levels : rules.pointLevels)].sort((a, b) => a - b);
  const cap = (points: number) => (rules.maxPoints > 0 ? Math.min(points, rules.maxPoints) : points);
  const bands: TokenPoints[] = [];
  let from = 1;
  for (const [i, level] of levels.entries()) {
    if (level > from) bands.push({ from, to: level - 1, points: cap(rules.unlockPoints + i) });
    from = level;
  }
  bands.push({ from, to: null, points: cap(rules.unlockPoints + levels.length) });
  return bands;
}

/** 0.05 → "5%", 0.0025 → "0.25%", 0.2353 → "23.5%" */
export function percentText(share: number): string {
  const value = share * 100;
  const digits = value >= 10 ? 1 : value >= 1 ? 2 : 3;
  return `${String(Number(value.toFixed(digits)))}%`;
}

/** A plugin setting as written in the config (`chance_percent = 25`, `item_types = weap, armo`) */
export function settingText({ key, value }: { key: string; value: number | boolean | string }): string {
  return `${key} = ${String(value)}`;
}
