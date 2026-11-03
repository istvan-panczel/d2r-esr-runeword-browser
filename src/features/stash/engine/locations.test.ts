import { describe, expect, it } from 'vitest';
import { compareLocations, formatLocation, locationKey, pageOf, pagesOf, type StashLocation } from './locations';

const at = (section: number, x: number, y: number, tabType: StashLocation['tabType'] = 'normal'): StashLocation => ({
  section,
  tabType,
  x,
  y,
});

describe('stash locations', () => {
  it('numbers pages, rows and columns from 1; the materials tab has no page', () => {
    expect(pageOf(at(0, 0, 0))).toBe(1);
    expect(pageOf(at(1000, 0, 0, 'advanced'))).toBeNull();
    expect(formatLocation(at(9, 15, 0))).toBe('Page 10 · row 1, col 16');
    expect(formatLocation(at(1000, 9, 4, 'advanced'))).toBe('Materials tab');
  });

  it('sorts by page, row, column and lists the distinct pages', () => {
    const locations = [at(2, 0, 1), at(0, 5, 0), at(2, 3, 0), at(1000, 0, 0, 'advanced'), at(0, 1, 0)];
    expect([...locations].sort(compareLocations).map(locationKey)).toEqual(['0:1:0', '0:5:0', '2:3:0', '2:0:1', '1000:0:0']);
    expect(pagesOf(locations)).toEqual([1, 3]);
  });
});
