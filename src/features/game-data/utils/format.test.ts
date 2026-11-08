import { describe, expect, it } from 'vitest';
import { formatArmorRunWalk } from './format';

describe('formatArmorRunWalk', () => {
  it('shows a positive armor speed as a penalty and a negative one as a bonus', () => {
    expect(formatArmorRunWalk(5)).toBe('−5%');
    expect(formatArmorRunWalk(-10)).toBe('+10%');
  });
});
