import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { DecodedSprite } from '../engine/sprite';
import type { MinimapIcon } from '../engine/types';
import { useBundledSprite } from '../hooks/useBundledSprite';
import { findBundledIcon } from '../utils/bundledAssets';
import { tintSprite } from '../utils/tintSprite';

interface MinimapIconPreviewProps {
  readonly icon: MinimapIcon;
  readonly className?: string;
}

/** The drawn size of a sprite for `iconSize` (its longer side, 4 to 256; absent = the file's size), keeping proportions. */
function drawSize(sprite: DecodedSprite, iconSize: number | undefined): { readonly width: number; readonly height: number } {
  const longer = Math.max(sprite.width, sprite.height);
  const target = iconSize === undefined ? longer : Math.min(256, Math.max(4, iconSize));
  const scale = target / longer;
  return { width: Math.max(1, Math.round(sprite.width * scale)), height: Math.max(1, Math.round(sprite.height * scale)) };
}

const iconDescription = (icon: MinimapIcon) =>
  `Minimap icon ${icon.iconName}${icon.iconSize === undefined ? '' : `, ${String(icon.iconSize)} px`}${icon.color === undefined ? '' : ', tinted'}`;

function IconCanvas({ sprite, icon }: { readonly sprite: DecodedSprite; readonly icon: MinimapIcon }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = drawSize(sprite, icon.iconSize);
  const { color } = icon;

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    const source = document.createElement('canvas');
    source.width = sprite.width;
    source.height = sprite.height;
    const sourceContext = source.getContext('2d');
    if (!context || !sourceContext) return;
    const pixels = new ImageData(sprite.width, sprite.height);
    pixels.data.set(tintSprite(sprite.rgba, color));
    sourceContext.putImageData(pixels, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.drawImage(source, 0, 0, width, height);
  }, [sprite, color, width, height]);

  return (
    <canvas ref={canvasRef} width={width} height={height} role="img" aria-label={iconDescription(icon)} title={iconDescription(icon)} />
  );
}

/**
 * A minimap icon drawn as on the minimap: the first frame at `iconSize` pixels (its longer side), tinted by `color`.
 * Bundled icons only (decoded once per name and cached, `useBundledSprite`); another name shows a dashed box of that
 * size with the name in its tooltip. Draw it on a dark backdrop (`StylePreview` puts it beside the label).
 */
export function MinimapIconPreview({ icon, className }: MinimapIconPreviewProps) {
  const bundled = findBundledIcon(icon.iconName);
  const state = useBundledSprite(bundled);
  if (state.status === 'ready')
    return (
      <span className={cn('inline-flex shrink-0', className)}>
        <IconCanvas sprite={state.sprite} icon={icon} />
      </span>
    );
  const side = Math.min(64, Math.max(12, icon.iconSize ?? 32));
  const failed = bundled === undefined || state.status === 'error';
  return (
    <span
      role="img"
      aria-label={iconDescription(icon)}
      title={failed ? `${iconDescription(icon)} (not bundled here, no preview)` : iconDescription(icon)}
      className={cn('inline-block shrink-0 rounded-sm', failed && 'border border-dashed border-neutral-500', className)}
      style={{ width: side, height: side }}
    />
  );
}
