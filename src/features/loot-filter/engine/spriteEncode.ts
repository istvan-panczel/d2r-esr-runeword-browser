/**
 * Encoder for single-frame D2R HD `.sprite` files, the minimap icon format of a loot filter's `icons` folder (the
 * decoder is `sprite.ts`). It writes exactly the 40-byte header of Sully's icons, which is also the header the loot
 * filter plugin writes for the copy it hands the game (from the plugin's disassembly, v1.5.3):
 *
 * | offset | type | value                                                       |
 * | ------ | ---- | ----------------------------------------------------------- |
 * | 0      | char | `SpA1` (the plugin rejects any other magic, `SPa1` too)      |
 * | 4      | u16  | 31, the version (the plugin rejects any other)              |
 * | 6      | u16  | the frame width (= width for one frame)                     |
 * | 8      | u32  | width                                                       |
 * | 12     | u32  | height                                                      |
 * | 16     | u32  | 0                                                           |
 * | 20     | u32  | 1, the frame count                                          |
 * | 24     | u32  | 0                                                           |
 * | 28     | u32  | 0                                                           |
 * | 32     | u32  | width × height × 4, the pixel byte count                    |
 * | 36     | u32  | 4, the bytes per pixel                                      |
 *
 * then `width × height` pixels, row by row from the top, 4 bytes each in RGBA order with straight (not premultiplied)
 * alpha, and nothing after them. The plugin reads only the magic, the version, width, height and frame count, and checks
 * that the file holds the pixels; the game's own sprites have 0 or these values at 32 and 36.
 */

export interface SpriteImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, straight alpha, row by row from the top: `width × height × 4` bytes. */
  readonly rgba: Uint8Array | Uint8ClampedArray;
}

export const SPRITE_HEADER_SIZE = 40;
const MAGIC = [0x53, 0x70, 0x41, 0x31]; // "SpA1"
const VERSION = 31;
/** The plugin refuses a wider or taller sprite ("its header does not match its pixels"). */
export const SPRITE_MAX_WIDTH = 8192;
export const SPRITE_MAX_HEIGHT = 4096;

export function encodeSprite({ width, height, rgba }: SpriteImage): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`A sprite needs a positive whole width and height, got ${String(width)}×${String(height)}`);
  }
  if (width > SPRITE_MAX_WIDTH || height > SPRITE_MAX_HEIGHT) {
    throw new Error(
      `The plugin takes sprites up to ${String(SPRITE_MAX_WIDTH)}×${String(SPRITE_MAX_HEIGHT)}, got ${String(width)}×${String(height)}`
    );
  }
  const pixelBytes = width * height * 4;
  if (rgba.length !== pixelBytes) {
    throw new Error(`${String(width)}×${String(height)} RGBA needs ${String(pixelBytes)} bytes, got ${String(rgba.length)}`);
  }
  const bytes = new Uint8Array(SPRITE_HEADER_SIZE + pixelBytes);
  const view = new DataView(bytes.buffer);
  bytes.set(MAGIC, 0);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, width, true);
  view.setUint32(8, width, true);
  view.setUint32(12, height, true);
  view.setUint32(20, 1, true);
  view.setUint32(32, pixelBytes, true);
  view.setUint32(36, 4, true);
  bytes.set(rgba, SPRITE_HEADER_SIZE);
  return bytes;
}
