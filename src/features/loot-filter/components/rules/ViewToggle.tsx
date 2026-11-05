import { useDispatch, useSelector } from 'react-redux';
import { RULE_VIEW_OPTIONS, selectRuleView, setRuleView, type RuleViewMode } from '@/features/settings';
import { SegmentedControl, type SegmentedOption } from './conditions/SegmentedControl';

/** Whose editor the toggle switches: the rule editor (conditions and actions) or the Styles tab's (actions only). */
export type ViewOwner = 'rule' | 'style';

const VIEW_TITLES: Readonly<Record<ViewOwner, Readonly<Record<RuleViewMode, string>>>> = {
  rule: {
    basic: 'The common conditions and actions; a set Advanced field still shows, tagged "advanced"',
    advanced: 'Every condition and action',
  },
  style: {
    basic: 'The common actions; a set Advanced field still shows, tagged "advanced"',
    advanced: 'Every action',
  },
};

const viewOptions = (owner: ViewOwner): readonly SegmentedOption<RuleViewMode>[] =>
  RULE_VIEW_OPTIONS.map((option) => ({ ...option, title: VIEW_TITLES[owner][option.value] }));

/**
 * The Basic / Advanced toggle of the rule editor and the Styles tab: one setting (`ruleView`) for the whole editor.
 * `id` goes on the wrapper, so "Show Advanced view" can move the focus to the pressed button.
 */
export function ViewToggle({ id, owner }: { readonly id: string; readonly owner: ViewOwner }) {
  const dispatch = useDispatch();
  const view = useSelector(selectRuleView);
  return (
    <div id={id}>
      <SegmentedControl
        aria-label={owner === 'rule' ? 'Rule view' : 'Style view'}
        className="h-8"
        value={view}
        options={viewOptions(owner)}
        onChange={(next) => dispatch(setRuleView(next))}
      />
    </div>
  );
}

interface MoreInAdvancedProps {
  readonly count: number;
  readonly noun: string;
  /** The `ViewToggle`'s id: the focus moves to it, since the line goes away with its button. */
  readonly toggleId: string;
}

/** "N more conditions in the Advanced view" with a button that switches to it (Basic view only). */
export function MoreInAdvanced({ count, noun, toggleId }: MoreInAdvancedProps) {
  const dispatch = useDispatch();
  if (count === 0) return null;
  const showAdvanced = () => {
    dispatch(setRuleView('advanced'));
    requestAnimationFrame(() => {
      document.getElementById(toggleId)?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    });
  };
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
      <span>
        {count} more {noun}
        {count === 1 ? '' : 's'} in the Advanced view.
      </span>
      <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={showAdvanced}>
        Show Advanced view
      </button>
    </p>
  );
}
