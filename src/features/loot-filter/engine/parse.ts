/**
 * Reads a loot filter file into the typed model of `types.ts`.
 *
 * Shape rules (what counts as "the right shape" for a known key):
 * - Named values (`quality`, `baseTier`, `difficulty`) must use a known name or any number, as one
 *   value, a list or `{ min, max }`; an unknown name makes the whole value wrong-shaped (the numbers'
 *   range is the validator's job).
 * - Nested objects (stat checks, ranges, `labelBorder`, `icon`, `droplight`, filter levels,
 *   `notifications`, `qualityColors`) accept only their documented keys; any other key makes the whole
 *   value wrong-shaped, so it is carried through untouched in `passthrough`.
 * - Colours must be lists of 3 or 4 numbers (droplight: 3); their 0–255 range is the validator's job.
 * - A wrong-shaped value goes to `passthrough` with an `error`; an unknown key with a `warning`.
 * - One exception: `activeInLevels` given as a single number (`4`, which the plugin accepts) is read as `[4]` with a
 *   `warning`; the rule's `activeInLevelsNumber` keeps the number so the serializer writes it back unchanged.
 * - `rules` (or `styles`) holding a non-object entry is wrong-shaped as a whole: `rules` is then `[]`
 *   and the original list stays in the top-level `passthrough`.
 * - `disabledRules` (the editor's own key, ignored by the plugin) is a list of `{ "at": <index>, "rule": {…} }`: each
 *   rule is read like a `rules` entry, marked `disabled` and inserted at `at` in ascending order, so `at` is its index
 *   in the full rule list. A duplicate or too large `at` is moved (after the previous one, or to the end) with a
 *   warning; any other shape makes the whole list wrong-shaped (top-level `passthrough`).
 * - A rule's diagnostics carry its file path (`rules/<n>` or `disabledRules/<n>/rule`) and its index in the full list.
 */
import { parseJsonc, type JsoncParseResult } from './jsonc.ts';
import {
  BASE_TIERS,
  DIFFICULTIES,
  FORMAT_VERSION,
  LANGUAGES,
  LOCATIONS,
  QUALITIES,
  STAT_OPS,
  type Diagnostic,
  type Droplight,
  type FilterLevel,
  type FilterText,
  type ItemLocation,
  type LabelBorder,
  type LabelColor,
  type LocalizedText,
  type LootFilter,
  type LootFilterRule,
  type LootFilterStyle,
  type MinimapIcon,
  type NamedMatch,
  type NamedValue,
  type Notifications,
  type NumberMatch,
  type QualityColors,
  type RgbColor,
  type RuleActions,
  type RuleConditions,
  type StatCheck,
  type StatOp,
} from './types.ts';

// ---------------------------------------------------------------------------
// Value readers: each returns the typed value or a reason the shape is wrong
// ---------------------------------------------------------------------------

type ReadResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };
type Reader<T> = (raw: unknown) => ReadResult<T>;

const ok = <T>(value: T): ReadResult<T> => ({ ok: true, value });
const fail = <T>(reason: string): ReadResult<T> => ({ ok: false, reason });

export function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/** Keys of `value` that are not in `allowed`. */
function extraKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

const readString: Reader<string> = (raw) => (typeof raw === 'string' ? ok(raw) : fail('expected a string'));
const readBoolean: Reader<boolean> = (raw) => (typeof raw === 'boolean' ? ok(raw) : fail('expected true or false'));
const readNumber: Reader<number> = (raw) => (isFiniteNumber(raw) ? ok(raw) : fail('expected a number'));

function listOf<T>(item: Reader<T>, what: string): Reader<readonly T[]> {
  return (raw) => {
    if (!Array.isArray(raw)) return fail(`expected a list of ${what}`);
    const values: T[] = [];
    for (const [index, entry] of raw.entries()) {
      const result = item(entry);
      if (!result.ok) return fail(`entry ${String(index)}: ${result.reason}`);
      values.push(result.value);
    }
    return ok(values);
  };
}

const readStringList = listOf(readString, 'strings');
const readNumberList = listOf(readNumber, 'numbers');

const readText: Reader<FilterText> = (raw) => {
  if (typeof raw === 'string') return ok(raw);
  if (!isPlainObject(raw)) return fail('expected a string or a per-language object');
  const text: { -readonly [L in keyof LocalizedText]: string } = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!includes(LANGUAGES, key)) return fail(`unknown language '${key}'`);
    if (typeof value !== 'string') return fail(`language '${key}' is not a string`);
    text[key] = value;
  }
  return ok(text);
};

const readNumberMatch: Reader<NumberMatch> = (raw) => {
  if (isFiniteNumber(raw)) return ok(raw);
  if (Array.isArray(raw)) return readNumberList(raw);
  if (!isPlainObject(raw)) return fail('expected a number, a list of numbers or { "min", "max" }');
  const extra = extraKeys(raw, ['min', 'max']);
  if (extra.length > 0) return fail(`unexpected key '${extra.join("', '")}' in a range`);
  const range: { min?: number; max?: number } = {};
  if (raw.min !== undefined) {
    if (!isFiniteNumber(raw.min)) return fail('"min" is not a number');
    range.min = raw.min;
  }
  if (raw.max !== undefined) {
    if (!isFiniteNumber(raw.max)) return fail('"max" is not a number');
    range.max = raw.max;
  }
  return ok(range);
};

function namedMatch<N extends string>(names: readonly N[], what: string): Reader<NamedMatch<N>> {
  const one = (raw: unknown): ReadResult<NamedValue<N>> => {
    if (isFiniteNumber(raw)) return ok(raw);
    if (includes(names, raw)) return ok(raw);
    if (typeof raw === 'string') return fail(`unknown ${what} '${raw}'`);
    return fail(`expected a ${what} name or number`);
  };
  return (raw) => {
    if (Array.isArray(raw)) return listOf(one, `${what} names or numbers`)(raw);
    if (!isPlainObject(raw)) return one(raw);
    const extra = extraKeys(raw, ['min', 'max']);
    if (extra.length > 0) return fail(`unexpected key '${extra.join("', '")}' in a range`);
    const range: { min?: NamedValue<N>; max?: NamedValue<N> } = {};
    if (raw.min !== undefined) {
      const min = one(raw.min);
      if (!min.ok) return min;
      range.min = min.value;
    }
    if (raw.max !== undefined) {
      const max = one(raw.max);
      if (!max.ok) return max;
      range.max = max.value;
    }
    return ok(range);
  };
}

const readStatCheck: Reader<StatCheck> = (raw) => {
  if (!isPlainObject(raw)) return fail('expected a stat check object');
  const extra = extraKeys(raw, ['stat', 'param', 'op', 'value']);
  if (extra.length > 0) return fail(`unexpected key '${extra.join("', '")}' in a stat check`);
  const { stat, param, op, value } = raw;
  if (typeof stat !== 'string' && !isFiniteNumber(stat)) return fail('"stat" must be a stat name or id');
  if (param !== undefined && !isFiniteNumber(param)) return fail('"param" must be a number');
  if (op !== undefined && !includes<StatOp>(STAT_OPS, op)) return fail(`unknown op ${JSON.stringify(op)}`);
  let checkValue: number | readonly [number, number];
  if (isFiniteNumber(value)) checkValue = value;
  else if (Array.isArray(value) && value.length === 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1])) {
    checkValue = [value[0], value[1]];
  } else return fail('"value" must be a number or [low, high]');
  return ok({
    stat,
    ...(param === undefined ? {} : { param }),
    ...(op === undefined ? {} : { op }),
    value: checkValue,
  });
};

const readStatChecks = listOf(readStatCheck, 'stat checks');

function colorReader(lengths: readonly number[]): Reader<readonly number[]> {
  return (raw) => {
    const list = readNumberList(raw);
    if (!list.ok) return list;
    if (!lengths.includes(list.value.length))
      return fail(`expected ${lengths.join(' or ')} numbers (r, g, b${lengths.includes(4) ? '[, a]' : ''})`);
    return list;
  };
}

const readLabelColor: Reader<LabelColor> = (raw) => {
  const list = colorReader([3, 4])(raw);
  if (!list.ok) return list;
  const [r, g, b, a] = list.value;
  return ok(list.value.length === 4 ? [r, g, b, a] : [r, g, b]);
};

const readRgbColor: Reader<RgbColor> = (raw) => {
  const list = colorReader([3])(raw);
  if (!list.ok) return list;
  const [r, g, b] = list.value;
  return ok([r, g, b]);
};

const readLocations = listOf<ItemLocation>(
  (raw) => (includes(LOCATIONS, raw) ? ok(raw) : fail(`unknown location ${JSON.stringify(raw)}`)),
  'locations'
);

function objectReader<T>(
  what: string,
  allowed: readonly string[],
  build: (raw: Readonly<Record<string, unknown>>) => ReadResult<T>
): Reader<T> {
  return (raw) => {
    if (!isPlainObject(raw)) return fail(`expected ${what}`);
    const extra = extraKeys(raw, allowed);
    if (extra.length > 0) return fail(`unexpected key '${extra.join("', '")}' in ${what}`);
    return build(raw);
  };
}

const readLabelBorder = objectReader<LabelBorder>('a label border object', ['color', 'width'], (raw) => {
  const color = readLabelColor(raw.color);
  if (!color.ok) return fail(`"color": ${color.reason}`);
  if (!isFiniteNumber(raw.width)) return fail('"width" must be a number');
  return ok({ color: color.value, width: raw.width });
});

const readIcon = objectReader<MinimapIcon>('an icon object', ['iconName', 'iconSize', 'color'], (raw) => {
  if (typeof raw.iconName !== 'string') return fail('"iconName" must be a string');
  if (raw.iconSize !== undefined && !isFiniteNumber(raw.iconSize)) return fail('"iconSize" must be a number');
  let color: LabelColor | undefined;
  if (raw.color !== undefined) {
    const result = readLabelColor(raw.color);
    if (!result.ok) return fail(`"color": ${result.reason}`);
    color = result.value;
  }
  return ok({
    iconName: raw.iconName,
    ...(raw.iconSize === undefined ? {} : { iconSize: raw.iconSize }),
    ...(color === undefined ? {} : { color }),
  });
});

const readDroplight = objectReader<Droplight>('a droplight object', ['color'], (raw) => {
  if (raw.color === undefined) return ok({});
  const color = readRgbColor(raw.color);
  return color.ok ? ok({ color: color.value }) : fail(`"color": ${color.reason}`);
});

const readSound: Reader<string | number> = (raw) =>
  typeof raw === 'string' || isFiniteNumber(raw) ? ok(raw) : fail('expected a sounds.txt name, a row number or a file name');

const readFilterLevels = listOf(
  objectReader<FilterLevel>('a level object { "id", "name" }', ['id', 'name'], (raw) => {
    if (!isFiniteNumber(raw.id)) return fail('"id" must be a number');
    if (typeof raw.name !== 'string') return fail('"name" must be a string');
    return ok({ id: raw.id, name: raw.name });
  }),
  'levels'
);

const readNotifications = objectReader<Notifications>('a notifications object', ['dropFormat', 'levelChangeFormat'], (raw) => {
  const result: { dropFormat?: FilterText; levelChangeFormat?: FilterText } = {};
  for (const key of ['dropFormat', 'levelChangeFormat'] as const) {
    if (raw[key] === undefined) continue;
    const text = readText(raw[key]);
    if (!text.ok) return fail(`"${key}": ${text.reason}`);
    result[key] = text.value;
  }
  return ok(result);
});

const readQualityColors: Reader<QualityColors> = (raw) => {
  if (!isPlainObject(raw)) return fail('expected an object of quality colour codes');
  const colors: { -readonly [Q in keyof QualityColors]: string } = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!includes(QUALITIES, key)) return fail(`unknown quality '${key}'`);
    if (typeof value !== 'string') return fail(`"${key}" must be a colour code string`);
    colors[key] = value;
  }
  return ok(colors);
};

// ---------------------------------------------------------------------------
// Field tables; their key order is the canonical key order the serializer writes
// ---------------------------------------------------------------------------

type FieldReaders<T> = { readonly [K in keyof T]-?: Reader<NonNullable<T[K]>> };

const CONDITION_READERS: FieldReaders<RuleConditions> = {
  itemCodes: readStringList,
  excludeItemCodes: readStringList,
  itemTypes: readStringList,
  excludeItemTypes: readStringList,
  quality: namedMatch(QUALITIES, 'quality'),
  baseTier: namedMatch(BASE_TIERS, 'base tier'),
  itemLevel: readNumberMatch,
  sockets: readNumberMatch,
  maxSockets: readNumberMatch,
  isFullySocketed: readBoolean,
  isEthereal: readBoolean,
  isIdentified: readBoolean,
  isRuneword: readBoolean,
  uniqueOrSetIds: readNumberList,
  excludeUniqueOrSetIds: readNumberList,
  itemStats: readStatChecks,
  itemStatsAnyOf: readStatChecks,
  playerStats: readStatChecks,
  playerStatsAnyOf: readStatChecks,
  location: readLocations,
  difficulty: namedMatch(DIFFICULTIES, 'difficulty'),
  areas: readNumberList,
  excludeAreas: readNumberList,
  activeInLevels: readNumberList,
};

const ACTION_READERS: FieldReaders<RuleActions> = {
  hide: readBoolean,
  hideIfOtherConditionsFail: readBoolean,
  replaceName: readText,
  namePrefix: readText,
  nameSuffix: readText,
  labelBackground: readLabelColor,
  labelBorder: readLabelBorder,
  chatMessage: readText,
  chatMessageWhenHidden: readText,
  notify: readBoolean,
  sound: readSound,
  soundVolume: readNumber,
  icon: readIcon,
  droplight: readDroplight,
  useStyle: readString,
  comment: readString,
};

type HeaderFields = Pick<
  LootFilter,
  | 'title'
  | 'author'
  | 'version'
  | 'description'
  | 'updateUrl'
  | 'filterLevels'
  | 'defaultLevel'
  | 'hideUnmatchedItems'
  | 'soundVolume'
  | 'notifications'
  | 'qualityColors'
>;

const HEADER_READERS: FieldReaders<HeaderFields> = {
  title: readString,
  author: readString,
  version: readString,
  description: readString,
  updateUrl: readString,
  filterLevels: readFilterLevels,
  defaultLevel: readNumber,
  hideUnmatchedItems: readBoolean,
  soundVolume: readNumber,
  notifications: readNotifications,
  qualityColors: readQualityColors,
};

function keysOf<T extends object>(table: T): readonly (keyof T & string)[] {
  // Object.keys loses the key type; the tables above are exhaustive object literals, so this is exact.
  return Object.keys(table) as (keyof T & string)[];
}

/** Rule condition keys in the order of `RuleConditions`. */
export const CONDITION_KEYS = keysOf(CONDITION_READERS);
/** Rule and style action keys in the order of `RuleActions`. */
export const ACTION_KEYS = keysOf(ACTION_READERS);
/** Action keys that make a rule do something (`comment` does not). */
export const EFFECT_KEYS: readonly Exclude<keyof RuleActions, 'comment'>[] = ACTION_KEYS.filter(
  (key): key is Exclude<keyof RuleActions, 'comment'> => key !== 'comment'
);
/** Top-level keys in the guide's order. */
export const TOP_LEVEL_KEYS = ['formatVersion', ...keysOf(HEADER_READERS), 'styles', 'rules', 'disabledRules'] as const;

/**
 * Where each rule of the full list (disabled ones included) sits in the written file: `rules/<n>` with n the number of
 * enabled rules before it, or `disabledRules/<n>/rule` with n the number of disabled rules before it.
 */
export function ruleFilePaths(rules: readonly Pick<LootFilterRule, 'disabled'>[]): string[] {
  let enabled = 0;
  let disabled = 0;
  return rules.map((rule) => {
    if (rule.disabled !== true) return `rules/${String(enabled++)}`;
    return `disabledRules/${String(disabled++)}/rule`;
  });
}

// ---------------------------------------------------------------------------
// Object parsing
// ---------------------------------------------------------------------------

interface Context {
  readonly diagnostics: Diagnostic[];
}

interface Owner {
  readonly path: string;
  readonly rule?: number;
  readonly style?: string;
}

function report(context: Context, owner: Owner, severity: Diagnostic['severity'], key: string, message: string): void {
  context.diagnostics.push({
    severity,
    message,
    path: owner.path === '' ? key : `${owner.path}/${key}`,
    ...(owner.rule === undefined ? {} : { rule: owner.rule }),
    ...(owner.style === undefined ? {} : { style: owner.style }),
  });
}

function readField<T, K extends keyof T>(
  target: { -readonly [P in keyof T]?: T[P] },
  key: K,
  reader: Reader<NonNullable<T[K]>>,
  raw: unknown
): ReadResult<null> {
  const result = reader(raw);
  if (!result.ok) return result;
  target[key] = result.value;
  return ok(null);
}

/** Reads the keys of `raw` that `readers` know into `target`; wrong shapes go to `passthrough` with an error. */
function readFields<T>(
  context: Context,
  owner: Owner,
  raw: Readonly<Record<string, unknown>>,
  readers: FieldReaders<T>,
  target: { -readonly [P in keyof T]?: T[P] },
  passthrough: Record<string, unknown>
): void {
  for (const key of keysOf(readers)) {
    if (!(key in raw)) continue;
    const value = raw[key];
    const result = readField<T, typeof key>(target, key, readers[key], value);
    if (!result.ok) {
      passthrough[key] = value;
      report(context, owner, 'error', key, `"${key}": ${result.reason}`);
    }
  }
}

function collectUnknown(
  context: Context,
  owner: Owner,
  raw: Readonly<Record<string, unknown>>,
  known: readonly string[],
  passthrough: Record<string, unknown>,
  hint?: (key: string) => string | undefined
): void {
  for (const [key, value] of Object.entries(raw)) {
    if (known.includes(key)) continue;
    passthrough[key] = value;
    report(context, owner, 'warning', key, hint?.(key) ?? `Unknown key "${key}"; it is kept as is`);
  }
}

/** Puts the passthrough entries back in file order. */
function inFileOrder(
  raw: Readonly<Record<string, unknown>>,
  passthrough: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined {
  const keys = Object.keys(raw).filter((key) => Object.hasOwn(passthrough, key));
  if (keys.length === 0) return undefined;
  return Object.fromEntries(keys.map((key) => [key, passthrough[key]]));
}

function parseRule(context: Context, raw: Readonly<Record<string, unknown>>, index: number, path: string): LootFilterRule {
  const owner: Owner = { path, rule: index };
  const rule: { -readonly [K in keyof LootFilterRule]?: LootFilterRule[K] } = {};
  const passthrough: Record<string, unknown> = {};
  // `"activeInLevels": 4` works in game: read it as `[4]`, warn, and remember the number so it is written back as is.
  const levelNumber = isFiniteNumber(raw.activeInLevels) ? raw.activeInLevels : undefined;
  if (levelNumber !== undefined) {
    rule.activeInLevelsNumber = levelNumber;
    report(context, owner, 'warning', 'activeInLevels', `A single number works in game; [${String(levelNumber)}] is the documented form.`);
  }
  const fields = levelNumber === undefined ? raw : { ...raw, activeInLevels: [levelNumber] };
  readFields<RuleConditions>(context, owner, fields, CONDITION_READERS, rule, passthrough);
  readFields<RuleActions>(context, owner, raw, ACTION_READERS, rule, passthrough);
  collectUnknown(context, owner, raw, [...CONDITION_KEYS, ...ACTION_KEYS], passthrough);
  const ordered = inFileOrder(raw, passthrough);
  if (ordered) rule.passthrough = ordered;
  return rule;
}

/** A raw rule object with the path it has in the file being read, in full-list order. */
interface PlacedRule {
  readonly raw: Readonly<Record<string, unknown>>;
  readonly path: string;
  readonly disabled: boolean;
}

interface DisabledEntry {
  readonly at: number;
  readonly rule: Readonly<Record<string, unknown>>;
}

function isDisabledEntry(value: unknown): value is DisabledEntry {
  return (
    isPlainObject(value) &&
    extraKeys(value, ['at', 'rule']).length === 0 &&
    typeof value.at === 'number' &&
    Number.isInteger(value.at) &&
    value.at >= 0 &&
    isPlainObject(value.rule)
  );
}

/** Inserts the `disabledRules` entries into `placed` (the enabled rules) at their `at`, ascending; warns about moved ones. */
function placeDisabledRules(context: Context, entries: readonly DisabledEntry[], placed: PlacedRule[]): void {
  const order = entries.map((entry, position) => ({ entry, position })).sort((a, b) => a.entry.at - b.entry.at);
  let previous = -1;
  for (const { entry, position } of order) {
    const path = `disabledRules/${String(position)}`;
    let at = Math.max(entry.at, previous + 1);
    if (at > entry.at) {
      context.diagnostics.push({
        severity: 'warning',
        path: `${path}/at`,
        message: `Another disabled rule has "at" ${String(entry.at)} too; this one goes after it (at ${String(at)})`,
      });
    }
    if (at > placed.length) {
      at = placed.length;
      context.diagnostics.push({
        severity: 'warning',
        path: `${path}/at`,
        message: `"at" ${String(entry.at)} is past the end of the rule list; the disabled rule goes last (at ${String(at)})`,
      });
    }
    placed.splice(at, 0, { raw: entry.rule, path: `${path}/rule`, disabled: true });
    previous = at;
  }
}

function parseStyle(context: Context, raw: Readonly<Record<string, unknown>>, name: string): LootFilterStyle {
  const owner: Owner = { path: `styles/${name}`, style: name };
  const style: { -readonly [K in keyof LootFilterStyle]?: LootFilterStyle[K] } = {};
  const passthrough: Record<string, unknown> = {};
  readFields<RuleActions>(context, owner, raw, ACTION_READERS, style, passthrough);
  collectUnknown(context, owner, raw, ACTION_KEYS, passthrough, (key) =>
    (CONDITION_KEYS as readonly string[]).includes(key) ? `"${key}" is a condition; styles hold actions only, so it is ignored` : undefined
  );
  const ordered = inFileOrder(raw, passthrough);
  if (ordered) style.passthrough = ordered;
  return style;
}

export interface ParseLootFilterResult {
  readonly filter: LootFilter;
  readonly diagnostics: Diagnostic[];
}

/** Builds the typed model from an already parsed JSON value. */
export function readLootFilter(value: unknown, leadingComments: readonly string[] = []): ParseLootFilterResult {
  const context: Context = { diagnostics: [] };
  const top: Owner = { path: '' };
  const topReport = (severity: Diagnostic['severity'], key: string, message: string): void => {
    context.diagnostics.push({ severity, message, path: key });
  };

  if (!isPlainObject(value)) {
    topReport('error', '', 'The filter must be a JSON object');
    return {
      filter: { formatVersion: FORMAT_VERSION, rules: [], leadingComments: [...leadingComments] },
      diagnostics: context.diagnostics,
    };
  }

  const header: { -readonly [K in keyof HeaderFields]?: HeaderFields[K] } = {};
  const passthrough: Record<string, unknown> = {};
  readFields<HeaderFields>(context, top, value, HEADER_READERS, header, passthrough);
  collectUnknown(context, top, value, TOP_LEVEL_KEYS, passthrough);

  let formatVersion: number = FORMAT_VERSION;
  if (!('formatVersion' in value)) topReport('error', 'formatVersion', 'Missing "formatVersion" (it is always 1)');
  else if (!isFiniteNumber(value.formatVersion)) {
    passthrough.formatVersion = value.formatVersion;
    topReport('error', 'formatVersion', '"formatVersion" must be the number 1');
  } else {
    formatVersion = value.formatVersion;
    if (formatVersion !== FORMAT_VERSION) {
      topReport(
        'error',
        'formatVersion',
        `Unsupported formatVersion ${String(formatVersion)}; this editor reads version ${String(FORMAT_VERSION)}`
      );
    }
  }

  let styles: Record<string, LootFilterStyle> | undefined;
  if ('styles' in value) {
    const rawStyles = value.styles;
    if (isPlainObject(rawStyles) && Object.values(rawStyles).every(isPlainObject)) {
      styles = {};
      for (const [name, rawStyle] of Object.entries(rawStyles)) {
        if (isPlainObject(rawStyle)) styles[name] = parseStyle(context, rawStyle, name);
      }
    } else {
      passthrough.styles = rawStyles;
      topReport('error', 'styles', '"styles" must be an object of named style objects');
    }
  }

  const placed: PlacedRule[] = [];
  if (!('rules' in value)) topReport('error', 'rules', 'Missing "rules"');
  else {
    const rawRules = value.rules;
    if (Array.isArray(rawRules) && rawRules.every(isPlainObject)) {
      for (const [index, rawRule] of rawRules.entries()) {
        if (isPlainObject(rawRule)) placed.push({ raw: rawRule, path: `rules/${String(index)}`, disabled: false });
      }
    } else {
      passthrough.rules = rawRules;
      topReport('error', 'rules', '"rules" must be a list of rule objects');
    }
  }
  if ('disabledRules' in value) {
    const rawDisabled = value.disabledRules;
    if (Array.isArray(rawDisabled) && rawDisabled.every(isDisabledEntry)) placeDisabledRules(context, rawDisabled, placed);
    else {
      passthrough.disabledRules = rawDisabled;
      topReport('error', 'disabledRules', '"disabledRules" must be a list of { "at": <rule index>, "rule": { … } } entries');
    }
  }
  const rules = placed.map(({ raw, path, disabled }, index): LootFilterRule => {
    const rule = parseRule(context, raw, index, path);
    return disabled ? { ...rule, disabled: true } : rule;
  });

  const ordered = inFileOrder(value, passthrough);
  const filter: LootFilter = {
    formatVersion,
    ...header,
    ...(styles === undefined ? {} : { styles }),
    rules,
    leadingComments: [...leadingComments],
    ...(ordered === undefined ? {} : { passthrough: ordered }),
  };
  return { filter, diagnostics: context.diagnostics };
}

/**
 * Warnings about the file text rather than the model: trailing commas and block comments that were accepted (the game's
 * plugin reads them too, the serializer writes strict JSON) and comments after the opening brace (the serializer keeps
 * only the leading `//` lines). One warning per kind, path root. The editor shows them until the model is re-serialized.
 */
export function textNotes({ tolerated, innerComments }: Pick<JsoncParseResult, 'tolerated' | 'innerComments'>): Diagnostic[] {
  const notes: Diagnostic[] = [];
  const firstComma = tolerated.find((entry) => entry.kind === 'trailing-comma');
  if (firstComma) {
    notes.push({
      severity: 'warning',
      path: '',
      message: `Trailing commas were accepted (first at line ${String(firstComma.line)}); the game reads them, but downloads are written without them`,
    });
  }
  const firstBlock = tolerated.find((entry) => entry.kind === 'block-comment');
  if (firstBlock) {
    notes.push({
      severity: 'warning',
      path: '',
      message: `Block comments (/* */) were accepted (first at line ${String(firstBlock.line)}); the game reads them, but they are not kept`,
    });
  }
  const inner = innerComments.length;
  if (inner > 0) {
    notes.push({
      severity: 'warning',
      path: '',
      message:
        inner === 1
          ? `1 comment inside the file (a section note between rules, line ${String(innerComments[0].line)}) is dropped on the first edit; only the comment lines before the opening brace are kept`
          : `${String(inner)} comments inside the file (section notes between rules) are dropped on the first edit; only the comment lines before the opening brace are kept`,
    });
  }
  return notes;
}

export interface ParseLootFilterTextResult extends ParseLootFilterResult {
  /** {@link textNotes}: warnings about the text itself, which re-reading the model cannot reproduce. Not in `diagnostics`. */
  readonly notes: Diagnostic[];
}

/**
 * Parses a filter file (JSON with comments and trailing commas, as the game reads it). Throws `JsoncSyntaxError` when
 * the text is not valid JSON.
 */
export function parseLootFilter(text: string): ParseLootFilterTextResult {
  const jsonc = parseJsonc(text);
  return { ...readLootFilter(jsonc.value, jsonc.leadingComments), notes: textNotes(jsonc) };
}
