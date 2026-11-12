/**
 * Where the main Add rule button puts a new rule (docs/features/LOOT-FILTER.md "Custom rules in Protection"), and what
 * the editor tells the user about it: the badge on the Protection part, the toast after Add rule and the notice when an
 * edit changes the destination.
 */
import type { LootFilter } from '../engine/types';
import { findPartSection, type CommentAddress, type PartSection } from './sections';

/**
 * Sully's request: the section "Custom rules" of the part "Protection", created at the end of the part when missing.
 * Protection runs before every hide rule, so the new rule shows (`show`).
 */
export const CUSTOM_RULES_PLACE: PartSection = {
  part: 'Protection',
  section: 'Custom rules',
  description: 'Your own rules. Show keeps them from being hidden by the hide rules below.',
};

export type AddRuleTargetKind = 'custom' | 'selected';

export type AddRuleTarget =
  /** Into Protection › Custom rules with Show; `section`: that section is there, or Add rule creates it. */
  | {
      readonly kind: 'custom';
      readonly section: 'existing' | 'created';
      /** The Protection part's heading line, as its heading row's `address`. */
      readonly part: CommentAddress;
    }
  /** No Protection part: an empty rule after the selected rule, else at the end. */
  | { readonly kind: 'selected' };

/** Where Add rule puts a new rule in `filter` (`addCustomRule`). */
export function addRuleTarget(filter: LootFilter): AddRuleTarget {
  const found = findPartSection(
    { items: filter.rules, end: filter.rulesEndComments ?? [] },
    { get: (rule) => rule.commentsBefore },
    CUSTOM_RULES_PLACE
  );
  if (found === undefined) return { kind: 'selected' };
  return { kind: 'custom', section: found.section === undefined ? 'created' : 'existing', part: found.part };
}

const PLACE = `${CUSTOM_RULES_PLACE.part} › ${CUSTOM_RULES_PLACE.section}`;

/** The badge on the Protection part's heading row: short enough for a phone, readable without its tooltip. */
export const CUSTOM_RULES_BADGE = 'New rules go here';

/** The badge's tooltip and accessible description. */
export const CUSTOM_RULES_BADGE_DESCRIPTION = `Add rule puts new rules here, in ${CUSTOM_RULES_PLACE.section}, with Show: the hide rules below can't hide them.`;

/** The main Add rule button's tooltip when the target is custom. */
export const ADD_CUSTOM_RULE_TITLE = `Adds a rule at the end of ${PLACE}, with Show: the hide rules below can't hide it.`;

/** The toast after an Add rule that landed in Protection (`target` as it was before the add); none otherwise. */
export function addedRuleToast(target: AddRuleTarget): { readonly message: string; readonly description?: string } | undefined {
  if (target.kind !== 'custom') return undefined;
  return {
    message: `Added to ${PLACE} with Show: the hide rules below can't hide it.`,
    description:
      target.section === 'created' ? `${CUSTOM_RULES_PLACE.section} is a new section at the end of ${CUSTOM_RULES_PLACE.part}.` : undefined,
  };
}

/** The open filter and its Add rule target kind, as the editor screen last saw them. */
export interface AddRuleTargetSnapshot {
  /** Identifies the open filter: another value is another filter (opening or switching one never notices). */
  readonly filterKey: string;
  readonly kind: AddRuleTargetKind;
}

/**
 * The notice for a change of the Add rule target by an edit of the same open filter (JSON Apply, a heading renamed or
 * removed, an AI import, a template update), or undefined: nothing before (first load), another filter, the same kind
 * (Custom rules created by Add rule stays custom).
 */
export function addRuleTargetNotice(previous: AddRuleTargetSnapshot | null, current: AddRuleTargetSnapshot | null): string | undefined {
  if (previous === null || current === null || previous.filterKey !== current.filterKey || previous.kind === current.kind) return undefined;
  return current.kind === 'custom'
    ? `New rules now go to ${PLACE}, with Show.`
    : `This filter has no ${CUSTOM_RULES_PLACE.part} part any more: Add rule puts new rules after the selected rule, without Show.`;
}
