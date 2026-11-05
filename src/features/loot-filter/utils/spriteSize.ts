/** The sizes the minimap icon previews draw a sprite at (`components/SpriteCanvas.tsx` and its users). */

interface Size {
  readonly width: number;
  readonly height: number;
}

/** The plugin's range for `iconSize` (the longer side in minimap pixels). */
export const ICON_SIZE_MIN = 4;
export const ICON_SIZE_MAX = 256;

/** `size` scaled so its longer side is `longer`, keeping its proportions (each side at least 1 px, whole pixels). */
function scaledTo(size: Size, longer: number): Size {
  const scale = longer / Math.max(size.width, size.height);
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}

/**
 * The drawn size of a sprite for `iconSize` as on the minimap: its longer side `iconSize` (4 to 256; absent = the
 * file's own size), keeping its proportions. `max` caps the longer side for a tight spot (a list row), so a 128 px
 * icon does not blow it up; the preview then says the real size in its tooltip.
 */
export function spriteDrawSize(sprite: Size, iconSize: number | undefined, max?: number): Size {
  const own = Math.max(sprite.width, sprite.height);
  const target = iconSize === undefined ? own : Math.min(ICON_SIZE_MAX, Math.max(ICON_SIZE_MIN, iconSize));
  return scaledTo(sprite, max === undefined ? target : Math.min(target, max));
}

/** The size that fits a sprite into a square box of `side` pixels, keeping its proportions (a picker thumbnail). */
export function spriteFitSize(sprite: Size, side: number): Size {
  return scaledTo(sprite, side);
}
