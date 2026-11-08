/**
 * Links to the Mercenaries page, shared by the generator (mercenaries.json slugs) and the browser (the page's URL state,
 * the skill cards' "Used by mercenaries" links). Shared code: no imports, no DOM.
 *
 * The URL format is `/mercenaries?hireling=<slug>&type=<slug>&difficulty=<normal|nightmare|hell>&view=<cards|table>`,
 * every part optional. Other pages link to it, so keep it stable.
 */

export const MERCENARIES_PATH = '/mercenaries';
export const MERCENARIES_URL_PARAMS = { HIRELING: 'hireling', TYPE: 'type', DIFFICULTY: 'difficulty', VIEW: 'view' } as const;

export const MERCENARY_DIFFICULTIES = ['normal', 'nightmare', 'hell'] as const;
export type MercenaryDifficulty = (typeof MERCENARY_DIFFICULTIES)[number];

/** The official page's short type names (the Desert Mercenary rows) as the app shows them */
const TYPE_NAMES: Readonly<Partial<Record<string, string>>> = { Comb: 'Combat', Def: 'Defensive', Off: 'Offensive' };

/** "Desert Mercenary" → `desert-mercenary`, "Combat" → `combat` */
export function mercenarySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface MercenarySubtype {
  /** The page's type label: "Comb", "Elemental" */
  label: string;
  /** The type as the app shows it: "Combat", "Elemental" */
  name: string;
  /** The difficulty the row is for; null when the row covers all three */
  difficulty: MercenaryDifficulty | null;
}

/** The official page's subtype cell: "Comb - Nightmare", "Elemental" */
export function parseMercenarySubtype(subtype: string): MercenarySubtype {
  const [label = '', suffix = ''] = subtype.split(' - ').map((part) => part.trim());
  const difficulty = MERCENARY_DIFFICULTIES.find((entry) => entry === suffix.toLowerCase()) ?? null;
  return { label, name: TYPE_NAMES[label] ?? label, difficulty };
}

/** `/mercenaries?hireling=…[&type=…][&difficulty=…]` from the official page's hireling and subtype text */
export function mercenaryHref(hireling: string, subtype = ''): string {
  const params = new URLSearchParams({ [MERCENARIES_URL_PARAMS.HIRELING]: mercenarySlug(hireling) });
  if (subtype !== '') {
    const { name, difficulty } = parseMercenarySubtype(subtype);
    params.set(MERCENARIES_URL_PARAMS.TYPE, mercenarySlug(name));
    if (difficulty !== null) params.set(MERCENARIES_URL_PARAMS.DIFFICULTY, difficulty);
  }
  return `${MERCENARIES_PATH}?${params.toString()}`;
}
