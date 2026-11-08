import type {
  MercenariesBundle,
  MercenaryBand,
  MercenaryHireling,
  MercenarySkill,
  MercenaryType,
  MercenaryVariant,
} from '@/features/game-data/engine/schema';
import { MERCENARIES_URL_PARAMS, MERCENARY_DIFFICULTIES, type MercenaryDifficulty } from '@/features/game-data/engine/mercenaryLinks';

/** The route path without the leading slash (buildShareUrl) */
export const MERCENARIES_ROUTE = 'mercenaries';
/** The guide note about mercenaries (`/guide/<slug>`) */
export const MERCENARIES_GUIDE_PATH = '/guide/mercenaries-oskills';

export type MercenariesViewMode = 'cards' | 'table';

export const MERCENARY_DIFFICULTY_LABELS: Readonly<Record<MercenaryDifficulty, string>> = {
  normal: 'Normal',
  nightmare: 'Nightmare',
  hell: 'Hell',
};

/** The difficulty the card view shows when the URL names none */
export const DEFAULT_CARD_DIFFICULTY: MercenaryDifficulty = 'normal';

/** Shown wherever the weapon rules appear: they are the base game's, nothing in the ESR files states them */
export const VANILLA_WEAPONS_NOTE = 'Vanilla D2R rules, not confirmed for ESR';

/** The weapons each hireling can use in the base game, by hireling slug */
export const VANILLA_WEAPONS: Readonly<Partial<Record<string, string>>> = {
  'rogue-scout': 'Bows',
  'desert-mercenary': 'Polearms and spears',
  'eastern-sorcerer': 'Swords and shields',
  barbarian: 'Swords',
};

/** The set made for each hireling, by hireling slug (sets.json repeats it per difficulty under one name) */
export const HIRELING_SETS: Readonly<Partial<Record<string, string>>> = {
  'rogue-scout': "Kashya's Survival Kit",
  'desert-mercenary': "Greiz's Desert Pride",
  'eastern-sorcerer': "Asheara's Iron Wolf Division",
  barbarian: "Qual-Kehk's Barbaric Gear",
};

export interface MercenariesState {
  view: MercenariesViewMode;
  /** `?difficulty=`; null when the URL names none (the table then lists every variant, the cards show Normal) */
  difficulty: MercenaryDifficulty | null;
  hireling: MercenaryHireling | null;
  type: MercenaryType | null;
  /** A `?hireling=`, `?type=` or `?difficulty=` value that names nothing (shown as a note), null when the URL is fine */
  unknown: string | null;
}

/** The page state from the URL. A `?type=` needs a `?hireling=`: two hirelings have a Defensive type. */
export function readMercenariesState(params: URLSearchParams, bundle: MercenariesBundle): MercenariesState {
  const view: MercenariesViewMode = params.get(MERCENARIES_URL_PARAMS.VIEW) === 'table' ? 'table' : 'cards';
  const hirelingSlug = params.get(MERCENARIES_URL_PARAMS.HIRELING);
  const typeSlug = params.get(MERCENARIES_URL_PARAMS.TYPE);
  const difficultyParam = params.get(MERCENARIES_URL_PARAMS.DIFFICULTY);
  const difficulty = MERCENARY_DIFFICULTIES.find((entry) => entry === difficultyParam) ?? null;
  const hireling = bundle.hirelings.find((entry) => entry.slug === hirelingSlug) ?? null;
  const type = hireling?.types.find((entry) => entry.slug === typeSlug) ?? null;

  let unknown: string | null = null;
  if (hirelingSlug !== null && hireling === null) unknown = hirelingSlug;
  else if (typeSlug !== null && type === null) unknown = typeSlug;
  else if (difficultyParam !== null && difficulty === null) unknown = difficultyParam;
  return { view, difficulty, hireling, type, unknown };
}

export interface MercenariesQuery {
  view: MercenariesViewMode;
  difficulty: MercenaryDifficulty | null;
  hireling: string | null;
  type: string | null;
}

/** The current state as query values (slugs), for building links that change one of them */
export function mercenariesQuery(state: MercenariesState): MercenariesQuery {
  return { view: state.view, difficulty: state.difficulty, hireling: state.hireling?.slug ?? null, type: state.type?.slug ?? null };
}

/** `?hireling=…&type=…&difficulty=…&view=table`; empty values and the default card view are left out */
export function mercenariesParams(query: MercenariesQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.hireling !== null) params.set(MERCENARIES_URL_PARAMS.HIRELING, query.hireling);
  if (query.hireling !== null && query.type !== null) params.set(MERCENARIES_URL_PARAMS.TYPE, query.type);
  if (query.difficulty !== null) params.set(MERCENARIES_URL_PARAMS.DIFFICULTY, query.difficulty);
  if (query.view !== 'cards') params.set(MERCENARIES_URL_PARAMS.VIEW, query.view);
  return params;
}

export interface MercenaryGold {
  difficulty: MercenaryDifficulty;
  gold: number;
}

/** A variant cut down to what one difficulty (or, with null, every difficulty) offers */
export interface MercenaryVariantView {
  gold: MercenaryGold[];
  bands: MercenaryBand[];
  skills: MercenarySkill[];
}

/** The gold, bands and aligned skill levels of a variant at a difficulty; null when it is not offered there. */
export function variantView(variant: MercenaryVariant, difficulty: MercenaryDifficulty | null): MercenaryVariantView | null {
  if (difficulty === null) {
    return {
      gold: variant.offers.map((offer) => ({ difficulty: offer.difficulty, gold: offer.gold })),
      bands: variant.bands,
      skills: variant.skills,
    };
  }
  const offer = variant.offers.find((entry) => entry.difficulty === difficulty);
  if (offer === undefined) return null;
  const kept = variant.bands.flatMap((band, index) => (offer.levels.includes(band.level) ? [{ band, index }] : []));
  return {
    gold: [{ difficulty, gold: offer.gold }],
    bands: kept.map((entry) => entry.band),
    skills: variant.skills.map((skill) => ({ ...skill, levels: kept.flatMap((entry) => skill.levels.at(entry.index) ?? []) })),
  };
}

export interface MercenaryCardEntry {
  hireling: MercenaryHireling;
  type: MercenaryType;
  view: MercenaryVariantView | null;
}

/** The hirelings and types the `?hireling=` / `?type=` filters keep */
function selectedTypes(bundle: MercenariesBundle, state: MercenariesState): { hireling: MercenaryHireling; type: MercenaryType }[] {
  return bundle.hirelings
    .filter((hireling) => state.hireling === null || hireling.slug === state.hireling.slug)
    .flatMap((hireling) =>
      hireling.types.filter((type) => state.type === null || type.slug === state.type.slug).map((type) => ({ hireling, type }))
    );
}

/** One card per hireling and type at the state's difficulty (Normal when the URL names none) */
export function mercenaryCards(bundle: MercenariesBundle, state: MercenariesState): MercenaryCardEntry[] {
  const difficulty = state.difficulty ?? DEFAULT_CARD_DIFFICULTY;
  return selectedTypes(bundle, state).map(({ hireling, type }) => {
    const variant = type.variants.find((entry) => entry.offers.some((offer) => offer.difficulty === difficulty));
    return { hireling, type, view: variant === undefined ? null : variantView(variant, difficulty) };
  });
}

export interface MercenaryTableRow {
  key: string;
  hireling: MercenaryHireling;
  type: MercenaryType;
  /** The page's row is for this difficulty; null when it covers all three */
  difficulty: MercenaryDifficulty | null;
  view: MercenaryVariantView;
}

/** One row per variant: all 16 without a difficulty, otherwise the ones offered at that difficulty, cut down to it */
export function mercenaryTableRows(bundle: MercenariesBundle, state: MercenariesState): MercenaryTableRow[] {
  return selectedTypes(bundle, state).flatMap(({ hireling, type }) =>
    type.variants.flatMap((variant) => {
      const view = variantView(variant, state.difficulty);
      if (view === null) return [];
      return [{ key: `${hireling.slug}/${variant.subtype}`, hireling, type, difficulty: variant.difficulty, view }];
    })
  );
}

/** 1500 → "1,500" */
export function goldText(gold: number): string {
  return gold.toLocaleString('en-US');
}

/** "20", or "F 20 / C 25 / L 30 / P 35" when the four differ */
export function resistsText({ resists }: Pick<MercenaryBand, 'resists'>): string {
  const { fire, cold, lightning, poison } = resists;
  if (fire === cold && cold === lightning && lightning === poison) return String(fire);
  return `F ${String(fire)} / C ${String(cold)} / L ${String(lightning)} / P ${String(poison)}`;
}

/** "3–7" */
export function damageText({ damage }: Pick<MercenaryBand, 'damage'>): string {
  return `${String(damage[0])}–${String(damage[1])}`;
}

export function hasDexterityTypo(bands: readonly MercenaryBand[]): boolean {
  return bands.some((band) => band.dexterityTypo === true);
}
