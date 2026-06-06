import { describe, expect, it } from 'vitest';
import { GEM_FILTER_OPTION_CLASS, GEM_FILTER_OPTIONS_GRID_CLASS, GEM_FILTER_ROW_CLASS } from './filterLayout';

describe('gemword filter layout classes', () => {
  it('uses fixed label and equal-width option grid columns for aligned gem checkboxes', () => {
    expect(GEM_FILTER_ROW_CLASS).toContain('md:grid-cols-[7rem_1fr]');
    expect(GEM_FILTER_OPTIONS_GRID_CLASS).toContain('grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]');
    expect(GEM_FILTER_OPTION_CLASS).toContain('grid-cols-[1rem_0.75rem_minmax(0,1fr)]');
  });
});
