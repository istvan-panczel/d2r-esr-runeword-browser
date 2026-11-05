/**
 * The starter of the AI page: the filter the prompt asks the LLM to start from. Sources: none (a new filter), a bundled
 * template, a draft in this browser, the filter open in the editor ("Improve with AI", handed over in the router
 * state), an uploaded file, or rules picked from the example rules (`{ rules, styles }`, the shape the example rule
 * picker's `onConfirm(rules, styles)` gives).
 */
import { parseLootFilter } from '../engine/parse';
import { serializeLootFilter } from '../engine/serialize';
import { FORMAT_VERSION, type LootFilterRule, type LootFilterStyle } from '../engine/types';
import type { BundledTemplateId } from './template';

export type AiStarterChoice =
  | { readonly kind: 'none' }
  | { readonly kind: 'template'; readonly template: BundledTemplateId }
  | { readonly kind: 'entry'; readonly entryId: string }
  | { readonly kind: 'open' }
  | { readonly kind: 'upload' }
  | { readonly kind: 'rules' };

/** The filter "Improve with AI" hands to the AI page (router state `aiStarter`). */
export interface AiOpenFilter {
  readonly name: string;
  readonly text: string;
}

/** Rules (and the styles they use) picked from the example rules. */
export interface ExampleRulesStarter {
  readonly rules: readonly LootFilterRule[];
  readonly styles: Readonly<Record<string, LootFilterStyle>>;
}

/** A starter ready for the prompt: label, file text and rule count. */
export interface ResolvedStarter {
  readonly label: string;
  readonly text: string;
  readonly ruleCount: number;
  /** Picked from the example rules (`starterFromRules`): the prompt treats it as a skeleton, not a finished filter. */
  readonly fromExamples?: boolean;
}

export type StarterResult = { readonly ok: true; readonly starter: ResolvedStarter } | { readonly ok: false; readonly message: string };

/** A filter file as a starter; refused when it is not valid JSON (the LLM would get a broken file). */
export function starterFromText(label: string, text: string): StarterResult {
  try {
    const { filter } = parseLootFilter(text);
    return { ok: true, starter: { label, text, ruleCount: filter.rules.length } };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Picked example rules as a starter file: one level, the styles they use, the rules in order. */
export function starterFromRules({ rules, styles }: ExampleRulesStarter, label?: string): ResolvedStarter {
  const text = serializeLootFilter({
    formatVersion: FORMAT_VERSION,
    title: 'AI filter',
    filterLevels: [{ id: 1, name: 'Default' }],
    defaultLevel: 1,
    ...(Object.keys(styles).length === 0 ? {} : { styles }),
    rules,
    leadingComments: [],
  });
  const count = `${String(rules.length)} example ${rules.length === 1 ? 'rule' : 'rules'}`;
  return { label: label ?? count, text, ruleCount: rules.length, fromExamples: true };
}

/** The router state key "Improve with AI" uses. */
export const AI_STARTER_STATE_KEY = 'aiStarter';

/** The editor's filter from the router state, or null when the page was opened otherwise. */
export function readAiOpenFilter(state: unknown): AiOpenFilter | null {
  if (typeof state !== 'object' || state === null || !(AI_STARTER_STATE_KEY in state)) return null;
  const value: unknown = (state as Record<string, unknown>)[AI_STARTER_STATE_KEY];
  if (typeof value !== 'object' || value === null) return null;
  const { name, text } = value as Record<string, unknown>;
  return typeof name === 'string' && typeof text === 'string' ? { name, text } : null;
}

/** The router state for "Improve with AI". */
export function aiStarterState(filter: AiOpenFilter): Record<string, AiOpenFilter> {
  return { [AI_STARTER_STATE_KEY]: filter };
}

/** The `Select` value of a choice and back (entries by id). */
export function starterChoiceValue(choice: AiStarterChoice): string {
  switch (choice.kind) {
    case 'template':
      return `template:${choice.template}`;
    case 'entry':
      return `entry:${choice.entryId}`;
    default:
      return choice.kind;
  }
}

export function parseStarterChoice(value: string, templates: readonly BundledTemplateId[]): AiStarterChoice {
  if (value.startsWith('template:')) {
    const id = value.slice('template:'.length);
    const template = templates.find((entry) => entry === id);
    return template === undefined ? { kind: 'none' } : { kind: 'template', template };
  }
  if (value.startsWith('entry:')) return { kind: 'entry', entryId: value.slice('entry:'.length) };
  if (value === 'open' || value === 'upload' || value === 'rules') return { kind: value };
  return { kind: 'none' };
}
