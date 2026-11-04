import type { PageWidthMode } from './types';

/** localStorage key of the Page width setting (not read by the pre-paint script in index.html: the width is read synchronously into the initial Redux state, so the first render already has it). */
export const PAGE_WIDTH_STORAGE_KEY = 'pageWidth';

export const DEFAULT_PAGE_WIDTH: PageWidthMode = 'standard';

/** The modes in menu order, with the label and the short description shown in the settings drawer and the header menu. */
export const PAGE_WIDTH_OPTIONS: readonly { readonly value: PageWidthMode; readonly label: string; readonly description: string }[] = [
  { value: 'standard', label: 'Standard', description: '1280 px' },
  { value: 'wide', label: 'Wide', description: '1920 px' },
  { value: 'full', label: 'Full', description: 'Full screen' },
];

export function isPageWidthMode(value: unknown): value is PageWidthMode {
  return PAGE_WIDTH_OPTIONS.some((option) => option.value === value);
}
