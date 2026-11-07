import { describe, expect, it } from 'vitest';
import reducer, {
  DEFAULT_BASE_FILTERS,
  clearBaseTypes,
  resetBaseFilters,
  setBaseClassOnly,
  setBaseFilters,
  setBaseMaxReqLvl,
  setBaseMinSockets,
  setBaseSearch,
  setBaseSort,
  setBaseSortDir,
  setBaseTypeGroup,
  setBaseView,
  toggleBaseKind,
  toggleBaseTier,
  toggleBaseType,
  type BaseFilters,
} from './gameDataSlice';
import { decodeBaseFilters, encodeBaseFilters, hasBaseFilterParams } from './baseFiltersUrl';

const initial = reducer(undefined, { type: '@@INIT' });

describe('gameDataSlice', () => {
  it('starts with the default base filters', () => {
    expect(initial.bases).toEqual(DEFAULT_BASE_FILTERS);
  });

  it('sets scalar filters', () => {
    let state = reducer(initial, setBaseSearch('axe'));
    state = reducer(state, setBaseMinSockets(4));
    state = reducer(state, setBaseMaxReqLvl(30));
    state = reducer(state, setBaseClassOnly('pal'));
    state = reducer(state, setBaseSort('dmg'));
    state = reducer(state, setBaseSortDir('desc'));
    expect(state.bases).toEqual({
      ...DEFAULT_BASE_FILTERS,
      search: 'axe',
      minSockets: 4,
      maxReqLvl: 30,
      classOnly: 'pal',
      sort: 'dmg',
      sortDir: 'desc',
    });
  });

  it('toggles kinds, tiers and types', () => {
    let state = reducer(initial, toggleBaseKind('armor'));
    state = reducer(state, toggleBaseKind('weapon'));
    state = reducer(state, toggleBaseKind('armor'));
    expect(state.bases.kinds).toEqual(['weapon']);

    state = reducer(state, toggleBaseTier('elite'));
    expect(state.bases.tiers).toEqual(['elite']);

    state = reducer(state, toggleBaseType('axe'));
    state = reducer(state, toggleBaseType('swor'));
    state = reducer(state, toggleBaseType('axe'));
    expect(state.bases.types).toEqual(['swor']);
  });

  it('selects and deselects a type group without duplicates', () => {
    let state = reducer(initial, toggleBaseType('axe'));
    state = reducer(state, setBaseTypeGroup({ codes: ['axe', 'swor', 'mace'], selected: true }));
    expect([...state.bases.types].sort()).toEqual(['axe', 'mace', 'swor']);
    state = reducer(state, toggleBaseType('ring'));
    state = reducer(state, setBaseTypeGroup({ codes: ['axe', 'swor', 'mace'], selected: false }));
    expect(state.bases.types).toEqual(['ring']);
    state = reducer(state, clearBaseTypes());
    expect(state.bases.types).toEqual([]);
  });

  it('switches the view and keeps it (and the sort) across a reset', () => {
    let state = reducer(initial, setBaseSort('dmg'));
    state = reducer(state, setBaseView('families'));
    expect(state.bases).toEqual({ ...DEFAULT_BASE_FILTERS, sort: 'dmg', view: 'families' });
    state = reducer(state, setBaseView('cards'));
    expect(state.bases.sort).toBe('dmg');
    state = reducer(state, setBaseView('families'));
    state = reducer(state, resetBaseFilters());
    expect(state.bases).toEqual({ ...DEFAULT_BASE_FILTERS, view: 'families' });
  });

  it('replaces and resets the whole filter state', () => {
    const filters: BaseFilters = { ...DEFAULT_BASE_FILTERS, search: 'x', kinds: ['misc'] };
    let state = reducer(initial, setBaseFilters(filters));
    expect(state.bases).toEqual(filters);
    state = reducer(state, resetBaseFilters());
    expect(state.bases).toEqual(DEFAULT_BASE_FILTERS);
  });
});

describe('base filter URL params', () => {
  it('encodes nothing for the defaults', () => {
    expect(encodeBaseFilters(DEFAULT_BASE_FILTERS).toString()).toBe('');
  });

  it('round-trips every filter', () => {
    const filters: BaseFilters = {
      search: '"war axe"',
      kinds: ['weapon', 'armor'],
      tiers: ['elite'],
      types: ['axe', 'mele'],
      codes: ['am2', 'am7'],
      minSockets: 4,
      maxReqLvl: 60,
      classOnly: 'none',
      sort: 'dmg',
      sortDir: 'desc',
      view: 'families',
    };
    const params = encodeBaseFilters(filters);
    expect(params.get('sort')).toBe('-dmg');
    expect(params.get('kind')).toBe('weapon,armor');
    expect(params.get('sockets')).toBe('4');
    expect(params.get('maxlvl')).toBe('60');
    expect(params.get('view')).toBe('families');
    expect(decodeBaseFilters(new URLSearchParams(params.toString()))).toEqual(filters);
  });

  it('encodes ascending non-default sort without a prefix', () => {
    expect(encodeBaseFilters({ ...DEFAULT_BASE_FILTERS, sort: 'name' }).get('sort')).toBe('name');
    expect(encodeBaseFilters({ ...DEFAULT_BASE_FILTERS, sortDir: 'desc' }).get('sort')).toBe('-qlvl');
  });

  it('falls back to defaults for invalid values', () => {
    const params = new URLSearchParams('kind=weapon,bogus,weapon&tier=legendary&cls=xyz&sort=-nope&sockets=9&maxlvl=abc');
    expect(decodeBaseFilters(params)).toEqual({ ...DEFAULT_BASE_FILTERS, kinds: ['weapon'] });
  });

  it('decodes class codes and drops unknown type codes when a type set is given', () => {
    const params = new URLSearchParams('cls=war&type=axe,nope');
    expect(decodeBaseFilters(params, new Set(['axe'])).types).toEqual(['axe']);
    expect(decodeBaseFilters(params).classOnly).toBe('war');
  });

  it('encodes the families view as view=families and omits the cards default', () => {
    expect(encodeBaseFilters({ ...DEFAULT_BASE_FILTERS, view: 'families' }).toString()).toBe('view=families');
    expect(encodeBaseFilters({ ...DEFAULT_BASE_FILTERS, view: 'cards' }).has('view')).toBe(false);
    expect(decodeBaseFilters(new URLSearchParams('view=families'))).toEqual({ ...DEFAULT_BASE_FILTERS, view: 'families' });
    expect(decodeBaseFilters(new URLSearchParams('view=grid')).view).toBe('cards');
    expect(hasBaseFilterParams(new URLSearchParams('view=families'))).toBe(true);
  });

  it('detects whether any bases param is present', () => {
    expect(hasBaseFilterParams(new URLSearchParams('type=axe'))).toBe(true);
    expect(hasBaseFilterParams(new URLSearchParams('foo=1'))).toBe(false);
  });
});
