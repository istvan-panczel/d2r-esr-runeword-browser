import { COLOR_CODES, DEFAULT_QUALITY_COLORS, colorCodeRgb, findColorCode } from './colors.ts';
import { QUALITIES } from './types.ts';

describe('colour codes', () => {
  it('lists ÿc0 to ÿcV in ASCII order', () => {
    const codes = COLOR_CODES.map((entry) => entry.code).join('');
    expect(codes).toBe('0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUV');
  });

  it('has the RGB values of the 3.3 guide', () => {
    expect(colorCodeRgb('3')).toEqual([110, 110, 255]);
    expect(findColorCode('M')).toMatchObject({ name: 'light purple', rgb: [192, 128, 242], usedFor: 'desecrated labels' });
    expect(colorCodeRgb('N')).toEqual([6, 165, 221]);
    expect(colorCodeRgb('S')).toEqual([208, 62, 62]);
    expect(colorCodeRgb('V')).toEqual([255, 0, 0]);
  });

  it('looks colours up by code or full prefix', () => {
    expect(colorCodeRgb('4')).toEqual([199, 179, 119]);
    expect(colorCodeRgb('ÿc;')).toEqual([174, 0, 255]);
    expect(colorCodeRgb('W')).toBeUndefined();
    expect(findColorCode('ÿcM')?.usedFor).toMatch(/desecrated/);
  });

  it('has a known label colour for every quality', () => {
    for (const quality of QUALITIES) expect(findColorCode(DEFAULT_QUALITY_COLORS[quality])).toBeDefined();
    expect(DEFAULT_QUALITY_COLORS.unique).toBe('ÿcD');
  });
});
