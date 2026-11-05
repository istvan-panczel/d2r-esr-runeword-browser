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
  /** Extra classes for the dark ground (width, say). */
  readonly className?: string;
}

/**
 * A small ground label drawn with a style and a sample item name, with its minimap icon beside it at the icon's size
 * (as on the minimap). Pure presentation: the Styles tab's Add preset menu, the example rules picker and the style
 * dropdown use it.
 */
export function StylePreview({ style, sample, icon, className }: StylePreviewProps) {
  const shown = icon === undefined ? style.icon : (icon ?? undefined);
  return (
    <LabelPreview
      text={stylePreviewText(style, sample)}
      background={style.labelBackground}
      border={style.labelBorder}
      className={cn('px-2 py-1.5 text-xs', className)}
      trailing={shown === undefined ? undefined : <MinimapIconPreview icon={shown} />}
    />
  );
}
