import { describe, expect, it } from 'vitest';
import reducer, {
  DEFAULT_AFFIX_FILTERS,
  clearAffixTypes,
  resetAffixFilters,
  setAffixBase,
  setAffixClass,
  setAffixFilters,
  setAffixIlvl,
  setAffixIncludeAutomagic,
  setAffixMaxLvl,
  setAffixMinLvl,
  setAffixQuality,
  setAffixRareOnly,
  setAffixSearch,
  setAffixSort,
  setAffixSortDir,
  setAffixSuperiorType,
  setAffixView,
  toggleAffixKind,
  toggleAffixType,
  type AffixFilters,
} from './gameDataSlice';
import { decodeAffixFilters, encodeAffixFilters, hasAffixFilterParams } from './affixFiltersUrl';

const initial = reducer(undefined, { type: '@@INIT' });

describe('gameDataSlice affix filters', () => {
  it('starts with the defaults', () => {
    expect(initial.affixes).toEqual(DEFAULT_AFFIX_FILTERS);
  });

  it('sets scalar filters and clamps levels to 1-99', () => {
    let state = reducer(initial, setAffixSearch('life'));
    state = reducer(state, setAffixRareOnly(true));
    state = reducer(state, setAffixMinLvl(0));
    state = reducer(state, setAffixMaxLvl(150));
    state = reducer(state, setAffixClass('sor'));
    state = reducer(state, setAffixBase('xui'));
    state = reducer(state, setAffixIlvl(85.4));
    state = reducer(state, setAffixQuality('rare'));
    state = reducer(state, setAffixIncludeAutomagic(false));
    state = reducer(state, setAffixSort('freq'));
    state = reducer(state, setAffixSortDir('desc'));
    expect(state.affixes).toEqual({
      ...DEFAULT_AFFIX_FILTERS,
      search: 'life',
      rareOnly: true,
      minLvl: 1,
      maxLvl: 99,
      cls: 'sor',
      base: 'xui',
      ilvl: 85,
      quality: 'rare',
      includeAutomagic: false,
      sort: 'freq',
      sortDir: 'desc',
    });
    expect(reducer(state, setAffixMinLvl(null)).affixes.minLvl).toBeNull();
    expect(reducer(state, setAffixIlvl(0)).affixes.ilvl).toBe(1);
  });

  it('toggles kinds and types', () => {
    let state = reducer(initial, toggleAffixKind('p'));
    state = reducer(state, toggleAffixKind('a'));
    state = reducer(state, toggleAffixKind('p'));
    expect(state.affixes.kinds).toEqual(['a']);
    state = reducer(state, toggleAffixType('ring'));
    state = reducer(state, toggleAffixType('amul'));
    state = reducer(state, toggleAffixType('ring'));
    expect(state.affixes.types).toEqual(['amul']);
    expect(reducer(state, clearAffixTypes()).affixes.types).toEqual([]);
  });

  it('replaces the state and resets filters but keeps the what-can-roll settings', () => {
    const filters: AffixFilters = { ...DEFAULT_AFFIX_FILTERS, search: 'x', base: 'xui', ilvl: 50, quality: 'rare', rareOnly: true };
    let state = reducer(initial, setAffixFilters(filters));
    expect(state.affixes).toEqual(filters);
    state = reducer(state, resetAffixFilters());
    expect(state.affixes).toEqual({ ...DEFAULT_AFFIX_FILTERS, base: 'xui', ilvl: 50, quality: 'rare' });
  });

  it('switches to the superior view, filters its item type and keeps the view on reset', () => {
    let state = reducer(initial, setAffixView('superior'));
    state = reducer(state, setAffixSuperiorType('abow'));
    state = reducer(state, setAffixSearch('skills'));
    expect(state.affixes).toEqual({ ...DEFAULT_AFFIX_FILTERS, view: 'superior', superiorType: 'abow', search: 'skills' });
    expect(reducer(state, resetAffixFilters()).affixes).toEqual({ ...DEFAULT_AFFIX_FILTERS, view: 'superior' });
  });
});

describe('affix URL params', () => {
  it('encodes nothing for the defaults', () => {
    expect(encodeAffixFilters(DEFAULT_AFFIX_FILTERS).toString()).toBe('');
    expect(hasAffixFilterParams(new URLSearchParams('foo=1'))).toBe(false);
  });

  it('round-trips every filter', () => {
    const filters: AffixFilters = {
      view: 'superior',
      search: '"cold damage"',
      kinds: ['p', 's'],
      rareOnly: true,
      minLvl: 10,
      maxLvl: 60,
      cls: 'none',
      types: ['ring', 'amul'],
      base: 'xui',
      ilvl: 85,
      quality: 'rare',
      includeAutomagic: false,
      sort: 'group',
      sortDir: 'desc',
      superiorType: 'abow',
    };
    const params = encodeAffixFilters(filters);
    expect(params.get('view')).toBe('superior');
    expect(params.get('stype')).toBe('abow');
    expect(params.get('aff')).toBe('p,s');
    expect(params.get('rare')).toBe('1');
    expect(params.get('minlvl')).toBe('10');
    expect(params.get('maxlvl')).toBe('60');
    expect(params.get('q')).toBe('rare');
    expect(params.get('auto')).toBe('0');
    expect(params.get('sort')).toBe('-group');
    expect(hasAffixFilterParams(params)).toBe(true);
    expect(decodeAffixFilters(params)).toEqual(filters);
  });

  it('drops invalid and unknown values', () => {
    const params = new URLSearchParams(
      'aff=p,x,p&rare=yes&minlvl=0&maxlvl=100&cls=xyz&type=ring,zzz&base=nope&ilvl=120&q=epic&auto=2&sort=-bogus&view=magic&stype=zzz'
    );
    expect(decodeAffixFilters(params, { types: new Set(['ring']), bases: new Set(['xui']) })).toEqual({
      ...DEFAULT_AFFIX_FILTERS,
      kinds: ['p'],
      types: ['ring'],
    });
  });

  it('decodes a what-can-roll link', () => {
    const decoded = decodeAffixFilters(new URLSearchParams('base=xui&ilvl=85'), { bases: new Set(['xui']) });
    expect(decoded).toEqual({ ...DEFAULT_AFFIX_FILTERS, base: 'xui', ilvl: 85 });
  });
});
