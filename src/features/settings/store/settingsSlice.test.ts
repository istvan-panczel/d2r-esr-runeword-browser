import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE_WIDTH_STORAGE_KEY, isPageWidthMode } from '../constants/pageWidth';
import { RULE_VIEW_STORAGE_KEY, isRuleViewMode } from '../constants/ruleView';

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

describe('settingsSlice rule view', () => {
  it('defaults to basic when nothing (or an unknown value) is stored', async () => {
    const empty = await loadSlice();
    expect(empty.default(undefined, { type: '@@INIT' }).ruleView).toBe('basic');

    for (const stored of ['expert', 'Advanced', '', 'toString']) {
      localStorage.setItem(RULE_VIEW_STORAGE_KEY, stored);
      const slice = await loadSlice();
      expect(slice.default(undefined, { type: '@@INIT' }).ruleView).toBe('basic');
    }
  });

  it('restores a stored view', async () => {
    for (const stored of ['basic', 'advanced'] as const) {
      localStorage.setItem(RULE_VIEW_STORAGE_KEY, stored);
      const slice = await loadSlice();
      expect(slice.default(undefined, { type: '@@INIT' }).ruleView).toBe(stored);
    }
  });

  it('sets and persists the view, and the selector reads it', async () => {
    const slice = await loadSlice();
    let state = slice.default(undefined, { type: '@@INIT' });
    state = slice.default(state, slice.setRuleView('advanced'));
    expect(state.ruleView).toBe('advanced');
    expect(localStorage.getItem(RULE_VIEW_STORAGE_KEY)).toBe('advanced');
    expect(slice.selectRuleView({ settings: state } as Parameters<typeof slice.selectRuleView>[0])).toBe('advanced');

    state = slice.default(state, slice.setRuleView('basic'));
    expect(state.ruleView).toBe('basic');
    expect(localStorage.getItem(RULE_VIEW_STORAGE_KEY)).toBe('basic');
  });

  it('falls back to basic and still switches when its storage throws', async () => {
    const realGetItem = Storage.prototype.getItem;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === RULE_VIEW_STORAGE_KEY) throw new Error('blocked');
      return realGetItem.call(this, key);
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const slice = await loadSlice();
      let state = slice.default(undefined, { type: '@@INIT' });
      expect(state.ruleView).toBe('basic');
      state = slice.default(state, slice.setRuleView('advanced'));
      expect(state.ruleView).toBe('advanced');
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe('isRuleViewMode', () => {
  it('accepts the two views only', () => {
    expect(isRuleViewMode('basic')).toBe(true);
    expect(isRuleViewMode('advanced')).toBe(true);
    expect(isRuleViewMode('expert')).toBe(false);
    expect(isRuleViewMode(null)).toBe(false);
  });
});
