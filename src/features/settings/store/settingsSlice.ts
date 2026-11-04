import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { RootState } from '@/core/store/store';
import type { Theme, TextSize, PageWidthMode } from '../constants/types';
import { TEXT_SIZE_MAP } from '../constants/textSize';
import { DEFAULT_PAGE_WIDTH, PAGE_WIDTH_STORAGE_KEY, isPageWidthMode } from '../constants/pageWidth';

export type { Theme, TextSize, PageWidthMode };
export { TEXT_SIZE_MAP };

interface SettingsState {
  readonly theme: Theme;
  readonly textSize: TextSize;
  readonly useDiabloFont: boolean;
  readonly pageWidth: PageWidthMode;
  readonly isDrawerOpen: boolean;
}

// These localStorage keys/values are also read by the pre-paint inline script in index.html - keep in sync.
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('theme');
  return stored === 'light' ? 'light' : 'dark';
};

const getInitialTextSize = (): TextSize => {
  if (typeof window === 'undefined') return 'normal';
  const stored = localStorage.getItem('textSize');
  if (stored && stored in TEXT_SIZE_MAP) {
    return stored as TextSize;
  }
  return 'normal';
};

const getInitialDiabloFont = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('useDiabloFont') === 'true';
};

// Applied by the layout components (AppLayout, Header, PageShell) on render, so it has no pre-paint counterpart.
const getInitialPageWidth = (): PageWidthMode => {
  if (typeof window === 'undefined') return DEFAULT_PAGE_WIDTH;
  const stored = localStorage.getItem(PAGE_WIDTH_STORAGE_KEY);
  return isPageWidthMode(stored) ? stored : DEFAULT_PAGE_WIDTH;
};

const initialState: SettingsState = {
  theme: getInitialTheme(),
  textSize: getInitialTextSize(),
  useDiabloFont: getInitialDiabloFont(),
  pageWidth: getInitialPageWidth(),
  isDrawerOpen: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
      document.documentElement.classList.toggle('dark', action.payload === 'dark');
    },
    setTextSize(state, action: PayloadAction<TextSize>) {
      state.textSize = action.payload;
      localStorage.setItem('textSize', action.payload);
      document.documentElement.style.fontSize = `${String(TEXT_SIZE_MAP[action.payload])}px`;
    },
    setUseDiabloFont(state, action: PayloadAction<boolean>) {
      state.useDiabloFont = action.payload;
      localStorage.setItem('useDiabloFont', String(action.payload));
      document.documentElement.classList.toggle('diablo-font', action.payload);
    },
    setPageWidth(state, action: PayloadAction<PageWidthMode>) {
      state.pageWidth = action.payload;
      localStorage.setItem(PAGE_WIDTH_STORAGE_KEY, action.payload);
    },
    openDrawer(state) {
      state.isDrawerOpen = true;
    },
    closeDrawer(state) {
      state.isDrawerOpen = false;
    },
  },
});

export const { setTheme, setTextSize, setUseDiabloFont, setPageWidth, openDrawer, closeDrawer } = settingsSlice.actions;
export default settingsSlice.reducer;

// Selectors
const selectSettingsState = (state: RootState) => state.settings;

export const selectTheme = createSelector([selectSettingsState], (settings) => settings.theme);

export const selectTextSize = createSelector([selectSettingsState], (settings) => settings.textSize);

export const selectUseDiabloFont = createSelector([selectSettingsState], (settings) => settings.useDiabloFont);

export const selectPageWidth = createSelector([selectSettingsState], (settings) => settings.pageWidth);

export const selectIsDrawerOpen = createSelector([selectSettingsState], (settings) => settings.isDrawerOpen);
