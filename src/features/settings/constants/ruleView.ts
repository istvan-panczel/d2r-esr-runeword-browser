import type { RuleViewMode } from './types';

/** localStorage key of the loot filter rule editor's Basic / Advanced view. */
export const RULE_VIEW_STORAGE_KEY = 'lootFilterRuleView';

/** New players see the common fields first; existing users start there too. */
export const DEFAULT_RULE_VIEW: RuleViewMode = 'basic';

/** The views in toggle order, with their labels. */
export const RULE_VIEW_OPTIONS: readonly { readonly value: RuleViewMode; readonly label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced' },
];

export function isRuleViewMode(value: unknown): value is RuleViewMode {
  return RULE_VIEW_OPTIONS.some((option) => option.value === value);
}
