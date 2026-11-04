import { describe, expect, it } from 'vitest';
import { variantIndexFromParam, variantParamValue } from './variantParam';

describe('variantIndexFromParam', () => {
  it('maps a 1-based value in range to its index', () => {
    expect(variantIndexFromParam('1', 3)).toBe(0);
    expect(variantIndexFromParam('3', 3)).toBe(2);
  });

  it('falls back to the first variant for missing, malformed or out-of-range values', () => {
    for (const raw of [null, '', '0', '4', '-1', '2.5', 'abc', ' 2', '1e1']) {
      expect(variantIndexFromParam(raw, 3)).toBe(0);
    }
  });
});

describe('variantParamValue', () => {
  it('omits the parameter for the first variant', () => {
    expect(variantParamValue(0)).toBeNull();
    expect(variantParamValue(1)).toBe('2');
    expect(variantParamValue(9)).toBe('10');
  });

  it('round-trips through variantIndexFromParam', () => {
    for (let index = 1; index < 5; index++) {
      expect(variantIndexFromParam(variantParamValue(index), 5)).toBe(index);
    }
  });
});
