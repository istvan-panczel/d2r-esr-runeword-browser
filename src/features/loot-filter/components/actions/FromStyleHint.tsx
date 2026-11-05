import type { ReactNode } from 'react';
import { DEFAULT_LABEL_BACKGROUND_ALPHA, type LabelColor } from '../../engine/types';
import { labelRgba } from '../../engine/colors';
import { formatColor } from '../../utils/colorValues';

/** "From style “X”: …": what the rule's style sets for a field the rule leaves empty. */
export function FromStyleHint({ styleName, children }: { readonly styleName: string; readonly children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span>From style “{styleName}”:</span>
      {children}
    </span>
  );
}

/** A colour swatch and its numbers, for a style's background or border colour. */
export function ColorValue({
  color,
  defaultAlpha = DEFAULT_LABEL_BACKGROUND_ALPHA,
}: {
  readonly color: LabelColor;
  readonly defaultAlpha?: number;
}) {
  return (
    <>
      <span
        className="inline-block size-3 shrink-0 rounded-sm border"
        style={{ backgroundColor: labelRgba(color, defaultAlpha) }}
        aria-hidden
      />
      <span className="font-mono">{formatColor(color)}</span>
    </>
  );
}
