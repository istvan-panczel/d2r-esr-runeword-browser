import type { ClassCode, MasteriesBundle, MasteryPageDiff, WeaponMastery } from '@/features/game-data/engine/schema';
import { MASTERIES_URL_PARAMS } from '@/features/game-data/utils/masteries';
import { CLASS_NAMES } from '@/features/skills/utils/skillRefs';
import { parseSearchTerms } from '@/core/utils/searchTerms';

/** The route path without the leading slash (buildShareUrl) */
export const MASTERIES_ROUTE = 'weapon-masteries';

/** The classes' order on the page: the game's (`CLASS_NAMES` order) */
const CLASS_ORDER = Object.keys(CLASS_NAMES) as ClassCode[];

export interface MasteryFamily {
  /** The awakened token: one per family */
  key: string;
  label: string;
  cls: ClassCode;
  /** Its specialisations: one, or two for Orb, Claw and Void Blade */
  options: readonly WeaponMastery[];
}

/** One card per awakened token, in cubemain order */
export function masteryFamilies(masteries: readonly WeaponMastery[]): MasteryFamily[] {
  const families = new Map<string, MasteryFamily>();
  for (const mastery of masteries) {
    const family = families.get(mastery.token);
    if (family === undefined) {
      families.set(mastery.token, { key: mastery.token, label: mastery.label, cls: mastery.cls, options: [mastery] });
    } else {
      families.set(mastery.token, { ...family, options: [...family.options, mastery] });
    }
  }
  return [...families.values()];
}

/** The classes that have families, in game order, each with its cards */
export function groupByClass(families: readonly MasteryFamily[]): { cls: ClassCode; families: MasteryFamily[] }[] {
  return CLASS_ORDER.flatMap((cls) => {
    const own = families.filter((family) => family.cls === cls);
    return own.length === 0 ? [] : [{ cls, families: own }];
  });
}

/**
 * What tells a family's options apart: the ingredient that is not in every option (Orb: "Chipped Ruby" or
 * "Chipped Skull"). Null for a family with one option.
 */
export function optionGem(option: WeaponMastery, family: MasteryFamily, names: Readonly<Record<string, string>>): string | null {
  if (family.options.length < 2) return null;
  const own = option.inputs.find((input) => !family.options.every((other) => other.inputs.some((entry) => entry.code === input.code)));
  return own === undefined ? null : (names[own.code] ?? own.code);
}

/** The class code of a URL or chip value; null when it names no class */
export function classCode(value: string | null): ClassCode | null {
  return CLASS_ORDER.find((code) => code === value) ?? null;
}

export interface MasteriesState {
  /** The class chip (`?cls=`), null for all */
  cls: ClassCode | null;
  /** The focused mastery (`?mastery=`), null when none */
  mastery: WeaponMastery | null;
  /** A `?cls=` or `?mastery=` value that names nothing (shown as a note), null when the URL is fine */
  unknown: string | null;
}

/**
 * The page state from the URL: `?cls=` is the class chip, `?mastery=<slug>` focuses a card. A class chip that would hide
 * the focused mastery is dropped, so a deep link always shows its card.
 */
export function readMasteriesState(params: URLSearchParams, bundle: Pick<MasteriesBundle, 'masteries'>): MasteriesState {
  const clsParam = params.get(MASTERIES_URL_PARAMS.CLS);
  const slug = params.get(MASTERIES_URL_PARAMS.MASTERY);
  const cls = classCode(clsParam);
  const mastery = slug === null ? undefined : bundle.masteries.find((entry) => entry.slug === slug);
  if (mastery !== undefined) return { cls: cls === mastery.cls ? cls : null, mastery, unknown: null };
  if (slug !== null) return { cls, mastery: null, unknown: slug };
  return { cls, mastery: null, unknown: clsParam !== null && cls === null ? clsParam : null };
}

/** `?cls=…&mastery=…`, each only when set */
export function masteriesParams(cls: ClassCode | null, mastery: string | null = null): URLSearchParams {
  const params = new URLSearchParams();
  if (cls !== null) params.set(MASTERIES_URL_PARAMS.CLS, cls);
  if (mastery !== null) params.set(MASTERIES_URL_PARAMS.MASTERY, mastery);
  return params;
}

/** DOM id of an option (a mastery link scrolls to it) */
export function masteryAnchor(slug: string): string {
  return `mastery-${slug}`;
}

/** What the search box looks through: the weapon, its bases, the skills lines and skills */
function searchText(family: MasteryFamily, bundle: Pick<MasteriesBundle, 'baseNames' | 'skillNames'>): string {
  const baseCodes = new Set(family.options.flatMap((option) => option.bases));
  const effects = family.options.flatMap((option) => option.effects);
  return [
    family.label,
    ...[...baseCodes].map((code) => bundle.baseNames[code] ?? code),
    ...effects.map((effect) => effect.heading),
    ...effects.flatMap((effect) => effect.skills.map((id) => bundle.skillNames[id] ?? id)),
  ]
    .join('\n')
    .toLowerCase();
}

/** The families of the class (all when null) matching the search box; a family matches when any option does */
export function filterFamilies(
  families: readonly MasteryFamily[],
  bundle: Pick<MasteriesBundle, 'baseNames' | 'skillNames'>,
  cls: ClassCode | null,
  search: string
): MasteryFamily[] {
  const terms = parseSearchTerms(search);
  return families.filter((family) => {
    if (cls !== null && family.cls !== cls) return false;
    if (terms.length === 0) return true;
    const text = searchText(family, bundle);
    return terms.every((term) => text.includes(term));
  });
}

/** The official page's differences about one option */
export function diffsForMastery(bundle: Pick<MasteriesBundle, 'pageDiffs'>, slug: string): MasteryPageDiff[] {
  return bundle.pageDiffs.filter((diff) => diff.mastery === slug);
}

/** A mods line and, for a mod the stat renderer gives no text, what the generator wrote about it */
export function modLine(mod: string): { text: string; note: string | null } {
  const match = /^(.+?) \(no item line; (.+)\)$/.exec(mod);
  return match === null ? { text: mod, note: null } : { text: match[1], note: match[2] };
}

const OTHER_BASE_LABELS = { lod: 'LoD copies', mythical: 'Mythicals (may not be obtainable)', other: 'Other' } as const;

/** The bases the apply rows take that the bundle does not list as bases, by kind, each named with its family */
export function otherBaseGroups(
  bundle: Pick<MasteriesBundle, 'masteries' | 'baseNames'>
): { label: string; bases: { code: string; name: string; family: string }[] }[] {
  const entries = bundle.masteries.flatMap((mastery) => (mastery.otherBases ?? []).map((base) => ({ base, family: mastery.label })));
  return (Object.keys(OTHER_BASE_LABELS) as (keyof typeof OTHER_BASE_LABELS)[]).flatMap((kind) => {
    const bases = entries
      .filter((entry) => entry.base.kind === kind)
      .map(({ base, family }) => ({ code: base.code, name: bundle.baseNames[base.code] ?? base.code, family }));
    return bases.length === 0 ? [] : [{ label: OTHER_BASE_LABELS[kind], bases }];
  });
}

/** The class weapons without apply rows, by class */
export function noMasteryGroups(bundle: Pick<MasteriesBundle, 'noMasteryBases' | 'baseNames'>): { cls: ClassCode; names: string[] }[] {
  return CLASS_ORDER.flatMap((cls) => {
    const names = bundle.noMasteryBases.filter((base) => base.cls === cls).map((base) => bundle.baseNames[base.code] ?? base.code);
    return names.length === 0 ? [] : [{ cls, names }];
  });
}
