import type { ReactNode } from 'react';
import type { RuleActions } from '../../engine/types';
import type { ShallowPatch } from '../../utils/patch';
import { actionOrigin, collapseToStyle, type ActionOrigin, type StyleKey } from '../../utils/styleChoice';
import { StyleValueMark } from './StyleValueMark';

/**
 * Where each action field's value comes from in the actions editor: a rule with a style shows the style's value in
 * every field the style sets ("from style X"); editing it makes the rule's own override ("changed from style X",
 * Reset to style). Without a style (a rule without one, or the Styles tab) every field is just its own value.
 */
export interface StyleValues {
  /** The style's name, when the rule's style is in the filter. */
  readonly styleName: string | undefined;
  /** What the field shows: the rule's own value, else the style's. */
  readonly value: <K extends StyleKey>(key: K) => RuleActions[K];
  readonly origin: (key: StyleKey) => ActionOrigin;
  /** The style sets this key (whether the rule overrides it or not). */
  readonly fromStyle: (key: StyleKey) => boolean;
  /** The field's label extras: `extra` (the "advanced" badge) and the style mark; undefined when neither. */
  readonly badge: (key: StyleKey, extra?: ReactNode) => ReactNode;
  /** Sends a patch; a key set to exactly the style's value is removed (the field shows the style's value again). */
  readonly change: (patch: ShallowPatch<RuleActions>) => void;
  /**
   * A checkbox's value: unticked removes the key, except over a style that sets it, where `false` is the rule's own
   * override (the rule's own key wins, per key); ticking back to the style's value removes it again (`change`).
   */
  readonly flag: (key: StyleKey, checked: boolean) => boolean | undefined;
}

export function styleValues(
  own: RuleActions,
  style: RuleActions | undefined,
  styleName: string | undefined,
  onChange: (patch: ShallowPatch<RuleActions>) => void
): StyleValues {
  const active = style !== undefined && styleName !== undefined ? style : undefined;
  const origin = (key: StyleKey) => actionOrigin(own, active, key);
  return {
    styleName: active === undefined ? undefined : styleName,
    value: (key) => own[key] ?? active?.[key],
    origin,
    fromStyle: (key) => active?.[key] !== undefined,
    badge: (key, extra) => {
      const where = origin(key);
      const mark =
        styleName !== undefined && (where === 'style' || where === 'changed') ? (
          <StyleValueMark
            origin={where}
            styleName={styleName}
            onReset={() => {
              onChange({ [key]: undefined });
            }}
          />
        ) : undefined;
      if (mark === undefined) return extra;
      return (
        <>
          {extra}
          {mark}
        </>
      );
    },
    change: (patch) => {
      onChange(collapseToStyle(patch, active));
    },
    flag: (key, checked) => {
      if (checked) return true;
      return active?.[key] === undefined ? undefined : false;
    },
  };
}
