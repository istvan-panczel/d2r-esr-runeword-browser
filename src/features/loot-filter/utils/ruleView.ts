/**
 * The rule editor's Basic / Advanced view (the setting lives in the settings feature). Basic shows the fields a new
 * player needs; Advanced shows every field (the full editor). In Basic, an Advanced field that already holds a value
 * (or a wrong-shaped one, or a diagnostic) still shows, tagged "advanced", so nothing set is hidden silently.
 */
import type { RuleViewMode } from '@/features/settings';
import { COLOR_CODES } from '../engine/colors';
import type { Diagnostic, FilterText, LootFilterRule, RuleActions, RuleConditions } from '../engine/types';
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

/** Every action key, true when the Basic view shows it (a rule's own actions; a style's editor always shows all). */
export const BASIC_ACTIONS = {
  useStyle: false,
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
  // A rule's comment is edited above the conditions and always shown.
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

/** The action fields the rule's actions editor shows (in its order); `soundVolume` goes with `sound`. */
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

/** The rule keys the diagnostics point at (`rules/3/itemLevel/min` → `itemLevel`). */
export function diagnosticKeys(diagnostics: readonly Diagnostic[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const diagnostic of diagnostics) {
    const [key] = diagnostic.path.replace(RULE_PATH, '').split('/');
    if (key !== '') keys.add(key);
  }
  return keys;
}

/**
 * How a field shows: `shown` (a Basic field, or the Advanced view), `advanced` (an Advanced field the Basic view shows
 * because it holds a value: tag it), `hidden`.
 */
export type FieldVisibility = 'shown' | 'advanced' | 'hidden';

export interface RuleFieldGate {
  readonly view: RuleView;
  readonly condition: (field: ConditionField) => FieldVisibility;
  readonly action: (field: ActionField) => FieldVisibility;
  /** Condition fields Basic hides (0 in Advanced). */
  readonly hiddenConditions: number;
  /** Action fields Basic hides (0 in Advanced). */
  readonly hiddenActions: number;
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

/** Which fields of the rule editor show for this rule in this view. */
export function ruleFieldGate({ view, rule, hides, diagnostics = [] }: RuleFieldGateInput): RuleFieldGate {
  const flagged = diagnosticKeys(diagnostics);
  const passthrough = rule.passthrough ?? {};
  const has = (key: string) => (rule as Readonly<Record<string, unknown>>)[key] !== undefined || key in passthrough || flagged.has(key);

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

  const actionSet = (field: ActionField) =>
    // Name colour (Basic) edits a replaceName that only recolours; any other replaceName shows the full field.
    field === 'replaceName' ? has(field) && (nameColorCode(rule.replaceName) === undefined || flagged.has(field)) : has(field);
  const action = (field: ActionField): FieldVisibility => visibility(view, BASIC_ACTIONS[field], actionSet(field));

  return {
    view,
    condition,
    action,
    hiddenConditions: conditionFields(hides).filter((field) => condition(field) === 'hidden').length,
    hiddenActions: ACTION_EDITOR_FIELDS.filter((field) => action(field) === 'hidden').length,
  };
}
