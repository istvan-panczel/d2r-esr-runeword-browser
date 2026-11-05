/**
 * "Style first, then tweak": what picking a rule's style does, and where each action field's value comes from.
 *
 * The format's rule (engine/actions.ts `mergeActions`): a rule's own action wins over its style's, per key. So a rule
 * that already sets a background keeps it when it picks a style with another background, and the style seems not to
 * work. Picking a style therefore clears the rule's own values for the keys that style sets (`applyStyleChoice`), with
 * an exact undo; editing a field afterwards makes it the rule's own override again.
 */
import { EFFECT_KEYS } from '../engine/parse';
import type { LootFilter, LootFilterRule, LootFilterStyle, RuleActions } from '../engine/types';
import type { ShallowPatch } from './patch';
import { nameColorCode } from './ruleView';
import { presetStyleStatus, type StylePreset } from './stylePresets';

/** An action key a style can give a rule: every effect key but `useStyle` (a style cannot use another). */
export type StyleKey = Exclude<(typeof EFFECT_KEYS)[number], 'useStyle'>;

/** The style keys, in `RuleActions` order. */
export const STYLE_KEYS: readonly StyleKey[] = EFFECT_KEYS.filter((key): key is StyleKey => key !== 'useStyle');

/**
 * Where a field's value comes from on a rule: `own` (the rule sets it, the style does not), `style` (the style sets
 * it, the rule does not: the field shows the style's value), `changed` (both: the rule's own overrides the style's),
 * `none` (neither).
 */
export type ActionOrigin = 'own' | 'style' | 'changed' | 'none';

export function actionOrigin(own: RuleActions, style: RuleActions | undefined, key: StyleKey): ActionOrigin {
  const mine = own[key] !== undefined;
  const styles = style?.[key] !== undefined;
  if (mine && styles) return 'changed';
  if (mine) return 'own';
  return styles ? 'style' : 'none';
}

/** A value with its object keys sorted (arrays keep their order), for comparing action values regardless of key order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

/** True when two action values are the same (object key order ignored). */
export function sameActionValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * A rule editor patch with the style in mind: a key set to exactly the style's value is removed instead (the field
 * then shows the style's value again), so editing back to the style's value leaves no redundant override.
 */
export function collapseToStyle(patch: ShallowPatch<RuleActions>, style: RuleActions | undefined): ShallowPatch<RuleActions> {
  if (style === undefined) return patch;
  const styleValues = new Map<string, unknown>(Object.entries(style));
  const entries = Object.entries(patch).map(([key, value]: [string, unknown]) => {
    const styleValue = styleValues.get(key);
    return [key, value !== undefined && styleValue !== undefined && sameActionValue(value, styleValue) ? undefined : value] as const;
  });
  return Object.fromEntries(entries);
}

export interface StyleChoice {
  /** Removes the rule's own value of every key the style sets. */
  readonly patch: ShallowPatch<LootFilterRule>;
  /** The keys it removes, in `RuleActions` order. */
  readonly cleared: readonly StyleKey[];
}

/**
 * What picking `style` clears on a rule: its own value of each key the style sets (keys the style leaves free stay),
 * a wrong-shaped one kept in `passthrough` too (it is written back to the file, where it would still be the rule's own
 * value, while the field shows the style's).
 */
export function applyStyleChoice(rule: LootFilterRule, style: RuleActions | undefined): StyleChoice {
  const passthrough = rule.passthrough ?? {};
  const own = (key: StyleKey) => rule[key] !== undefined || Object.hasOwn(passthrough, key);
  const cleared = style === undefined ? [] : STYLE_KEYS.filter((key) => own(key) && style[key] !== undefined);
  return { patch: Object.fromEntries(cleared.map((key) => [key, undefined])), cleared };
}

/** What the user picked in the rule's Style dropdown. */
export type StyleTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'style'; readonly name: string }
  | { readonly kind: 'preset'; readonly preset: Pick<StylePreset, 'name' | 'style'> };

/** The `chooseRuleStyle` store payload, without the rule index. */
export interface StyleChoiceEdit {
  /** Shallow patch of the rule: `useStyle` and the cleared keys. */
  readonly patch: ShallowPatch<LootFilterRule>;
  /** A style to add to the filter's `styles` when it has none of that name (a picked preset). */
  readonly addStyle?: { readonly name: string; readonly style: LootFilterStyle };
  /** A style to remove when no rule uses it any more (the undo of an added preset). */
  readonly removeStyleIfUnused?: string;
  /** Applies only while the rule's `useStyle` is this (the undo checks the rule still uses what was picked). */
  readonly ifUseStyle?: { readonly value: string | undefined };
}

export interface StyleChoicePlan {
  readonly apply: StyleChoiceEdit;
  readonly undo: StyleChoiceEdit;
  /** The rule's own keys the choice removes. */
  readonly cleared: readonly StyleKey[];
  /** The picked style's name (undefined for None). */
  readonly styleName: string | undefined;
  /**
   * For a preset: `added` (copied into the filter), `same` (an identical style of that name is there), `kept` (the
   * filter has a different style of that name: it is used, never overwritten). Undefined for None or a filter style.
   */
  readonly preset?: 'added' | 'same' | 'kept';
}

/**
 * The edit that picking `target` makes on `rule`, and its exact undo (one patch each): `useStyle` is set, the rule's own
 * values of the keys the style sets are removed, a picked preset the filter lacks is added. The undo restores the
 * removed values (and a wrong-shaped original kept in `passthrough`) and removes the added preset unless another rule
 * uses it by then.
 */
export function planStyleChoice(rule: LootFilterRule, filter: LootFilter, target: StyleTarget): StyleChoicePlan {
  const styles = filter.styles ?? {};
  let styleName: string | undefined;
  let style: LootFilterStyle | undefined;
  let preset: StyleChoicePlan['preset'];
  let addStyle: StyleChoiceEdit['addStyle'];
  if (target.kind === 'style') {
    styleName = target.name;
    style = Object.hasOwn(styles, target.name) ? styles[target.name] : undefined;
  } else if (target.kind === 'preset') {
    styleName = target.preset.name;
    const status = presetStyleStatus(styles, target.preset);
    if (status === 'missing') {
      preset = 'added';
      style = target.preset.style;
      addStyle = { name: styleName, style };
    } else {
      preset = status === 'same' ? 'same' : 'kept';
      style = styles[styleName];
    }
  }

  const { patch: clearPatch, cleared } = applyStyleChoice(rule, style);
  const patch: ShallowPatch<LootFilterRule> = { ...clearPatch, useStyle: styleName };
  const restored: Record<string, unknown> = Object.fromEntries(cleared.map((key) => [key, rule[key]]));
  restored.useStyle = rule.useStyle;
  // `applyPatch` drops a patched key from `passthrough` too: give the original back when the patch touched one.
  const passthrough = rule.passthrough;
  if (passthrough !== undefined && Object.keys(patch).some((key) => key in passthrough)) restored.passthrough = passthrough;
  const undo: StyleChoiceEdit = {
    patch: restored,
    ifUseStyle: { value: styleName },
    ...(addStyle === undefined ? {} : { removeStyleIfUnused: addStyle.name }),
  };
  return { apply: { patch, ...(addStyle === undefined ? {} : { addStyle }) }, undo, cleared, styleName, preset };
}

const KEY_LABELS: Readonly<Record<StyleKey, string>> = {
  hide: 'hide',
  hideIfOtherConditionsFail: 'hide if other conditions fail',
  replaceName: 'name',
  namePrefix: 'name prefix',
  nameSuffix: 'name suffix',
  labelBackground: 'background',
  labelBorder: 'border',
  chatMessage: 'chat line',
  chatMessageWhenHidden: 'chat line when hidden',
  notify: 'notify',
  sound: 'sound',
  soundVolume: 'sound volume',
  icon: 'minimap icon',
  droplight: 'droplight',
};

/** A field's name in messages: `name colour` for a replaceName that only recolours the name. */
export function styleKeyLabel(key: StyleKey, actions?: RuleActions): string {
  if (key === 'replaceName' && nameColorCode(actions?.replaceName) !== undefined) return 'name colour';
  return KEY_LABELS[key];
}

/** "a", "a and b", "a, b and c". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

/** The toast after a style choice, or null when it changed nothing worth saying (no key cleared, no preset added). */
export function styleChoiceMessage(
  plan: StyleChoicePlan,
  rule: RuleActions
): { readonly title: string; readonly description?: string } | null {
  const cleared =
    plan.cleared.length === 0
      ? undefined
      : `Cleared this rule's own ${joinWords(plan.cleared.map((key) => styleKeyLabel(key, rule)))} so the style shows.`;
  const name = plan.styleName ?? '';
  if (plan.preset === 'added') return { title: `Added the style ${name}`, description: cleared };
  if (plan.preset === 'kept')
    return { title: `The filter already has a style named ${name}`, description: cleared ?? 'Your style is used as it is.' };
  return cleared === undefined ? null : { title: cleared };
}
