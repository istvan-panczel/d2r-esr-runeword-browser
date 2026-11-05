/**
 * The selection model of the example rules picker (the Rules tab's dialog, and any other place that builds a starter
 * rule set): which examples are ticked with which presentation choices, plus three switches that turn every sound,
 * chat line or minimap icon off. Pure state updates and the build step that turns a selection into rules and styles.
 */
import type { LootFilterRule, LootFilterStyle } from '../engine/types';
import {
  buildExampleRule,
  defaultChoices,
  EXAMPLE_GROUPS,
  EXAMPLE_RULES,
  isHideExample,
  type ExampleChoices,
  type ExampleGroupId,
  type ExampleRule,
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

/** `all`, `some` or `none` of the group's examples are ticked. */
export function groupSelection(state: ExamplePickerState, group: ExampleGroupId): 'all' | 'some' | 'none' {
  const examples = groupExamples(group);
  const count = examples.filter((example) => Object.hasOwn(state.selected, example.id)).length;
  if (count === 0) return 'none';
  return count === examples.length ? 'all' : 'some';
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

export interface StarterRules {
  readonly rules: readonly LootFilterRule[];
  /** Every style the rules use, by name, in first-use order. */
  readonly styles: Readonly<Record<string, LootFilterStyle>>;
}

/** The rules and styles of the ticked examples (see `orderedSelection` for the order). */
export function buildStarterRules(state: ExamplePickerState): StarterRules {
  const rules: LootFilterRule[] = [];
  const styles: Record<string, LootFilterStyle> = {};
  for (const example of orderedSelection(state)) {
    // orderedSelection lists ticked examples only, so the choices are there.
    const built = buildExampleRule(example, effectiveChoices(state, state.selected[example.id]));
    rules.push(built.rule);
    for (const [name, style] of Object.entries(built.stylesToAdd)) if (!Object.hasOwn(styles, name)) styles[name] = style;
  }
  return { rules, styles };
}

/** The starter rules of the given example ids with their default choices (for callers without a picker). */
export function starterRulesFor(ids: readonly string[]): StarterRules {
  return buildStarterRules(setExamplesSelected(INITIAL_PICKER_STATE, ids, true));
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
