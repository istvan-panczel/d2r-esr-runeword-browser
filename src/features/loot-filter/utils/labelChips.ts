/**
 * The JSON editor's gutter chips: one tiny ground-label swatch per rule and style that sets a label colour, on the
 * line where it starts. Pure data; the editor draws them.
 */
import { colorCodeRgb, findColorCode, labelRgba } from '../engine/colors';
import { locateJsoncChildren, locateJsoncPath } from '../engine/jsoncLocate';
import { parseLootFilter, ruleFilePaths } from '../engine/parse';
import { splitColorRuns } from '../engine/text';
import { DEFAULT_LABEL_BACKGROUND_ALPHA, type LabelColor, type LootFilter, type RuleActions } from '../engine/types';
import { effectiveActions, findStyle, previewLabelText } from './effectiveActions';

export interface LabelChip {
  /** 0-based offset in the text where the rule/style object starts (its line gets the chip). */
  readonly offset: number;
  /** CSS colours, already resolved (rgba() strings) or null when not set. */
  readonly textColor: string | null; // first ÿc colour of the label text; null = default
  readonly background: string | null; // labelBackground with the plugin's default alpha applied
  readonly border: { readonly color: string; readonly width: number } | null;
  /** Hover text, e.g. "Rule 12 · text ÿc1 red · background 255,255,255 · border 240,0,0 (2 px) · style Jackpot". */
  readonly title: string;
}

/** `255,255,255`: the title leaves the alpha out. */
function rgbText(color: LabelColor): string {
  return `${String(color[0])},${String(color[1])},${String(color[2])}`;
}

interface Look {
  readonly textColor: string | null;
  readonly background: string | null;
  readonly border: LabelChip['border'];
  /** The title parts after the owner's name. */
  readonly parts: readonly string[];
}

/** The chip colours of a set of (already merged) actions; a hidden label has no text, so no text colour. */
function lookOf(actions: RuleActions): Look {
  const parts: string[] = [];
  if (actions.hide === true) parts.push('hidden');
  let textColor: string | null = null;
  if (actions.hide !== true) {
    const code = splitColorRuns(previewLabelText(actions)).find((segment) => segment.kind === 'text' && segment.color !== null);
    const color = code?.kind === 'text' ? code.color : null;
    const rgb = color === null ? undefined : colorCodeRgb(color);
    if (color !== null && rgb) {
      textColor = labelRgba(rgb, 255);
      parts.push(`text ÿc${color} ${findColorCode(color)?.name ?? ''}`.trimEnd());
    }
  }
  const { labelBackground, labelBorder } = actions;
  if (labelBackground) parts.push(`background ${rgbText(labelBackground)}`);
  if (labelBorder) parts.push(`border ${rgbText(labelBorder.color)} (${String(labelBorder.width)} px)`);
  return {
    textColor,
    background: labelBackground ? labelRgba(labelBackground, DEFAULT_LABEL_BACKGROUND_ALPHA) : null,
    // As LabelPreview: a border colour without alpha is opaque, a negative width draws as 0.
    border: labelBorder ? { color: labelRgba(labelBorder.color, 255), width: Math.max(0, labelBorder.width) } : null,
    parts,
  };
}

function sameLook(a: Look, b: Look): boolean {
  return (
    a.textColor === b.textColor &&
    a.background === b.background &&
    a.border?.color === b.border?.color &&
    a.border?.width === b.border?.width
  );
}

function chip(offset: number, name: string, look: Look, suffix: readonly string[] = []): LabelChip | undefined {
  if (look.textColor === null && look.background === null && look.border === null) return undefined;
  const { textColor, background, border } = look;
  return { offset, textColor, background, border, title: [name, ...look.parts, ...suffix].join(' · ') };
}

/**
 * Where each rule object starts, by its file path (`rules/<n>`, `disabledRules/<n>/rule`). One walk per list, not
 * one per rule: a 70 KB file has hundreds of rules.
 */
function ruleOffsets(text: string): Map<string, number> {
  const offsets = new Map<string, number>();
  for (const { key, range } of locateJsoncChildren(text, 'rules') ?? []) offsets.set(`rules/${String(key)}`, range.from);
  for (const { key, range } of locateJsoncChildren(text, 'disabledRules') ?? []) {
    // Look for "rule" inside the entry only, so the cost stays the entry's size.
    const inner = locateJsoncPath(text.slice(range.from, range.to), 'rule');
    offsets.set(`disabledRules/${String(key)}/rule`, range.from + (inner?.from ?? 0));
  }
  return offsets;
}

/** Where each style member starts (its key's opening quote), by name; of equal names the last, as JSON.parse keeps. */
function styleOffsets(text: string): Map<string, number> {
  const offsets = new Map<string, number>();
  for (const { key, range } of locateJsoncChildren(text, 'styles') ?? []) offsets.set(String(key), range.from);
  return offsets;
}

function ruleChips(text: string, filter: LootFilter): LabelChip[] {
  const offsets = ruleOffsets(text);
  const paths = ruleFilePaths(filter.rules);
  const chips: LabelChip[] = [];
  filter.rules.forEach((rule, index) => {
    const offset = offsets.get(paths[index]);
    if (offset === undefined) return;
    const look = lookOf(effectiveActions(rule, filter));
    // Name the style only when it changed what the chip shows.
    const styleName = findStyle(rule, filter) && !sameLook(look, lookOf(rule)) ? rule.useStyle : undefined;
    const name = `Rule ${String(index + 1)}${rule.disabled === true ? ' (disabled)' : ''}`;
    const result = chip(offset, name, look, styleName === undefined ? [] : [`style ${styleName}`]);
    if (result) chips.push(result);
  });
  return chips;
}

function styleChips(text: string, filter: LootFilter): LabelChip[] {
  const offsets = styleOffsets(text);
  const chips: LabelChip[] = [];
  for (const [name, style] of Object.entries(filter.styles ?? {})) {
    const offset = offsets.get(name);
    if (offset === undefined) continue;
    const result = chip(offset, `Style ${name}`, lookOf(style));
    if (result) chips.push(result);
  }
  return chips;
}

/** Chips for every rule (incl. disabledRules) and style that sets a label colour; undefined when the text does not parse. */
export function computeLabelChips(text: string): readonly LabelChip[] | undefined {
  let filter: LootFilter;
  try {
    filter = parseLootFilter(text).filter;
  } catch {
    return undefined;
  }
  return [...styleChips(text, filter), ...ruleChips(text, filter)].sort((a, b) => a.offset - b.offset);
}
