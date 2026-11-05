import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LootFilter, RuleActions } from '../../engine/types';
import { findStyle } from '../../utils/effectiveActions';
import type { ShallowPatch } from '../../utils/patch';
import { Field } from '../Field';
import { Section } from './Section';
import { StyleSummary } from './StyleSummary';

interface StyleSectionProps {
  /** Prefix of the controls' ids. */
  readonly idPrefix: string;
  /** The rule's own actions. */
  readonly actions: RuleActions;
  /** The whole filter, for its style list. */
  readonly filter: LootFilter;
  readonly onChange: (patch: ShallowPatch<RuleActions>) => void;
  /** Shown after the field's label (the Basic view's "advanced" tag). */
  readonly badge?: React.ReactNode;
}

const NO_STYLE = '__none';

/** A rule's `useStyle`: the style picker and a collapsed summary of the chosen style's actions. */
export function StyleSection({ idPrefix, actions, filter, onChange, badge }: StyleSectionProps) {
  const selectId = `${idPrefix}-use-style`;
  const style = findStyle(actions, filter);
  const styleNames = Object.keys(filter.styles ?? {});

  let hint: string;
  if (actions.useStyle === undefined) hint = 'Pulls in a named set of actions from the Styles tab.';
  else if (style === undefined) hint = `The filter has no style "${actions.useStyle}".`;
  else hint = "The style's actions apply underneath; the rule's own actions win.";

  return (
    <Section title="Style">
      <Field id={selectId} label="Use style" hint={hint} badge={badge}>
        <Select
          value={actions.useStyle ?? NO_STYLE}
          onValueChange={(value) => {
            onChange({ useStyle: value === NO_STYLE ? undefined : value });
          }}
        >
          <SelectTrigger id={selectId} className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_STYLE}>None</SelectItem>
            {actions.useStyle !== undefined && !styleNames.includes(actions.useStyle) && (
              <SelectItem value={actions.useStyle}>{actions.useStyle} (missing)</SelectItem>
            )}
            {styleNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {style !== undefined && actions.useStyle !== undefined && <StyleSummary name={actions.useStyle} style={style} />}
    </Section>
  );
}
