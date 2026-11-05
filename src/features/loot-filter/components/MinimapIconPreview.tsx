import { cn } from '@/lib/utils';
import type { MinimapIcon } from '../engine/types';
import { useBundledSprite } from '../hooks/useBundledSprite';
import { findBundledIcon } from '../utils/bundledAssets';
import { spriteDrawSize } from '../utils/spriteSize';
import { SpriteCanvas } from './SpriteCanvas';

interface MinimapIconPreviewProps {
  readonly icon: MinimapIcon;
  /** Caps the drawn longer side (a list row); the tooltip still gives the icon's own size. Default: no cap. */
  readonly maxSize?: number;
  readonly className?: string;
}

const iconDescription = (icon: MinimapIcon) =>
  `Minimap icon ${icon.iconName}${icon.iconSize === undefined ? '' : `, ${String(icon.iconSize)} px`}${icon.color === undefined ? '' : ', tinted'}`;

/**
 * A minimap icon drawn as on the minimap: the first frame at `iconSize` pixels (its longer side), tinted by `color`.
 * Bundled icons only (decoded once per name and cached, `useBundledSprite`); another name shows a dashed box of that
 * size with the name in its tooltip. Draw it on a dark backdrop (`StylePreview` puts it beside the label).
 */
export function MinimapIconPreview({ icon, maxSize, className }: MinimapIconPreviewProps) {
  const bundled = findBundledIcon(icon.iconName);
  const state = useBundledSprite(bundled);
  const description = iconDescription(icon);
  if (state.status === 'ready') {
    const { width, height } = spriteDrawSize(state.sprite, icon.iconSize, maxSize);
    return (
      <span className={cn('inline-flex shrink-0', className)}>
        <SpriteCanvas
          sprite={state.sprite}
          color={icon.color}
          width={width}
          height={height}
          role="img"
          aria-label={description}
          title={description}
        />
      </span>
    );
  }
  const side = Math.min(maxSize ?? 64, 64, Math.max(12, icon.iconSize ?? 32));
  const failed = bundled === undefined || state.status === 'error';
  return (
    <span
      role="img"
      aria-label={description}
      title={failed ? `${description} (not bundled here, no preview)` : description}
      className={cn('inline-block shrink-0 rounded-sm', failed && 'border border-dashed border-neutral-500', className)}
      style={{ width: side, height: side }}
    />
  );
}
