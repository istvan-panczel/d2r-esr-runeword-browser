/**
 * Writes the typed model back to a filter file, laid out like the author's converted Sully filter:
 * - leading `//` comments, then the object with 2-space indentation and keys in canonical order;
 * - `filterLevels`, `styles` and `rules` always one entry per line;
 * - a rule or style stays on one line when indentation, the object and its comma fit
 *   {@link ONE_LINE_RULE_WIDTH} characters (a style's name is not counted), otherwise it gets one key per line;
 * - small objects (stat checks, ranges, colours, `labelBorder`, `icon`, `droplight`, level entries) are
 *   always one line; a list of strings or numbers too long for {@link LINE_WIDTH} is wrapped several
 *   values per line (as Sully's `excludeItemCodes`); other values too long for a line are expanded;
 * - strings keep literal `ÿ` (and any other non-ASCII) characters; the file ends with a newline.
 * - enabled rules go to `rules`; disabled ones (`LootFilterRule.disabled`) to a `disabledRules` list after it,
 *   `{ "at": <index in the full rule list>, "rule": {…} }` in ascending `at`, which the plugin ignores; without
 *   disabled rules no `disabledRules` key is written.
 * - a rule whose file wrote `"activeInLevels": 4` keeps the bare number while its levels are still `[4]`
 *   (`LootFilterRule.activeInLevelsNumber`); edited levels are written as a list.
 * - a per-language text drops the languages emptied in the editor (`pruneEmptyLanguages`): the editor keeps them as `''`
 *   while they are edited, so the field stays on its language.
 * - whole-line `//` comments above a top-level key, a rule, a disabled rule or a style are written back above it, after
 *   a blank line (none above the first entry of a list); the comments after the last rule go before the closing bracket.
 *   A blank line between two comment lines (an empty string in the model) is written as an empty line; blank lines at
 *   the start or end of a block are dropped and a run of them is written as one (`tidyCommentBlock`).
 */
import { tidyCommentBlock } from './commentLines.ts';
import { ACTION_KEYS, CONDITION_KEYS, TOP_LEVEL_KEYS, isPlainObject } from './parse.ts';
import { fileText } from './text.ts';
import type { FilterText, LootFilter, LootFilterRule, LootFilterStyle, Passthrough, RuleActions } from './types.ts';

/** Longest line a rule or style is kept on as a whole. */
const ONE_LINE_RULE_WIDTH = 150;
/** Longest line other values are kept on before they wrap or expand. */
const LINE_WIDTH = 140;
/** Longest line of a wrapped list of strings or numbers. */
const PACKED_LIST_WIDTH = 116;

type PlainObject = Record<string, unknown>;

function addPassthrough(out: PlainObject, passthrough: Passthrough | undefined): void {
  if (!passthrough) return;
  for (const [key, value] of Object.entries(passthrough)) {
    if (!Object.hasOwn(out, key)) out[key] = value;
  }
}

/** The rule and style keys that hold a `FilterText`. */
const TEXT_ACTION_KEYS = [
  'replaceName',
  'namePrefix',
  'nameSuffix',
  'chatMessage',
  'chatMessageWhenHidden',
] as const satisfies readonly (keyof RuleActions)[];

function plainActions(source: LootFilterStyle | LootFilterRule, out: PlainObject): void {
  for (const key of ACTION_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  // Same keys, same place: only the emptied languages go.
  for (const key of TEXT_ACTION_KEYS) {
    const text = source[key];
    if (text !== undefined) out[key] = fileText(text);
  }
}

/** The file wrote `activeInLevels` as a single number and the levels are still just that number. */
export function isUntouchedLevelNumber(rule: LootFilterRule): boolean {
  const levels = rule.activeInLevels;
  return rule.activeInLevelsNumber !== undefined && levels?.length === 1 && levels[0] === rule.activeInLevelsNumber;
}

function plainRule(rule: LootFilterRule): PlainObject {
  const out: PlainObject = {};
  for (const key of CONDITION_KEYS) {
    if (rule[key] !== undefined) out[key] = rule[key];
  }
  if (isUntouchedLevelNumber(rule)) out.activeInLevels = rule.activeInLevelsNumber;
  plainActions(rule, out);
  addPassthrough(out, rule.passthrough);
  return out;
}

function plainStyle(style: LootFilterStyle): PlainObject {
  const out: PlainObject = {};
  plainActions(style, out);
  addPassthrough(out, style.passthrough);
  return out;
}

/** The filter as a plain JSON value in canonical key order (no comments). */
export function toPlainJson(filter: LootFilter): PlainObject {
  const out: PlainObject = {};
  for (const key of TOP_LEVEL_KEYS) {
    switch (key) {
      case 'styles':
        if (filter.styles) out.styles = Object.fromEntries(Object.entries(filter.styles).map(([name, style]) => [name, plainStyle(style)]));
        break;
      case 'rules': {
        const enabled = filter.rules.filter((rule) => rule.disabled !== true);
        // A wrong-shaped `rules` list waits in passthrough until the editor has rules of its own.
        if (enabled.length > 0 || filter.passthrough?.rules === undefined) out.rules = enabled.map(plainRule);
        break;
      }
      case 'disabledRules': {
        const disabled = filter.rules.flatMap((rule, at) => (rule.disabled === true ? [{ at, rule: plainRule(rule) }] : []));
        // Without disabled rules a wrong-shaped `disabledRules` list stays in passthrough.
        if (disabled.length > 0) out.disabledRules = disabled;
        break;
      }
      case 'filterLevels':
        if (filter.filterLevels) out.filterLevels = filter.filterLevels.map((level) => ({ ...level, name: fileText(level.name) }));
        break;
      case 'notifications':
        if (filter.notifications) {
          out.notifications = Object.fromEntries(
            Object.entries(filter.notifications).map(([name, text]: [string, FilterText]) => [name, fileText(text)])
          );
        }
        break;
      default:
        if (filter[key] !== undefined) out[key] = filter[key];
    }
  }
  addPassthrough(out, filter.passthrough);
  return out;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

function isPrimitiveList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.every(isPrimitive);
}

/** Small objects that always stay on one line: their values are primitives or lists of primitives. */
function isSmallObject(value: unknown): boolean {
  return isPlainObject(value) && Object.values(value).every((entry) => isPrimitive(entry) || isPrimitiveList(entry));
}

function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .map(([key, entry]) => `${JSON.stringify(key)}: ${inline(entry)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(value);
}

const pad = (indent: number): string => ' '.repeat(indent);

function packedList(list: readonly unknown[], indent: number): string {
  const lines: string[] = [];
  let line = '';
  for (const item of list) {
    const text = `${inline(item)},`;
    if (line !== '' && indent + 2 + line.length + 1 + text.length > PACKED_LIST_WIDTH) {
      lines.push(line);
      line = text;
    } else line = line === '' ? text : `${line} ${text}`;
  }
  if (line !== '') lines.push(line.slice(0, -1));
  return `[\n${lines.map((entry) => pad(indent + 2) + entry).join('\n')}\n${pad(indent)}]`;
}

/** Comment lines at `indent`, each ending with a line break; a blank line is an empty line. */
function commentLines(comments: readonly string[], indent: number): string {
  return tidyCommentBlock(comments)
    .map((line) => (line === '' ? '\n' : `${pad(indent)}${line}\n`))
    .join('');
}

/** The comment lines above an entry at `indent`, after a blank line unless the entry is its container's first. */
function commentBlock(comments: readonly string[] | undefined, indent: number, first: boolean): string {
  const lines = commentLines(comments ?? [], indent);
  if (lines === '') return '';
  return `${first ? '' : '\n'}${lines}`;
}

function expandedList(
  list: readonly unknown[],
  indent: number,
  layout: Layout,
  commentsAt?: (index: number) => readonly string[] | undefined,
  endComments?: readonly string[]
): string {
  const hasEnd = endComments !== undefined && tidyCommentBlock(endComments).length > 0;
  if (list.length === 0 && !hasEnd) return '[]';
  const inner = pad(indent + 2);
  const entries = list.map(
    (entry, index) => commentBlock(commentsAt?.(index), indent + 2, index === 0) + inner + layout(entry, indent + 2, 0)
  );
  // The block ends with a line break; the closing bracket's own line adds it back.
  const end = hasEnd ? `${list.length > 0 ? '\n' : ''}${commentBlock(endComments, indent + 2, list.length === 0)}`.slice(0, -1) : '';
  return `[\n${entries.join(',\n')}${end}\n${pad(indent)}]`;
}

function expandedObject(
  object: Readonly<Record<string, unknown>>,
  indent: number,
  layout: Layout,
  commentsAt?: (key: string) => readonly string[] | undefined
): string {
  const entries = Object.entries(object);
  if (entries.length === 0) return '{}';
  const lines = entries.map(([key, value], index) => {
    const prefix = `${JSON.stringify(key)}: `;
    return commentBlock(commentsAt?.(key), indent + 2, index === 0) + pad(indent + 2) + prefix + layout(value, indent + 2, prefix.length);
  });
  return `{\n${lines.join(',\n')}\n${pad(indent)}}`;
}

/** Lays out `value` that starts `prefix` characters into a line indented by `indent`. */
type Layout = (value: unknown, indent: number, prefix: number) => string;

const layoutValue: Layout = (value, indent, prefix) => {
  const flat = inline(value);
  if (isPrimitive(value) || isSmallObject(value) || indent + prefix + flat.length + 1 <= LINE_WIDTH) return flat;
  if (isPrimitiveList(value)) return packedList(value, indent);
  if (Array.isArray(value)) return expandedList(value, indent, layoutValue);
  if (isPlainObject(value)) return expandedObject(value, indent, layoutValue);
  return flat;
};

/** A rule or style: one line when short enough, otherwise one key per line. */
const layoutEntry: Layout = (value, indent) => {
  const flat = inline(value);
  // A style's `"Name": ` prefix does not count, as in Sully's file.
  if (!isPlainObject(value) || indent + flat.length + 1 <= ONE_LINE_RULE_WIDTH) return flat;
  return expandedObject(value, indent, layoutValue);
};

/** The top-level object; `filter` supplies the comments, which the plain JSON does not hold. */
function layoutTop(value: Readonly<Record<string, unknown>>, filter: LootFilter): string {
  const enabled = filter.rules.filter((rule) => rule.disabled !== true);
  const disabled = filter.rules.filter((rule) => rule.disabled === true);
  return expandedObject(
    value,
    0,
    (entry, entryIndent, prefix) => {
      // A wrong-shaped list waits in passthrough and is laid out as plain JSON below.
      if (entry === value.rules && Array.isArray(entry) && entry.every(isPlainObject)) {
        return expandedList(entry, entryIndent, layoutEntry, (index) => enabled.at(index)?.commentsBefore, filter.rulesEndComments);
      }
      if (entry === value.disabledRules && Array.isArray(entry) && entry.every(isPlainObject)) {
        return expandedList(entry, entryIndent, layoutEntry, (index) => disabled.at(index)?.commentsBefore);
      }
      if (Array.isArray(entry) && entry.length > 0 && entry.every(isPlainObject)) {
        // filterLevels: one entry per line.
        return expandedList(entry, entryIndent, layoutEntry);
      }
      if (entry === value.styles && isPlainObject(entry)) {
        return expandedObject(entry, entryIndent, layoutEntry, (name) => filter.styles?.[name]?.commentsBefore);
      }
      return layoutValue(entry, entryIndent, prefix);
    },
    (key) => filter.keyComments?.[key]
  );
}

/** The filter file: leading comments, the JSON object, a trailing newline. */
export function serializeLootFilter(filter: LootFilter): string {
  const comments = commentLines(filter.leadingComments, 0);
  return `${comments}${layoutTop(toPlainJson(filter), filter)}\n`;
}
