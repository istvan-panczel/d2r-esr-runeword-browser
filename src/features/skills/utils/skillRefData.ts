/**
 * The skill reference a skill name in an item line carries (see `skillRefs.ts`), and its `data-skill-ref` attribute
 * form. Kept free of imports: the app shell's peek layer reads the attribute without loading the skill data or the
 * calculator.
 */

/** Which item property template the line matched; `mention`: a skill named in other text (a weapon mastery effect) */
export type SkillRefKind = 'plus' | 'aura' | 'charges' | 'chance' | 'mention';

export interface SkillRef {
  /** skills.txt id (skilldetails.json id) */
  readonly id: string;
  readonly kind: SkillRefKind;
  /** The skill level the item gives (aura, charges, chance to cast) or the +levels (plus), as [min, max]; unused by mention */
  readonly level: readonly [number, number];
  /** chance: % chance to cast */
  readonly chance?: number;
  /** charges: the number of charges */
  readonly charges?: number;
  /** chance: the event as the line words it, lower case ("on striking", "when struck") */
  readonly event?: string;
}

/** The anchor attribute (`data-skill-ref`) that carries a reference */
export const SKILL_REF_ATTRIBUTE = 'data-skill-ref';
export const SKILL_REF_SELECTOR = `[${SKILL_REF_ATTRIBUTE}]`;

const KINDS: ReadonlySet<string> = new Set<SkillRefKind>(['plus', 'aura', 'charges', 'chance', 'mention']);

export function encodeSkillRef(ref: SkillRef): string {
  return JSON.stringify(ref);
}

function isLevel(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((entry) => Number.isInteger(entry));
}

function optionalInteger(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  return Number.isInteger(value) ? (value as number) : null;
}

/** The reference of an anchor attribute; null for anything that is not one */
export function decodeSkillRef(value: string | undefined): SkillRef | null {
  if (value === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { id, kind, level, chance, charges, event } = parsed as Record<string, unknown>;
  if (typeof id !== 'string' || typeof kind !== 'string' || !KINDS.has(kind) || !isLevel(level)) return null;
  const chanceValue = optionalInteger(chance);
  const chargesValue = optionalInteger(charges);
  if (chanceValue === null || chargesValue === null || (event !== undefined && typeof event !== 'string')) return null;
  return {
    id,
    kind: kind as SkillRefKind,
    level: [level[0], level[1]],
    ...(chanceValue === undefined ? {} : { chance: chanceValue }),
    ...(chargesValue === undefined ? {} : { charges: chargesValue }),
    ...(event === undefined ? {} : { event }),
  };
}
