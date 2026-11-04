import { describe, expect, it } from 'vitest';
import { DOT_R, placeLabel, route, segmentHitsBox, viaLabelPoint } from './geometry';

describe('route', () => {
  it('draws aligned and exactly diagonal pairs as one segment', () => {
    expect(route({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(route({ x: 0, y: 0 }, { x: 50, y: 50 })).toHaveLength(2);
  });

  it('puts the straight segment first by default and the 45° one first on request', () => {
    expect(route({ x: 0, y: 0 }, { x: 124, y: 88 })).toEqual([
      { x: 0, y: 0 },
      { x: 36, y: 0 },
      { x: 124, y: 88 },
    ]);
    expect(route({ x: 0, y: 0 }, { x: 124, y: 88 }, 'diagonal-first')).toEqual([
      { x: 0, y: 0 },
      { x: 88, y: 88 },
      { x: 124, y: 88 },
    ]);
  });
});

describe('segmentHitsBox', () => {
  const box = { x: 10, y: 10, w: 20, h: 10 };
  it('detects crossing, inside and missing segments', () => {
    expect(
      segmentHitsBox(
        [
          { x: 0, y: 15 },
          { x: 40, y: 15 },
        ],
        box
      )
    ).toBe(true);
    expect(
      segmentHitsBox(
        [
          { x: 12, y: 12 },
          { x: 14, y: 14 },
        ],
        box
      )
    ).toBe(true);
    expect(
      segmentHitsBox(
        [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
        box
      )
    ).toBe(false);
    expect(
      segmentHitsBox(
        [
          { x: 0, y: 40 },
          { x: 40, y: 30 },
        ],
        box
      )
    ).toBe(false);
  });
});

describe('placeLabel', () => {
  const dot = { x: 100, y: 100 };
  const obstacles = { segments: [], dots: [dot], boxes: [], width: 400 };

  it('puts the label below the dot when nothing is in the way', () => {
    const box = placeLabel([dot], ['Blood Moor'], obstacles, false);
    expect(box.y).toBeGreaterThan(dot.y + DOT_R);
    expect(box.x + box.w / 2).toBeCloseTo(dot.x);
  });

  it('moves the label aside of an edge leaving the dot downwards', () => {
    const down = [dot, { x: 100, y: 200 }] as const;
    const box = placeLabel([dot], ['Black Marsh'], { ...obstacles, segments: [down] }, false);
    expect(box.x).toBeGreaterThan(dot.x);
    expect(segmentHitsBox(down, box)).toBe(false);
  });
});

describe('viaLabelPoint', () => {
  it('skips segments too short for the text', () => {
    expect(
      viaLabelPoint(
        [
          { x: 0, y: 0 },
          { x: 60, y: 0 },
        ],
        'Horadric Orifice (true tomb)'
      )
    ).toBeUndefined();
    expect(
      viaLabelPoint(
        [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
        ],
        'Red portal'
      )
    ).toEqual({ x: 150, y: -5 });
  });

  it('puts the text beside a vertical segment', () => {
    const at = viaLabelPoint(
      [
        { x: 0, y: 0 },
        { x: 0, y: 88 },
      ],
      'Cow Portal'
    );
    expect(at?.x).toBeGreaterThan(0);
  });
});
