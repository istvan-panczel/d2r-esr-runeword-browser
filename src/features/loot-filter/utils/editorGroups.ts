/**
 * The rule editor's foldable groups: which keys each condition and action group edits, whether a rule or style uses a
 * group (its groups in use start open, the others folded), the one-line summary each folded header shows, and the
 * items-first start of a blank rule (only "Which items" until a condition is set).
 */
import { COLOR_CODES } from '../engine/colors';
import { resolveText, splitColorRuns } from '../engine/text';
import type { Diagnostic, FilterText, LabelColor, LootFilterRule, LootFilterStyle, RuleActions, RuleConditions } from '../engine/types';
import type { LootFilterLookup } from './lookup';
import { levelsBadge, locationBadge, plainText, ruleConditionSummary } from './ruleSummary';
import { diagnosticKeys, nameColorCode } from './ruleView';

export type ConditionGroup = 'items' | 'properties' | 'stats' | 'whereWhen';
export type ActionGroup = 'style' | 'visibility' | 'name' | 'label' | 'chat' | 'sound' | 'icon' | 'droplight' | 'notes';

/** The rule editor's condition groups in order, with their titles. */
export const CONDITION_GROUPS: readonly { readonly id: ConditionGroup; readonly title: string }[] = [
  { id: 'items', title: 'Which items' },
  { id: 'properties', title: 'Item properties' },
  { id: 'stats', title: 'Stats' },
  { id: 'whereWhen', title: 'Where and when' },
];

/** The actions editor's groups in order, with their titles (Notes is the Styles tab's: a rule's comment is above). */
export const ACTION_GROUPS: readonly { readonly id: ActionGroup; readonly title: string }[] = [
  { id: 'style', title: 'Style' },
  { id: 'visibility', title: 'Visibility' },
  { id: 'name', title: 'Name' },
  { id: 'label', title: 'Label' },
  { id: 'chat', title: 'Chat' },
  { id: 'sound', title: 'Sound' },
  { id: 'icon', title: 'Minimap icon' },
  { id: 'droplight', title: 'Droplight' },
  { id: 'notes', title: 'Notes' },
];

/** The group of every condition key. `satisfies` makes a new key pick a group. */
export const CONDITION_GROUP_OF = {
  itemCodes: 'items',
  excludeItemCodes: 'items',
  itemTypes: 'items',
  excludeItemTypes: 'items',
  uniqueOrSetIds: 'items',
  excludeUniqueOrSetIds: 'items',
  quality: 'properties',
  baseTier: 'properties',
  itemLevel: 'properties',
  sockets: 'properties',
  maxSockets: 'properties',
  isEthereal: 'properties',
  isRuneword: 'properties',
  isIdentified: 'properties',
  isFullySocketed: 'properties',
  itemStats: 'stats',
  itemStatsAnyOf: 'stats',
  playerStats: 'stats',
  playerStatsAnyOf: 'stats',
  formula: 'stats',
  areas: 'whereWhen',
  excludeAreas: 'whereWhen',
  location: 'whereWhen',
  activeInLevels: 'whereWhen',
  difficulty: 'whereWhen',
} as const satisfies Record<keyof RuleConditions, ConditionGroup>;

/** The group of every action key (a rule's comment is edited above the conditions; a style's under Notes). */
export const ACTION_GROUP_OF = {
  useStyle: 'style',
  hide: 'visibility',
  show: 'visibility',
  hideIfOtherConditionsFail: 'visibility',
  chatMessageWhenHidden: 'visibility',
  replaceName: 'name',
  namePrefix: 'name',
  nameSuffix: 'name',
  labelBackground: 'label',
  labelBorder: 'label',
  chatMessage: 'chat',
  notify: 'chat',
  sound: 'sound',
  soundVolume: 'sound',
  icon: 'icon',
  droplight: 'droplight',
  comment: 'notes',
} as const satisfies Record<keyof RuleActions, ActionGroup>;

const CONDITION_KEYS = Object.keys(CONDITION_GROUP_OF) as (keyof RuleConditions)[];
const ACTION_KEYS = Object.keys(ACTION_GROUP_OF) as (keyof RuleActions)[];

/** The keys of one group, in the file's order. */
export function conditionGroupKeys(group: ConditionGroup): readonly (keyof RuleConditions)[] {
  return CONDITION_KEYS.filter((key) => CONDITION_GROUP_OF[key] === group);
}

export function actionGroupKeys(group: ActionGroup): readonly (keyof RuleActions)[] {
  return ACTION_KEYS.filter((key) => ACTION_GROUP_OF[key] === group);
}

/** Which groups a rule or style uses, and which of them carry a diagnostic (those must be open). */
export interface GroupUsage<G extends string> {
  readonly inUse: ReadonlySet<G>;
  readonly flagged: ReadonlySet<G>;
}

function usage<G extends string>(
  keys: readonly string[],
  groupOf: Readonly<Record<string, G>>,
  isSet: (key: string) => boolean,
  flaggedKeys: ReadonlySet<string>
): GroupUsage<G> {
  const inUse = new Set<G>();
  const flagged = new Set<G>();
  for (const key of keys) {
    const group = groupOf[key];
    if (flaggedKeys.has(key)) {
      flagged.add(group);
      inUse.add(group);
    } else if (isSet(key)) inUse.add(group);
  }
  return { inUse, flagged };
}

const ownValue = (owner: object, key: string) => (owner as Readonly<Record<string, unknown>>)[key];

/**
 * The condition groups a rule uses: a key with a value, a wrong-shaped one (passthrough) or a diagnostic. A group with
 * a diagnostic is also `flagged`.
 */
export function conditionGroupUsage(rule: LootFilterRule, diagnostics: readonly Diagnostic[] = []): GroupUsage<ConditionGroup> {
  const passthrough = rule.passthrough ?? {};
  return usage(
    CONDITION_KEYS,
    CONDITION_GROUP_OF,
    (key) => ownValue(rule, key) !== undefined || key in passthrough,
    diagnosticKeys(diagnostics)
  );
}

interface ActionUsageInput {
  /** The rule or style whose actions are edited (its `passthrough` holds wrong-shaped values). */
  readonly actions: LootFilterRule | LootFilterStyle;
  /** A rule's style (`findStyle`): a key it sets puts its group in use (its value shows in the field). */
  readonly style?: RuleActions;
  /** The rule's or style's own diagnostics. */
  readonly diagnostics?: readonly Diagnostic[];
  /** `style`: the Styles tab, whose comment is a Notes field; a rule's comment is not an action group. */
  readonly owner: 'rule' | 'style';
}

/** The action groups a rule or style uses: its own keys, its style's, wrong-shaped values and diagnostics. */
export function actionGroupUsage({ actions, style, diagnostics = [], owner }: ActionUsageInput): GroupUsage<ActionGroup> {
  const passthrough = actions.passthrough ?? {};
  const keys = owner === 'rule' ? ACTION_KEYS.filter((key) => key !== 'comment') : ACTION_KEYS.filter((key) => key !== 'useStyle');
  return usage(
    keys,
    ACTION_GROUP_OF,
    (key) =>
      ownValue(actions, key) !== undefined ||
      key in passthrough ||
      (owner === 'rule' && key !== 'useStyle' && style !== undefined && ownValue(style, key) !== undefined),
    diagnosticKeys(diagnostics)
  );
}

/**
 * A blank rule starts with "Which items" only: no condition key, nothing in passthrough (unknown or wrong-shaped keys
 * of a third-party file) and no diagnostic on one of its keys. Its actions may be the new rule's `{ show: true }` or a comment; any other
 * action (a hide, a style, a label…) means the rule already does something, so every group shows.
 */
export function isBlankRule(rule: LootFilterRule, diagnostics: readonly Diagnostic[] = []): boolean {
  // A problem with one of its keys skips the step; one about the whole rule ("neither conditions nor actions", which
  // every new `{}` rule gets) does not.
  if (diagnosticKeys(diagnostics).size > 0) return false;
  if (Object.keys(rule.passthrough ?? {}).length > 0) return false;
  if (CONDITION_KEYS.some((key) => rule[key] !== undefined)) return false;
  return ACTION_KEYS.every((key) => key === 'show' || key === 'comment' || rule[key] === undefined);
}

/** True when a patch sets (not removes) a condition key: the items-first step ends for good. */
export function setsCondition(patch: object): boolean {
  return Object.entries(patch).some(([key, value]) => key in CONDITION_GROUP_OF && value !== undefined);
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/** One part of a folded group's summary: text, optionally after a colour swatch (label colours, icon tint, droplight). */
export interface SummaryPart {
  readonly text: string;
  readonly swatch?: LabelColor;
}

/** A summary line longer than this is cut with an ellipsis (the header truncates it again to fit). */
const MAX_TEXT = 60;

function cut(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1).trimEnd()}…` : text;
}

/** `“Pul”`: a text without colour codes, quoted and cut; undefined when it is empty. */
function quoted(text: FilterText | undefined): string | undefined {
  const plain = plainText(text);
  return plain === undefined || plain === '' ? undefined : `“${cut(plain)}”`;
}

/** The name of the first colour a text sets before any visible character (`ÿc4Pul` → gold). */
function leadingColorName(text: FilterText | undefined): string | undefined {
  const resolved = resolveText(text);
  if (resolved === undefined) return undefined;
  const first = splitColorRuns(resolved).find((segment) => segment.kind === 'text' && segment.text.trim() !== '');
  if (first?.kind !== 'text' || first.color === null) return undefined;
  const code = first.color;
  return COLOR_CODES.find((entry) => entry.code === code)?.name;
}

function nameText(label: string, text: FilterText | undefined): string | undefined {
  const words = quoted(text);
  if (words === undefined) return undefined;
  const color = leadingColorName(text);
  const shown = color === undefined ? words : `${words} ${color}`;
  return label === '' ? shown : `${label} ${shown}`;
}

const parts = (...texts: (string | SummaryPart | undefined)[]): SummaryPart[] =>
  texts.filter((text) => text !== undefined).map((text) => (typeof text === 'string' ? { text } : text));

interface ActionSummaryInput {
  /** The rule's or style's own actions. */
  readonly own: RuleActions;
  /** A rule's style, when it is in the filter (its values show where the rule sets none). */
  readonly style?: RuleActions;
}

/**
 * A folded action group's summary: what it sets (the rule's own value, else its style's), e.g. Sound → `other.mp3,
 * 15%`; `none` when it sets nothing. Text has no colour codes; colours are swatches or colour names.
 */
export function actionGroupSummary(group: ActionGroup, { own, style }: ActionSummaryInput): readonly SummaryPart[] {
  const value = <K extends keyof RuleActions>(key: K): RuleActions[K] => own[key] ?? (key === 'useStyle' ? undefined : style?.[key]);
  const result = ((): SummaryPart[] => {
    switch (group) {
      case 'style':
        return parts(own.useStyle === undefined ? undefined : style === undefined ? `${own.useStyle} (missing)` : own.useStyle);
      case 'visibility':
        return parts(
          value('hide') === true ? 'hide' : undefined,
          value('show') === true ? 'show' : undefined,
          value('hideIfOtherConditionsFail') === true ? 'hide if other conditions fail' : undefined,
          nameText('chat when hidden', value('chatMessageWhenHidden'))
        );
      case 'name': {
        const replaceName = value('replaceName');
        const code = nameColorCode(replaceName);
        const color = code === undefined ? undefined : COLOR_CODES.find((entry) => entry.code === code)?.name;
        return parts(
          color === undefined ? nameText('', replaceName) : `${color} name`,
          nameText('prefix', value('namePrefix')),
          nameText('suffix', value('nameSuffix'))
        );
      }
      case 'label': {
        const background = value('labelBackground');
        const border = value('labelBorder');
        return parts(
          background === undefined ? undefined : { text: 'background', swatch: background },
          border === undefined ? undefined : { text: `border ${String(border.width)} px`, swatch: border.color }
        );
      }
      case 'chat':
        return parts(nameText('', value('chatMessage')), value('notify') === true ? 'notify' : undefined);
      case 'sound': {
        const sound = value('sound');
        const volume = value('soundVolume');
        const volumeText = volume === undefined ? undefined : `${String(volume)}%`;
        if (sound === undefined) return parts(volumeText === undefined ? undefined : `volume ${volumeText}`);
        return parts(volumeText === undefined ? String(sound) : `${String(sound)}, ${volumeText}`);
      }
      case 'icon': {
        const icon = value('icon');
        if (icon === undefined) return [];
        const text = icon.iconSize === undefined ? icon.iconName : `${icon.iconName}, ${String(icon.iconSize)} px`;
        return parts(icon.color === undefined ? text : { text, swatch: icon.color });
      }
      case 'droplight': {
        const droplight = value('droplight');
        if (droplight === undefined) return [];
        return parts(droplight.color === undefined ? 'white beam' : { text: 'on', swatch: droplight.color });
      }
      case 'notes':
        return parts(own.comment === undefined || own.comment === '' ? undefined : `“${cut(own.comment)}”`);
    }
  })();
  if (result.length === 0) return [{ text: 'none' }];
  // A group the rule leaves to its style says so.
  const keys = actionGroupKeys(group);
  const fromStyle =
    group !== 'style' && style !== undefined && keys.every((key) => own[key] === undefined) && keys.some((key) => style[key] !== undefined);
  return fromStyle && own.useStyle !== undefined ? [...result, { text: `from style ${own.useStyle}` }] : result;
}

/** The rule with only the given condition keys (for `ruleConditionSummary` of one group). */
function pick(rule: LootFilterRule, keys: readonly (keyof RuleConditions)[]): LootFilterRule {
  const picked: LootFilterRule = Object.fromEntries(keys.filter((key) => rule[key] !== undefined).map((key) => [key, rule[key]]));
  return picked;
}

/**
 * A folded condition group's summary in the rule list's words (`Zod Rune, Cham Rune +2`, `unique · 3 sockets`);
 * Which items without any reads `every item`, the others `none`. `exceptions`: a hide rule reads its `<` item stat
 * checks as "unless …" (`readsExceptions` of the effective actions).
 */
export function conditionGroupSummary(group: ConditionGroup, rule: LootFilterRule, lookup: LootFilterLookup, exceptions: boolean): string {
  const keys = conditionGroupKeys(group);
  const conditions = ruleConditionSummary(pick(rule, keys), lookup, exceptions);
  // The rule list shows these two as row badges, so its summary leaves them out.
  const extra = group === 'whereWhen' ? [locationBadge(rule.location), levelsBadge(rule.activeInLevels)] : [];
  const text = [conditions === 'any item' ? undefined : conditions, ...extra].filter((part) => part !== undefined).join(' · ');
  if (text !== '') return text;
  return group === 'items' ? 'every item' : 'none';
}
