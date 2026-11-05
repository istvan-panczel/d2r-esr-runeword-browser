import { cn } from '@/lib/utils';
import type { LabelColor } from '../../engine/types';
import { useBundledSprite } from '../../hooks/useBundledSprite';
import { findBundledIcon } from '../../utils/bundledAssets';
import { spriteFitSize } from '../../utils/spriteSize';
import { SpriteCanvas } from '../SpriteCanvas';

interface IconThumbProps {
  /** An `iconName`; a name that is not bundled draws a dashed placeholder. */
  readonly iconName: string;
  /** The box's side in CSS pixels. */
  readonly size?: number;
  readonly color?: LabelColor;
  readonly className?: string;
}

/**
 * A small bundled minimap icon fitted into a dark tile, for the icon picker (`MinimapIconPreview` draws an icon at its
 * minimap size instead). The sprite is fetched and decoded once per name for the page (`useBundledSprite`), so a grid
 * of them only costs the first open.
 */
export function IconThumb({ iconName, size = 32, color, className }: IconThumbProps) {
  const name = findBundledIcon(iconName);
  const state = useBundledSprite(name);
  const fitted = state.status === 'ready' ? spriteFitSize(state.sprite, size) : undefined;

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-sm bg-neutral-950', className)}
      style={{ width: size + 8, height: size + 8 }}
      aria-hidden
    >
      {name === undefined && (
        <span className="rounded-sm border border-dashed border-neutral-500" style={{ width: size * 0.7, height: size * 0.7 }} />
      )}
      {/* Drawn at twice the box for sharp edges on high-density screens. */}
      {state.status === 'ready' && fitted !== undefined && (
        <SpriteCanvas sprite={state.sprite} color={color} width={fitted.width} height={fitted.height} density={2} />
      )}
    </span>
  );
}
