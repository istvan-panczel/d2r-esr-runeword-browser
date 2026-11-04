import { describe, expect, it } from 'vitest';
import { variantIndexFromParam, variantParamValue, withVariantParam } from './variantParam';

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

describe('withVariantParam', () => {
  it('adds the 1-based parameter, and none for the first variant', () => {
    expect(withVariantParam('/build/abc', 0)).toBe('/build/abc');
    expect(withVariantParam('/build/abc', 2)).toBe('/build/abc?variant=3');
    expect(withVariantParam('/builds/abc/edit', 1)).toBe('/builds/abc/edit?variant=2');
  });

  it('round-trips through variantIndexFromParam', () => {
    for (let index = 0; index < 5; index++) {
      const search = new URL(withVariantParam('/build/abc', index), 'https://example.test').searchParams;
      expect(variantIndexFromParam(search.get('variant'), 5)).toBe(index);
    }
  });
});
