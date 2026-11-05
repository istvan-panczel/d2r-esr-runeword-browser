import { useEffect, useRef, type CanvasHTMLAttributes } from 'react';
import type { DecodedSprite } from '../engine/sprite';
import type { LabelColor } from '../engine/types';
import { tintSprite } from '../utils/tintSprite';

interface SpriteCanvasProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'width' | 'height' | 'color'> {
  readonly sprite: DecodedSprite;
  /** The icon's tint (`tintSprite`: RGB × colour / 255, alpha × colour[3] / 255). */
  readonly color?: LabelColor;
  /** The drawn size in CSS pixels (see `utils/spriteSize.ts`). */
  readonly width: number;
  readonly height: number;
  /** Canvas pixels per CSS pixel: 2 keeps a small thumbnail sharp on high-density screens. */
  readonly density?: number;
}

/**
 * A decoded sprite's first frame, tinted and scaled onto a canvas of `width` × `height`. The one drawing routine of
 * every minimap icon preview: the icon field's `SpritePreview`, the pickers' `IconThumb` and `MinimapIconPreview`.
 */
export function SpriteCanvas({ sprite, color, width, height, density = 1, style, ...rest }: SpriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelWidth = Math.max(1, Math.round(width * density));
  const pixelHeight = Math.max(1, Math.round(height * density));

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const source = document.createElement('canvas');
    source.width = sprite.width;
    source.height = sprite.height;
    const sourceContext = source.getContext('2d');
    if (!canvas || !context || !sourceContext) return;
    const image = new ImageData(sprite.width, sprite.height);
    image.data.set(tintSprite(sprite.rgba, color));
    sourceContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, [sprite, color, pixelWidth, pixelHeight]);

  return (
    <canvas ref={canvasRef} width={pixelWidth} height={pixelHeight} style={density === 1 ? style : { width, height, ...style }} {...rest} />
  );
}
