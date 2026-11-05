import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LabelColor } from '../../engine/types';
import { useBundledSprite } from '../../hooks/useBundledSprite';
import { findBundledIcon } from '../../utils/bundledAssets';
import { tintSprite } from '../../utils/tintSprite';

interface IconThumbProps {
  /** An `iconName`; a name that is not bundled draws a dashed placeholder. */
  readonly iconName: string;
  /** The box's side in CSS pixels. */
  readonly size?: number;
  readonly color?: LabelColor;
  readonly className?: string;
}

/**
 * A small bundled minimap icon on a dark tile, for pickers. The sprite is fetched and decoded once per name for the
 * page (`useBundledSprite`), so a grid of them only costs the first open.
 */
export function IconThumb({ iconName, size = 32, color, className }: IconThumbProps) {
  const name = findBundledIcon(iconName);
  const state = useBundledSprite(name);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sprite = state.status === 'ready' ? state.sprite : undefined;
  // Drawn at twice the box for sharp edges on high-density screens.
  const pixels = size * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || sprite === undefined) return;
    const source = document.createElement('canvas');
    source.width = sprite.width;
    source.height = sprite.height;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) return;
    const image = new ImageData(sprite.width, sprite.height);
    image.data.set(tintSprite(sprite.rgba, color));
    sourceContext.putImageData(image, 0, 0);
    const scale = pixels / Math.max(sprite.width, sprite.height);
    const width = sprite.width * scale;
    const height = sprite.height * scale;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.drawImage(source, (pixels - width) / 2, (pixels - height) / 2, width, height);
  }, [sprite, color, pixels]);

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-sm bg-neutral-950', className)}
      style={{ width: size + 8, height: size + 8 }}
      aria-hidden
    >
      {name === undefined ? (
        <span className="rounded-sm border border-dashed border-neutral-500" style={{ width: size * 0.7, height: size * 0.7 }} />
      ) : (
        <canvas ref={canvasRef} width={pixels} height={pixels} style={{ width: size, height: size }} />
      )}
    </span>
  );
}
