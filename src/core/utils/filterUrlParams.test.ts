import { describe, expect, it } from 'vitest';
import {
  FILTER_URL_PARAM_KEYS,
  MAX_REQ_LEVEL_RANGE,
  SOCKET_COUNT_RANGE,
  appendCommonFilterParams,
  appendSelectionParam,
  decodeSelectionParam,
  parseBoundedIntParam,
} from './filterUrlParams';

describe('appendSelectionParam', () => {
  it('omits the param when everything is selected (absent param = all selected)', () => {
    const params = new URLSearchParams();
    appendSelectionParam(params, FILTER_URL_PARAM_KEYS.GEMS, { 'Perfect Ruby': true, 'Perfect Topaz': true });

    expect(params.get(FILTER_URL_PARAM_KEYS.GEMS)).toBeNull();
  });

  it('lists only the selected keys when a subset is selected', () => {
    const params = new URLSearchParams();
    appendSelectionParam(params, FILTER_URL_PARAM_KEYS.ITEMS, { Helm: true, Belt: false, Boots: true });

    expect(params.get(FILTER_URL_PARAM_KEYS.ITEMS)).toBe('Helm,Boots');
  });

  it('omits the param when the selection is empty or nothing is selected', () => {
    const params = new URLSearchParams();
    appendSelectionParam(params, FILTER_URL_PARAM_KEYS.ITEMS, {});
    appendSelectionParam(params, FILTER_URL_PARAM_KEYS.GEMS, { Helm: false });

    expect(params.toString()).toBe('');
  });
});

describe('appendCommonFilterParams', () => {
  it('serializes the populated filters and skips defaults', () => {
    const params = new URLSearchParams();
    appendCommonFilterParams(params, {
      searchText: 'fire resist',
      socketCount: 3,
      maxReqLevel: null,
      selectedItemTypes: { Helm: true, Belt: false },
    });

    expect(params.get(FILTER_URL_PARAM_KEYS.SEARCH)).toBe('fire resist');
    expect(params.get(FILTER_URL_PARAM_KEYS.SOCKETS)).toBe('3');
    expect(params.get(FILTER_URL_PARAM_KEYS.MAXLVL)).toBeNull();
    expect(params.get(FILTER_URL_PARAM_KEYS.ITEMS)).toBe('Helm');
  });
});

describe('decodeSelectionParam', () => {
  const allKeys = ['Helm', 'Belt', 'Boots'];

  it('selects only the listed keys when the param is present', () => {
    expect(decodeSelectionParam(allKeys, 'Helm,Boots')).toEqual({ Helm: true, Belt: false, Boots: true });
  });

  it('selects everything when the param is absent', () => {
    expect(decodeSelectionParam(allKeys, null)).toEqual({ Helm: true, Belt: true, Boots: true });
  });

  it('falls back to the stored selection when the param is absent', () => {
    expect(decodeSelectionParam(allKeys, null, { Belt: false })).toEqual({ Helm: true, Belt: false, Boots: true });
  });

  it('ignores the stored selection when the param is present', () => {
    expect(decodeSelectionParam(allKeys, 'Belt', { Belt: false })).toEqual({ Helm: false, Belt: true, Boots: false });
  });

  it('round-trips with appendSelectionParam', () => {
    const selection = { Helm: true, Belt: false, Boots: true };
    const params = new URLSearchParams();
    appendSelectionParam(params, FILTER_URL_PARAM_KEYS.ITEMS, selection);

    expect(decodeSelectionParam(allKeys, params.get(FILTER_URL_PARAM_KEYS.ITEMS))).toEqual(selection);
  });
});

describe('parseBoundedIntParam', () => {
  it('parses values inside the range', () => {
    expect(parseBoundedIntParam('3', SOCKET_COUNT_RANGE)).toBe(3);
    expect(parseBoundedIntParam('999', MAX_REQ_LEVEL_RANGE)).toBe(999);
  });

  it('rejects missing, malformed, and out-of-range values', () => {
    expect(parseBoundedIntParam(null, SOCKET_COUNT_RANGE)).toBeNull();
    expect(parseBoundedIntParam('abc', SOCKET_COUNT_RANGE)).toBeNull();
    expect(parseBoundedIntParam('0', SOCKET_COUNT_RANGE)).toBeNull();
    expect(parseBoundedIntParam('7', SOCKET_COUNT_RANGE)).toBeNull();
  });
});
