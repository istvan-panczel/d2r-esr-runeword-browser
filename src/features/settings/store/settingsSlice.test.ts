import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE_WIDTH_STORAGE_KEY, isPageWidthMode } from '../constants/pageWidth';

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

/** A fresh slice module, so its initial state is read from the current localStorage. */
async function loadSlice() {
  vi.resetModules();
  return import('./settingsSlice');
}

describe('settingsSlice page width', () => {
  it('defaults to standard when nothing (or an unknown value) is stored', async () => {
    const empty = await loadSlice();
    expect(empty.default(undefined, { type: '@@INIT' }).pageWidth).toBe('standard');

    for (const stored of ['huge', 'Wide', '', 'toString', 'constructor']) {
      localStorage.setItem(PAGE_WIDTH_STORAGE_KEY, stored);
      const slice = await loadSlice();
      expect(slice.default(undefined, { type: '@@INIT' }).pageWidth).toBe('standard');
    }
  });

  it('restores a stored mode', async () => {
    for (const stored of ['standard', 'wide', 'full'] as const) {
      localStorage.setItem(PAGE_WIDTH_STORAGE_KEY, stored);
      const slice = await loadSlice();
      expect(slice.default(undefined, { type: '@@INIT' }).pageWidth).toBe(stored);
    }
  });

  it('sets and persists the mode, and the selector reads it', async () => {
    const slice = await loadSlice();
    let state = slice.default(undefined, { type: '@@INIT' });
    state = slice.default(state, slice.setPageWidth('full'));
    expect(state.pageWidth).toBe('full');
    expect(localStorage.getItem(PAGE_WIDTH_STORAGE_KEY)).toBe('full');
    expect(slice.selectPageWidth({ settings: state } as Parameters<typeof slice.selectPageWidth>[0])).toBe('full');

    state = slice.default(state, slice.setPageWidth('wide'));
    expect(state.pageWidth).toBe('wide');
    expect(localStorage.getItem(PAGE_WIDTH_STORAGE_KEY)).toBe('wide');
  });
});

describe('isPageWidthMode', () => {
  it('accepts the three modes only', () => {
    expect(isPageWidthMode('standard')).toBe(true);
    expect(isPageWidthMode('wide')).toBe(true);
    expect(isPageWidthMode('full')).toBe(true);
    expect(isPageWidthMode('narrow')).toBe(false);
    expect(isPageWidthMode(null)).toBe(false);
    expect(isPageWidthMode(1)).toBe(false);
  });
});
