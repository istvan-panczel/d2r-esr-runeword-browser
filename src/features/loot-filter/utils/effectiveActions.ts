/** The actions a rule ends up with (its style underneath) and what the editor's label preview shows. */
import { effectiveActions } from '../engine/actions';
import { DEFAULT_QUALITY_COLORS } from '../engine/colors';
import { isNamedList, namedToNumber } from '../engine/match';
import { EFFECT_KEYS } from '../engine/parse';
import { resolveText, splitColorRuns } from '../engine/text';
import { QUALITIES, type LootFilter, type LootFilterRule, type NamedMatch, type QualityName, type RuleActions } from '../engine/types';

export { effectiveActions, findStyle, mergeActions } from '../engine/actions';

/** The sample item name the preview puts in for `{name}`. */
const PREVIEW_ITEM_NAME = 'Item Name';

/** Replaces `{name}` with the sample name; every other placeholder stays as written. */
export function previewPlaceholders(text: string): string {
  return text.replaceAll('{name}', PREVIEW_ITEM_NAME);
}

/** The ground label text: prefix + (replaceName, else `{name}`) + suffix, in enUS, with `sample` in place of `{name}`. */
export function labelText(actions: RuleActions, sample: string): string {
  const text =
    (resolveText(actions.namePrefix) ?? '') + (resolveText(actions.replaceName) ?? '{name}') + (resolveText(actions.nameSuffix) ?? '');
  return text.replaceAll('{name}', sample);
}

/** The ground label text (`labelText`) with "Item Name" for `{name}`. */
export function previewLabelText(actions: RuleActions): string {
  return labelText(actions, PREVIEW_ITEM_NAME);
}

/** How many action keys are set (`comment` and unknown keys not counted). */
export function countActions(actions: RuleActions): number {
  return EFFECT_KEYS.filter((key) => actions[key] !== undefined).length;
}

/** How many rules pull in the style `name`. */
export function countStyleUsers(filter: LootFilter, name: string): number {
  return filter.rules.filter((rule) => rule.useStyle === name).length;
}

/** The quality numbers (1 = inferior … 9 = tempered) a `quality` condition allows; an unknown name allows none. */
function allowedQualities(match: NamedMatch<QualityName>): number[] {
  const toNumber = (value: string | number) => namedToNumber(value, QUALITIES, 1);
  if (typeof match === 'string' || typeof match === 'number') {
    const number = toNumber(match);
    return number === undefined ? [] : [number];
  }
  if (isNamedList(match)) return match.map(toNumber).filter((number) => number !== undefined);
  const min = match.min === undefined ? 1 : toNumber(match.min);
  const max = match.max === undefined ? QUALITIES.length : toNumber(match.max);
  if (min === undefined || max === undefined) return [];
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index);
}

/**
 * The colour code (the character after `ÿc`) the game names an item with when its label text has none: the quality's
 * label colour, when every quality the condition allows has the same one; else undefined (it depends on the item).
 */
export function qualityNameColor(quality: NamedMatch<QualityName> | undefined): string | undefined {
  if (quality === undefined) return undefined;
  const codes = new Set(
    allowedQualities(quality)
      .filter((number) => number >= 1 && number <= QUALITIES.length) // a number out of range names no quality
      .map((number) => DEFAULT_QUALITY_COLORS[QUALITIES[number - 1]].slice(2))
  );
  return codes.size === 1 ? [...codes][0] : undefined;
}

/**
 * The colour a rule's ground label starts in: the first colour code before any visible text of its label (with its
 * style), else the game's colour for the quality it matches (`qualityNameColor`); undefined when neither tells.
 */
export function ruleNameColor(rule: LootFilterRule, filter: LootFilter): string | undefined {
  const first = splitColorRuns(previewLabelText(effectiveActions(rule, filter))).find(
    (segment) => segment.kind === 'text' && segment.text.trim() !== ''
  );
  if (first?.kind === 'text' && first.color !== null) return first.color;
  return qualityNameColor(rule.quality);
}

/**
 * The colour a style's preview draws text without a colour code in: the one most of the rules pulling the style in
 * give the name (`ruleNameColor`; ties go to the earlier rule). A style rarely sets the name colour itself: the rules
 * rename the item (`ÿc1Ber Rune`) or match a quality the game colours (unique gold). Undefined when no rule tells.
 */
export function styleNameColor(filter: LootFilter, name: string): string | undefined {
  const counts = new Map<string, number>();
  for (const rule of filter.rules) {
    if (rule.useStyle !== name) continue;
    const color = ruleNameColor(rule, filter);
    if (color !== undefined) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
