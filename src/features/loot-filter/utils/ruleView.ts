/**
 * The editor's Basic / Advanced view, one setting for the rule editor and the Styles tab (it lives in the settings
 * feature). Basic shows the fields a new player needs; Advanced shows every field (the full editor). In Basic, an
 * Advanced field that already holds a value (or a wrong-shaped one, or a diagnostic) still shows, tagged "advanced",
 * so nothing set is hidden silently.
 */
import type { RuleViewMode } from '@/features/settings';
import { COLOR_CODES } from '../engine/colors';
import type { Diagnostic, FilterText, LootFilterRule, LootFilterStyle, RuleActions, RuleConditions } from '../engine/types';
import { isExceptionCheck, plainCheckCount } from './statChecks';

export type RuleView = RuleViewMode;

/** Every condition key, true when the Basic view shows it. `satisfies` makes a new key pick a side. */
export const BASIC_CONDITIONS = {
  itemCodes: true,
  excludeItemCodes: false,
  itemTypes: true,
  excludeItemTypes: false,
  uniqueOrSetIds: true,
  excludeUniqueOrSetIds: false,
  quality: true,
  baseTier: false,
  itemLevel: false,
  sockets: true,
  maxSockets: false,
  isEthereal: true,
  isRuneword: false,
  isIdentified: false,
  isFullySocketed: false,
  itemStats: true,
  itemStatsAnyOf: false,
  playerStats: false,
  playerStatsAnyOf: false,
  areas: false,
  excludeAreas: false,
  location: false,
  activeInLevels: false,
  difficulty: false,
} as const satisfies Record<keyof RuleConditions, boolean>;

/** Every action key, true when the Basic view shows it, for a rule's own actions and a style's alike. */
export const BASIC_ACTIONS = {
  // Every example rule uses a style, chosen like the sound or icon (a style has no Use style: it cannot use another).
  useStyle: true,
  hide: true,
  hideIfOtherConditionsFail: false,
  chatMessageWhenHidden: false,
  replaceName: false,
  namePrefix: false,
  nameSuffix: false,
  labelBackground: true,
  labelBorder: true,
  chatMessage: true,
  notify: false,
  sound: true,
  // Edited with the sound.
  soundVolume: true,
  icon: true,
  droplight: false,
  // A rule's comment is edited above the conditions and always shown; a style's under Notes.
  comment: true,
} as const satisfies Record<keyof RuleActions, boolean>;

/**
 * A hide rule's "Advanced: hide only items with these stats" box: its plain item stat checks (the exceptions are the
 * Except control's, which Basic shows). Stands for `itemStats` and `itemStatsAnyOf` on a hide rule.
 */
export const HIDE_ONLY_STATS = 'hideOnlyStats';

export type ConditionField = keyof RuleConditions | typeof HIDE_ONLY_STATS;
export type ActionField = keyof RuleActions;

/** The editor's gated condition fields in order, for a rule that hides or not. */
export function conditionFields(hides: boolean): readonly ConditionField[] {
  const keys = Object.keys(BASIC_CONDITIONS) as (keyof RuleConditions)[];
  if (!hides) return keys;
  return keys.flatMap((key): ConditionField[] => (key === 'itemStats' ? [HIDE_ONLY_STATS] : key === 'itemStatsAnyOf' ? [] : [key]));
}

/** The action fields the actions editor shows (in its order); `soundVolume` goes with `sound`. */
export const ACTION_EDITOR_FIELDS: readonly ActionField[] = [
  'useStyle',
  'hide',
  'hideIfOtherConditionsFail',
  'chatMessageWhenHidden',
  'replaceName',
  'namePrefix',
  'nameSuffix',
  'labelBackground',
  'labelBorder',
  'chatMessage',
  'notify',
  'sound',
  'icon',
  'droplight',
];

/** `ÿc<code>{name}`: a replaceName that only recolours the name, which Basic's Name colour edits. */
const NAME_COLOR = /^ÿc(.)\{name\}$/u;

/** The colour code of a replaceName that only recolours the name (`ÿc9{name}` → `9`), else undefined. */
export function nameColorCode(replaceName: FilterText | undefined): string | undefined {
  if (typeof replaceName !== 'string') return undefined;
  const code = NAME_COLOR.exec(replaceName)?.[1];
  return code !== undefined && COLOR_CODES.some((entry) => entry.code === code) ? code : undefined;
}

/** The replaceName that recolours the name with `code`. */
export function nameColorText(code: string): string {
  return `ÿc${code}{name}`;
}

/** A rule's own path in the file: `rules/<n>` or, for a disabled rule, `disabledRules/<n>/rule`. */
export const RULE_PATH = /^(?:rules\/\d+|disabledRules\/\d+\/rule)(?:\/|$)/;

/** A diagnostic's path inside its rule or style (`rules/3/itemLevel/min` → `itemLevel/min`). */
function ownPath(diagnostic: Diagnostic): string {
  // A style's path is `styles/<name>/…`; its name may hold a slash, so it is cut by the name, not by a pattern.
  if (diagnostic.style !== undefined) {
    const prefix = `styles/${diagnostic.style}`;
    if (diagnostic.path === prefix) return '';
    if (diagnostic.path.startsWith(`${prefix}/`)) return diagnostic.path.slice(prefix.length + 1);
  }
  return diagnostic.path.replace(RULE_PATH, '');
}

/** The rule or style keys the diagnostics point at (`rules/3/itemLevel/min` → `itemLevel`, `styles/Rune/sound` → `sound`). */
export function diagnosticKeys(diagnostics: readonly Diagnostic[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const diagnostic of diagnostics) {
    const [key] = ownPath(diagnostic).split('/');
    if (key !== '') keys.add(key);
  }
  return keys;
}

/**
 * How a field shows: `shown` (a Basic field, or the Advanced view), `advanced` (an Advanced field the Basic view shows
 * because it holds a value: tag it), `hidden`.
 */
export type FieldVisibility = 'shown' | 'advanced' | 'hidden';

/** Which action fields show: the actions editor's gate, for a rule's own actions or a style's. */
export interface ActionFieldGate {
  readonly view: RuleView;
  readonly action: (field: ActionField) => FieldVisibility;
  /** Action fields Basic hides (0 in Advanced). */
  readonly hiddenActions: number;
}

export interface RuleFieldGate extends ActionFieldGate {
  readonly condition: (field: ConditionField) => FieldVisibility;
  /** Condition fields Basic hides (0 in Advanced). */
  readonly hiddenConditions: number;
}

interface ActionFieldGateInput {
  readonly view: RuleView;
  /** The rule or style whose actions are edited (its `passthrough` holds wrong-shaped values). */
  readonly actions: LootFilterStyle | LootFilterRule;
  /** The rule's or style's diagnostics: a field one points at counts as set. */
  readonly diagnostics?: readonly Diagnostic[];
}

interface RuleFieldGateInput {
  readonly view: RuleView;
  readonly rule: LootFilterRule;
  /** The rule's effective actions hide (own or style `hide`): the Except control and the hide-only box show. */
  readonly hides: boolean;
  /** The rule's diagnostics: a field one points at counts as set. */
  readonly diagnostics?: readonly Diagnostic[];
}

function visibility(view: RuleView, basic: boolean, set: boolean): FieldVisibility {
  if (view === 'advanced' || basic) return 'shown';
  return set ? 'advanced' : 'hidden';
}

/** A key counts as set when it holds a value, a wrong-shaped one (passthrough) or a diagnostic. */
function isSet(owner: LootFilterStyle | LootFilterRule, flagged: ReadonlySet<string>): (key: string) => boolean {
  const passthrough = owner.passthrough ?? {};
  return (key) => (owner as Readonly<Record<string, unknown>>)[key] !== undefined || key in passthrough || flagged.has(key);
}

/** Which fields of the actions editor show for this rule's or style's actions in this view. */
export function actionFieldGate({ view, actions, diagnostics = [] }: ActionFieldGateInput): ActionFieldGate {
  const flagged = diagnosticKeys(diagnostics);
  const has = isSet(actions, flagged);
  const actionSet = (field: ActionField) =>
    // Name colour (Basic) edits a replaceName that only recolours; any other replaceName shows the full field.
    field === 'replaceName' ? has(field) && (nameColorCode(actions.replaceName) === undefined || flagged.has(field)) : has(field);
  const action = (field: ActionField): FieldVisibility => visibility(view, BASIC_ACTIONS[field], actionSet(field));
  return { view, action, hiddenActions: ACTION_EDITOR_FIELDS.filter((field) => action(field) === 'hidden').length };
}

/** Which fields of the rule editor show for this rule in this view (its actions as `actionFieldGate`). */
export function ruleFieldGate({ view, rule, hides, diagnostics = [] }: RuleFieldGateInput): RuleFieldGate {
  const has = isSet(rule, diagnosticKeys(diagnostics));
  const passthrough = rule.passthrough ?? {};

  // The hide-only box holds the plain checks of both item stat lists; their exceptions are the Except control's, so a
  // list of exceptions only (or a diagnostic on one) does not count.
  const plainStatFlagged = diagnostics.some((diagnostic) => {
    const parts = diagnostic.path.replace(RULE_PATH, '').split('/');
    const [key] = parts;
    if (key !== 'itemStats' && key !== 'itemStatsAnyOf') return false;
    // A diagnostic on the list as a whole (no index) counts too.
    const check = parts.length > 1 ? rule[key]?.at(Number(parts[1])) : undefined;
    return check === undefined || !isExceptionCheck(check);
  });
  const conditionSet = (field: ConditionField) =>
    field === HIDE_ONLY_STATS
      ? plainCheckCount(rule.itemStats) + plainCheckCount(rule.itemStatsAnyOf) > 0 ||
        'itemStats' in passthrough ||
        'itemStatsAnyOf' in passthrough ||
        plainStatFlagged
      : has(field);
  const condition = (field: ConditionField): FieldVisibility =>
    visibility(view, field === HIDE_ONLY_STATS ? false : BASIC_CONDITIONS[field], conditionSet(field));

  return {
    ...actionFieldGate({ view, actions: rule, diagnostics }),
    condition,
    hiddenConditions: conditionFields(hides).filter((field) => condition(field) === 'hidden').length,
  };
}
