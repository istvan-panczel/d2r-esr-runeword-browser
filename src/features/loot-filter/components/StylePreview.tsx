import { cn } from '@/lib/utils';
import type { LootFilterStyle, MinimapIcon } from '../engine/types';
import { stylePreviewText } from '../utils/stylePresets';
import { LabelPreview } from './LabelPreview';
import { MinimapIconPreview } from './MinimapIconPreview';

export interface StylePreviewProps {
  /** The look to draw: its name colour (`replaceName`), label background and border, and its minimap icon. */
  readonly style: LootFilterStyle;
  /** The item name in place of `{name}`. */
  readonly sample: string;
  /** The icon to draw instead of the style's (a rule's own icon); null draws none. Default: the style's icon. */
  readonly icon?: MinimapIcon | null;
  /** Caps the icon's drawn size (a list row or a button); the tooltip still gives its own size. Default: no cap. */
  readonly maxIconSize?: number;
  /** The colour code text without one is drawn in (`styleNameColors`: what the style's rules give the name). Default: plain white. */
  readonly defaultColor?: string;
  /** Extra classes for the dark ground (width, say). */
  readonly className?: string;
}

/**
 * A small ground label drawn with a style and a sample item name, with its minimap icon beside it at the icon's size
 * (as on the minimap). Pure presentation: the Styles tab's Add preset menu, the example rules picker and the rule's style
 * dropdown (the filter's styles and the presets) use it. A style that hides draws "(empty label)".
 */
export function StylePreview({ style, sample, icon, maxIconSize, defaultColor, className }: StylePreviewProps) {
  const shown = icon === undefined ? style.icon : (icon ?? undefined);
  return (
    <LabelPreview
      text={stylePreviewText(style, sample)}
      background={style.labelBackground}
      border={style.labelBorder}
      defaultColor={defaultColor}
      className={cn('px-2 py-1.5 text-xs', className)}
      trailing={shown === undefined ? undefined : <MinimapIconPreview icon={shown} maxSize={maxIconSize} />}
    />
  );
}
