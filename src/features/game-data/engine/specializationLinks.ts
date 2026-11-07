/**
 * Links to the Specializations page, shared by the generator (specializations.json slugs) and the browser (the page's
 * URL state, the Cube page's perk conditions). Shared code: no imports, no DOM.
 *
 * The URL format is `/specializations?tree=<tree slug>&perk=<perk slug>`, slugs being the lower-case kebab form of the
 * English names (`?tree=alchemist&perk=hidden-elixirs`). Other pages and the guide link to it, so keep it stable.
 */

export const SPECIALIZATIONS_PATH = '/specializations';
export const SPECIALIZATIONS_URL_PARAMS = { TREE: 'tree', PERK: 'perk' } as const;

/** "Looter’s Rush" → `looters-rush`, "Six Peas in a Pod" → `six-peas-in-a-pod` */
export function specializationSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `/specializations?tree=…&perk=…` from the English names (or slugs); the perk is optional */
export function specializationHref(tree: string, perk?: string): string {
  const params = new URLSearchParams({ [SPECIALIZATIONS_URL_PARAMS.TREE]: specializationSlug(tree) });
  if (perk !== undefined) params.set(SPECIALIZATIONS_URL_PARAMS.PERK, specializationSlug(perk));
  return `${SPECIALIZATIONS_PATH}?${params.toString()}`;
}

/** A perk check as the Cube page words it (`build/cube/perks.ts` perkCheckText) */
export interface PerkMention {
  /** "Needs the " / "Only without the " */
  prefix: string;
  tree: string;
  title: string;
  /** " (some variants)" or "" */
  suffix: string;
}

const PERK_CHECK = /^(Needs the |Only without the )([A-Z][A-Za-z]+) perk (.+?)( \(some variants\))?$/;

/** "Needs the Jeweler perk Steady Pliers" → its parts; null for any other condition */
export function parsePerkCheck(condition: string): PerkMention | null {
  const match = PERK_CHECK.exec(condition);
  if (match === null) return null;
  return { prefix: match[1], tree: match[2], title: match[3], suffix: match.at(4) ?? '' };
}
