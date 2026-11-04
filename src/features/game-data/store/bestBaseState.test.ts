import { afterEach, describe, expect, it } from 'vitest';
import reducer, {
  DEFAULT_BEST_BASE_OPTIONS,
  setBestBaseRuneword,
  setEthereal,
  setIncludeUnusable,
  setTxtKeyOverride,
  updateCharacter,
} from './gameDataSlice';
import { CHARACTER_STORAGE_KEY, DEFAULT_CHARACTER, isCharacter, patchCharacter } from './character';
import { decodeBestBaseParams, encodeBestBaseParams, hasBestBaseParams } from './bestBaseUrl';

const initial = reducer(undefined, { type: '@@INIT' });

afterEach(() => {
  localStorage.clear();
});

describe('gameDataSlice character + best base', () => {
  it('starts with the defaults when nothing is stored', () => {
    expect(initial.character).toEqual(DEFAULT_CHARACTER);
    expect(initial.bestBase).toEqual(DEFAULT_BEST_BASE_OPTIONS);
  });

  it('merges, clamps and persists the character', () => {
    let state = reducer(initial, updateCharacter({ cls: 'pal', level: 150 }));
    state = reducer(state, updateCharacter({ str: -5, dex: 77.6 }));
    expect(state.character).toEqual({ cls: 'pal', level: 110, str: 0, dex: 78 });
    expect(JSON.parse(localStorage.getItem(CHARACTER_STORAGE_KEY) ?? 'null')).toEqual(state.character);
  });

  it('sets the page toggles', () => {
    let state = reducer(initial, setIncludeUnusable(true));
    state = reducer(state, setEthereal(true));
    expect(state.bestBase).toMatchObject({ includeUnusable: true, ethereal: true });
  });

  it('clears the manual txt pick only when the selected runeword changes', () => {
    let state = reducer(initial, setBestBaseRuneword({ name: 'Spirit', variant: 1 }));
    state = reducer(state, setTxtKeyOverride('Runeword123'));
    state = reducer(state, setBestBaseRuneword({ name: 'Spirit', variant: 1 }));
    expect(state.bestBase.txtKeyOverride).toBe('Runeword123');
    state = reducer(state, setBestBaseRuneword({ name: 'Spirit', variant: 2 }));
    expect(state.bestBase).toMatchObject({ selected: { name: 'Spirit', variant: 2 }, txtKeyOverride: null });
  });
});

describe('character helpers', () => {
  it('validates persisted characters', () => {
    expect(isCharacter(DEFAULT_CHARACTER)).toBe(true);
    expect(isCharacter({ cls: 'war', level: 1, str: 0, dex: 999 })).toBe(true);
    expect(isCharacter({ cls: 'xyz', level: 1, str: 0, dex: 0 })).toBe(false);
    expect(isCharacter({ cls: 'any', level: 0, str: 0, dex: 0 })).toBe(false);
    expect(isCharacter({ cls: 'any', level: 50, str: 1000, dex: 0 })).toBe(false);
    expect(isCharacter({ cls: 'any', level: 50.5, str: 0, dex: 0 })).toBe(false);
    expect(isCharacter({ cls: 'any', level: 50 })).toBe(false);
    expect(isCharacter(null)).toBe(false);
    expect(isCharacter('x')).toBe(false);
  });

  it('patches with clamping', () => {
    expect(patchCharacter(DEFAULT_CHARACTER, { level: 0, dex: 1234 })).toEqual({ ...DEFAULT_CHARACTER, level: 1, dex: 999 });
  });
});

describe('best base URL params', () => {
  it('decodes runeword, variant and character fields', () => {
    const params = new URLSearchParams('rw=Call%20to%20Arms&v=2&cls=bar&lvl=60&str=150&dex=0');
    expect(hasBestBaseParams(params)).toBe(true);
    expect(decodeBestBaseParams(params)).toEqual({
      selected: { name: 'Call to Arms', variant: 2 },
      character: { cls: 'bar', level: 60, str: 150, dex: 0 },
    });
  });

  it('defaults the variant to 1 and drops invalid values', () => {
    const params = new URLSearchParams('rw=Spirit&v=x&cls=none&lvl=111&str=-1&dex=abc');
    expect(decodeBestBaseParams(params)).toEqual({ selected: { name: 'Spirit', variant: 1 }, character: {} });
    expect(decodeBestBaseParams(new URLSearchParams('lvl=30'))).toEqual({ selected: null, character: { level: 30 } });
    expect(hasBestBaseParams(new URLSearchParams('search=x'))).toBe(false);
  });

  it('encodes the selection and non-default character fields', () => {
    expect(encodeBestBaseParams(null, DEFAULT_CHARACTER).toString()).toBe('');
    const params = encodeBestBaseParams({ name: 'Call to Arms', variant: 1 }, { ...DEFAULT_CHARACTER, cls: 'pal', level: 40 });
    expect(params.toString()).toBe('rw=Call+to+Arms&v=1&cls=pal&lvl=40');
    expect(decodeBestBaseParams(params)).toEqual({
      selected: { name: 'Call to Arms', variant: 1 },
      character: { cls: 'pal', level: 40 },
    });
  });
});
