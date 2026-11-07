import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import type { MasteriesBundle, MasteryEffect, MasteryInput, WeaponMastery } from '../engine/schema';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import type { ItemIconRef } from '../hooks/useItemIcons';

/** The guide note on weapon mastery (how to get a token, remove a mastery) */
export const MASTERY_GUIDE_PATH = '/guide/weapon-mastery';

/** A weapon mastery with the effects that name one skill */
export interface SkillMastery {
  readonly mastery: WeaponMastery;
  readonly effects: readonly MasteryEffect[];
}

export interface MasteryIndex {
  readonly bundle: MasteriesBundle;
  /** Base code → the masteries it can take (Orb, Claw, Void Blade: two) */
  readonly byBase: ReadonlyMap<string, readonly WeaponMastery[]>;
  /** Skill id → the masteries whose effects name it */
  readonly bySkill: ReadonlyMap<string, readonly SkillMastery[]>;
}

export function buildMasteryIndex(bundle: MasteriesBundle): MasteryIndex {
  const byBase = new Map<string, WeaponMastery[]>();
  const bySkill = new Map<string, SkillMastery[]>();
  for (const mastery of bundle.masteries) {
    for (const code of mastery.bases) byBase.set(code, [...(byBase.get(code) ?? []), mastery]);
    const skills = new Set(mastery.effects.flatMap((effect) => effect.skills));
    for (const id of skills) {
      const effects = mastery.effects.filter((effect) => effect.skills.includes(id));
      bySkill.set(id, [...(bySkill.get(id) ?? []), { mastery, effects }]);
    }
  }
  return { bundle, byBase, bySkill };
}

/** What the recipes call the awakened token (its item name, "Awakened Weapon Mastery Token", is long for a card line) */
export const AWAKENED_TOKEN_LABEL = 'Awakened token';

/** The apply recipe after the weapon: the awakened token, then the ingredients in cube order */
export function masteryRecipe(mastery: WeaponMastery, names: Readonly<Record<string, string>>): { item: ItemIconRef; text: string }[] {
  return [
    { item: { kind: 'item', code: mastery.token }, text: AWAKENED_TOKEN_LABEL },
    ...mastery.inputs.map((input) => ({ item: { kind: 'item', code: input.code } as const, text: inputText(input, names) })),
  ];
}

export function inputText(input: MasteryInput, names: Readonly<Record<string, string>>): string {
  const name = names[input.code] ?? input.code;
  return input.qty === undefined ? name : `${String(input.qty)}× ${name}`;
}

/**
 * The Bases page showing the mastery's weapon: an item type's bases (Orb, Claw, Void Blade) by the type filter, a base
 * family by its label (the cube rows name a family by its normal base: "Stag Bow").
 */
export function masteryBasesUrl(mastery: WeaponMastery): string {
  const params =
    mastery.type !== undefined
      ? new URLSearchParams({ [GAME_DATA_URL_PARAM_KEYS.TYPE]: mastery.type })
      : new URLSearchParams({ [FILTER_URL_PARAM_KEYS.SEARCH]: `"${mastery.label}"` });
  return `/game-data/bases?${params.toString()}`;
}

/** The skills line reads like the one skill it names ("Strafe"): the line itself is the link */
export function namesOneSkill(effect: MasteryEffect, skillNames: Readonly<Record<string, string>>): boolean {
  const [only] = effect.skills;
  return effect.skills.length === 1 && (skillNames[only] ?? only).toLowerCase() === effect.heading.toLowerCase();
}

/** The collapsed panel's line: the skills lines, "one of 2" when the weapon takes either of two masteries */
export function masterySummary(masteries: readonly WeaponMastery[]): string {
  const headings = [...new Set(masteries.flatMap((mastery) => mastery.effects.map((effect) => effect.heading)))];
  const list = headings.join(masteries.length > 1 ? ' or ' : ', ');
  return masteries.length > 1 ? `one of ${String(masteries.length)} (${list})` : list;
}
