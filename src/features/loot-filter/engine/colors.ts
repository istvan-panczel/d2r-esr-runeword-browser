/** The `ÿc` colour codes from the guide's "Color codes" pages, and the game's label colour per quality. */
import type { LabelColor, QualityName } from './types.ts';

export interface ColorCode {
  /** The character after `ÿc`. */
  readonly code: string;
  readonly name: string;
  /** The colour as the guide lists it; see the note on N–V. */
  readonly rgb: readonly [number, number, number];
  /** True when `rgb` is a preview approximation the guide does not give. */
  readonly approximate: boolean;
  readonly usedFor: string;
}

const code = (c: string, name: string, rgb: readonly [number, number, number], usedFor = '', approximate = false): ColorCode => ({
  code: c,
  name,
  rgb,
  approximate,
  usedFor,
});

/**
 * ÿc0 to ÿcV in ASCII order. 0 to < are the classic palette (HD draws its own shades of them); = to M
 * are fixed in the game exe. N to V are chat colours with ESR's `color-codes-2x-letters` patch, which
 * keeps the 2.x letters (stock 3.3 shifts them one letter: N light gold, O turquoise, …). The guide
 * gives no RGB for N to V, so those values are approximations for the preview only.
 */
export const COLOR_CODES: readonly ColorCode[] = [
  code('0', 'white', [255, 255, 255], 'plain text, normal items'),
  code('1', 'red', [255, 77, 77], 'broken items, warnings'),
  code('2', 'green', [0, 255, 0], 'set items (tooltips)'),
  code('3', 'blue', [105, 105, 255], 'magic items (tooltips)'),
  code('4', 'gold', [199, 179, 119], 'unique items (tooltips)'),
  code('5', 'gray', [105, 105, 105], 'socketed and ethereal items (tooltips)'),
  code('6', 'black', [0, 0, 0]),
  code('7', 'tan', [208, 194, 125]),
  code('8', 'orange', [255, 168, 0], 'crafted items (tooltips)'),
  code('9', 'yellow', [255, 255, 100], 'rare items (tooltips)'),
  code(':', 'dark green', [0, 128, 0], 'tempered items (tooltips)'),
  code(';', 'purple', [174, 0, 255]),
  code('<', 'green', [0, 200, 0]),
  code('=', 'white', [240, 240, 240], 'plain item labels'),
  code('>', 'gold', [199, 179, 119], 'quest item labels'),
  code('?', 'yellow', [255, 255, 100], 'rare labels'),
  code('@', 'orange', [255, 168, 0], 'crafted labels'),
  code('A', 'dark green', [0, 128, 0], 'tempered labels'),
  code('B', 'blue', [110, 110, 255], 'magic labels'),
  code('C', 'green', [0, 252, 0], 'set labels'),
  code('D', 'gold', [199, 179, 119], 'unique labels'),
  code('E', 'white', [240, 240, 240], 'health potion labels'),
  code('F', 'white', [240, 240, 240], 'mana potion labels'),
  code('G', 'white', [240, 240, 240], 'rejuvenation potion labels'),
  code('H', 'white', [240, 240, 240], 'gold labels'),
  code('I', 'gray', [99, 99, 99], 'ethereal labels'),
  code('J', 'orange', [255, 168, 0], 'rune labels'),
  code('K', 'gray', [99, 99, 99], 'socketed labels'),
  code('L', 'orange', [255, 168, 0], 'event item labels'),
  code('M', 'black', [0, 0, 1], 'desecrated (draws black)'),
  code('N', 'turquoise', [64, 224, 208], 'chat', true),
  code('O', 'pink', [255, 135, 200], 'chat', true),
  code('P', 'light blue', [140, 190, 255], 'chat', true),
  code('Q', 'green', [0, 200, 0], 'chat', true),
  code('R', 'yellow', [255, 255, 100], 'chat', true),
  code('S', 'dark red', [160, 0, 0], 'chat', true),
  code('T', 'sky blue', [100, 200, 255], 'chat', true),
  code('U', 'red', [255, 77, 77], 'chat', true),
  code('V', 'red', [255, 0, 0], 'chat', true),
];

const BY_CODE = new Map(COLOR_CODES.map((entry) => [entry.code, entry]));

/** The table entry for a code given as `'4'` or `'ÿc4'`. */
export function findColorCode(colorCode: string): ColorCode | undefined {
  return BY_CODE.get(colorCode.startsWith('ÿc') ? colorCode.slice(2) : colorCode);
}

/** The RGB of a code given as `'4'` or `'ÿc4'`, or undefined for an unknown code. */
export function colorCodeRgb(colorCode: string): readonly [number, number, number] | undefined {
  return findColorCode(colorCode)?.rgb;
}

/** A label colour as CSS, as the game draws it: the colour's own alpha, else `defaultAlpha` (0 to 255). */
export function labelRgba(color: LabelColor, defaultAlpha: number): string {
  const alpha = (color.length === 4 ? color[3] : defaultAlpha) / 255;
  return `rgba(${String(color[0])}, ${String(color[1])}, ${String(color[2])}, ${String(alpha)})`;
}

/** The label colour code the game uses per quality, as the full `ÿcX` string (the form `qualityColors` takes). */
export const DEFAULT_QUALITY_COLORS: Readonly<Record<QualityName, string>> = {
  inferior: 'ÿc=',
  normal: 'ÿc=',
  superior: 'ÿc=',
  magic: 'ÿcB',
  set: 'ÿcC',
  rare: 'ÿc?',
  unique: 'ÿcD',
  crafted: 'ÿc@',
  tempered: 'ÿcA',
};
