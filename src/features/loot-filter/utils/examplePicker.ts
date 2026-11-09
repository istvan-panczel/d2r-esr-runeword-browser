/**
 * The selection model of the example rules picker (the Rules tab's dialog, and any other place that builds a starter
 * rule set): which examples are ticked with which presentation choices, plus three switches that turn every sound,
 * chat line or minimap icon off. Pure state updates and the build step that turns a selection into rules and styles.
 * Bulk selects never tick a hide rule among label rules (owner decision): Select all ticks the label rules, a group's
 * checkbox its label rules, and only the Hide junk group's checkbox, a group of hide rules alone, ticks hide rules.
 */
import type { LootFilterRule, LootFilterStyle } from '../engine/types';
import { headingLine, readCommentLine } from './sections';
import {
  buildExampleSet,
  defaultChoices,
  EXAMPLE_GROUPS,
  EXAMPLE_RULES,
  isHideExample,
  type ExampleChoices,
  type ExampleGroupId,
  type ExampleRule,
  type ExampleSet,
} from './exampleRules';
import { presetStyleStatus } from './stylePresets';

export interface ExamplePickerState {
  /** Ticked examples by id, with their choices (a choice survives switching a bulk switch on and off). */
  readonly selected: Readonly<Record<string, ExampleChoices>>;
  readonly noSounds: boolean;
  readonly noChat: boolean;
  readonly noIcons: boolean;
}

export type PickerSwitch = 'noSounds' | 'noChat' | 'noIcons';

export const INITIAL_PICKER_STATE: ExamplePickerState = { selected: {}, noSounds: false, noChat: false, noIcons: false };

/** Ticks (with the example's default choices) or unticks examples; ticking a ticked one keeps its choices. */
export function setExamplesSelected(state: ExamplePickerState, ids: readonly string[], on: boolean): ExamplePickerState {
  if (!on) return { ...state, selected: Object.fromEntries(Object.entries(state.selected).filter(([id]) => !ids.includes(id))) };
  const selected = { ...state.selected };
  for (const id of ids) {
    const example = EXAMPLE_RULES.find((entry) => entry.id === id);
    if (example !== undefined && !Object.hasOwn(selected, id)) selected[id] = defaultChoices(example);
  }
  return { ...state, selected };
}

/** Changes one choice of a ticked example; no-op for an unticked one. */
export function setExampleChoice<K extends keyof ExampleChoices>(
  state: ExamplePickerState,
  id: string,
  key: K,
  value: ExampleChoices[K]
): ExamplePickerState {
  if (!Object.hasOwn(state.selected, id)) return state;
  return { ...state, selected: { ...state.selected, [id]: { ...state.selected[id], [key]: value } } };
}

export function setPickerSwitch(state: ExamplePickerState, key: PickerSwitch, on: boolean): ExamplePickerState {
  return { ...state, [key]: on };
}

/** The examples of a group, in list order. */
export function groupExamples(group: ExampleGroupId): readonly ExampleRule[] {
  return EXAMPLE_RULES.filter((example) => example.group === group);
}

/**
 * What a group's "select all" checkbox ticks: `all` its examples (it has no hide rule), its `labels` rules only (a hide
 * rule among label rules needs its own tick) or, in a group of hide rules only (Hide junk), its `hides`: there the
 * click can mean nothing else.
 */
export function groupBulkKind(group: ExampleGroupId): 'all' | 'labels' | 'hides' {
  const examples = groupExamples(group);
  const hides = examples.filter(isHideExample).length;
  if (hides === 0) return 'all';
  return hides === examples.length ? 'hides' : 'labels';
}

/** The examples a group's "select all" ticks (see `groupBulkKind`). */
function groupBulkExamples(group: ExampleGroupId): readonly ExampleRule[] {
  const examples = groupExamples(group);
  return groupBulkKind(group) === 'labels' ? examples.filter((example) => !isHideExample(example)) : examples;
}

/** "Select all": ticks every label rule; hide rules always need a deliberate tick (one by one or by their group). */
export function selectAllLabelRules(state: ExamplePickerState): ExamplePickerState {
  return setExamplesSelected(
    state,
    EXAMPLE_RULES.filter((example) => !isHideExample(example)).map((example) => example.id),
    true
  );
}

/** A group's "select all" checkbox: on ticks what `groupBulkKind` says; off unticks the whole group, hide rules too. */
export function setGroupSelected(state: ExamplePickerState, group: ExampleGroupId, on: boolean): ExamplePickerState {
  const examples = on ? groupBulkExamples(group) : groupExamples(group);
  return setExamplesSelected(
    state,
    examples.map((example) => example.id),
    on
  );
}

/**
 * The group checkbox's state: `none` ticked, `all` that its "select all" ticks (a hide rule left unticked among label
 * rules does not make it partial, so the next click unticks the group), else `some`.
 */
export function groupSelection(state: ExamplePickerState, group: ExampleGroupId): 'all' | 'some' | 'none' {
  const ticked = (example: ExampleRule) => Object.hasOwn(state.selected, example.id);
  if (!groupExamples(group).some(ticked)) return 'none';
  return groupBulkExamples(group).every(ticked) ? 'all' : 'some';
}

/** A ticked example's choices with the bulk switches applied. */
export function effectiveChoices(state: ExamplePickerState, choices: ExampleChoices): ExampleChoices {
  return {
    ...choices,
    sound: state.noSounds ? null : choices.sound,
    chatMessage: state.noChat ? null : choices.chatMessage,
    icon: state.noIcons ? null : choices.icon,
  };
}

/** The ticked examples in insertion order: label rules by group and list order, then the hide rules in the same order. */
export function orderedSelection(state: ExamplePickerState): readonly ExampleRule[] {
  const groupOrder = new Map(EXAMPLE_GROUPS.map((group, index) => [group.id, index]));
  const ticked = EXAMPLE_RULES.map((example, index) => ({ example, index })).filter(({ example }) =>
    Object.hasOwn(state.selected, example.id)
  );
  const rank = (example: ExampleRule) => (isHideExample(example) ? 1 : 0);
  return ticked
    .sort(
      (a, b) =>
        rank(a.example) - rank(b.example) ||
        (groupOrder.get(a.example.group) ?? 0) - (groupOrder.get(b.example.group) ?? 0) ||
        a.index - b.index
    )
    .map(({ example }) => example);
}

/** The rules and styles of a starter set (see `buildExampleSet`). */
export type StarterRules = ExampleSet;

type Styles = Readonly<Record<string, LootFilterStyle>>;

/**
 * The rules and styles of the ticked examples (see `orderedSelection` for the order). `existing` is the filter's
 * styles: a name it holds is kept, and the rules get exactly the icons they chose against it (`buildExampleSet`).
 */
export function buildStarterRules(state: ExamplePickerState, existing?: Styles): StarterRules {
  return buildExampleSet(
    // orderedSelection lists ticked examples only, so the choices are there.
    orderedSelection(state).map((example) => ({ example, choices: effectiveChoices(state, state.selected[example.id]) })),
    existing
  );
}

/** The starter rules of the given example ids with their default choices (for callers without a picker). */
export function starterRulesFor(ids: readonly string[], existing?: Styles): StarterRules {
  return buildStarterRules(setExamplesSelected(INITIAL_PICKER_STATE, ids, true), existing);
}

export interface StyleMerge {
  /** Styles the filter lacks: add these. */
  readonly add: Readonly<Record<string, LootFilterStyle>>;
  /** Names the filter already has with other content: its own style is kept and the rules use it. */
  readonly reused: readonly string[];
}

/** Splits wanted styles into those to add and those whose name the filter already uses for a different style. */
export function mergeStyles(
  existing: Readonly<Record<string, LootFilterStyle>> | undefined,
  wanted: Readonly<Record<string, LootFilterStyle>>
): StyleMerge {
  const add: Record<string, LootFilterStyle> = {};
  const reused: string[] = [];
  for (const [name, style] of Object.entries(wanted)) {
    const status = presetStyleStatus(existing, { name, style });
    if (status === 'missing') add[name] = style;
    else if (status === 'different') reused.push(name);
  }
  return { add, reused };
}

/** The heading the example rules dialog writes above the hide rules, which go in last whatever their group. */
export const HIDE_RULES_HEADING = 'Hide rules';

/** The titles of the headings in these comment lines, lower-cased (to skip a heading the filter already has). */
export function headingTitles(lines: readonly string[]): Set<string> {
  return new Set(
    lines.flatMap((line) => {
      const read = readCommentLine(line);
      return read.kind === 'heading' ? [read.title.toLowerCase()] : [];
    })
  );
}

/**
 * The starter rules with a `// ---- <group title>` section heading above the first rule of each group (all hide rules
 * under one "Hide rules" heading), in the order `orderedSelection` gives. A title in `existing` (lower-cased heading
 * titles of the filter) is not written again. `examples` and `rules` are the same length and order.
 */
export function withGroupHeadings(
  examples: readonly ExampleRule[],
  rules: readonly LootFilterRule[],
  existing: ReadonlySet<string>
): LootFilterRule[] {
  const titles = new Map(EXAMPLE_GROUPS.map((group) => [group.id, group.title]));
  let previous: string | undefined;
  return rules.map((rule, index) => {
    const example = examples.at(index);
    const title = example === undefined ? undefined : isHideExample(example) ? HIDE_RULES_HEADING : titles.get(example.group);
    const starts = title !== undefined && title !== previous;
    previous = title;
    if (!starts || existing.has(title.toLowerCase())) return rule;
    return { ...rule, commentsBefore: [...(rule.commentsBefore ?? []), headingLine(2, title)] };
  });
}
