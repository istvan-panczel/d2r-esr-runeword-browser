import type { PageWidthMode } from '@/features/settings';

/*
 * The Tailwind classes behind the Page width setting (Settings drawer + the header's width menu). Every class is a
 * literal string here so Tailwind's scanner sees it. Widths are rem based like `max-w-7xl`, so they grow with the
 * Text size setting (the px figures are at the default 16 px).
 */

/**
 * The app frame: the header row and `<main>` (both add their own `px-4` / `p-4` gutters inside this width).
 * `standard` is today's Tailwind `container` (stepped 640 … 1536 px), so the default look is unchanged: the header row
 * spans the 1536 px container while the 1280 px pages sit centred inside it. `wide` is the 1920 px page plus the two
 * 1rem gutters, so the header's logo and icons line up with the page edges; `full` is the whole window.
 */
export const APP_FRAME_CLASS: Record<PageWidthMode, string> = {
  standard: 'container mx-auto',
  wide: 'mx-auto w-full max-w-[122rem]',
  full: 'w-full',
};

/** `PageShell width="wide"` (the browser pages): 1280 px, 1920 px (`--container-9xl`, see index.css) or no cap. */
export const PAGE_WIDE_CLASS: Record<PageWidthMode, string> = {
  standard: 'max-w-7xl',
  wide: 'max-w-9xl',
  full: 'max-w-none',
};

/** The same page widths from the `lg` breakpoint only, for a page that is a narrow column below `lg` (the guide overview). */
export const PAGE_WIDE_LG_CLASS: Record<PageWidthMode, string> = {
  standard: 'lg:max-w-7xl',
  wide: 'lg:max-w-9xl',
  full: 'lg:max-w-none',
};

/**
 * Page widths of `PageShell`. `wide` is the width of every browser page (lists, Game Data, Builds, Loot filters, guide
 * notes) and follows the Page width setting: Standard 1280 px (three result cards per row, no edge-to-edge stretch on
 * large monitors), Wide 1920 px, Full no cap (the side gutters of `<main>` only). `narrow` is a reading column that
 * stays narrow in every mode (it was the old guide spine screen's; no page uses it now).
 */
export type PageWidth = 'wide' | 'narrow';

/** The max-width class of a `PageShell`. */
export function pageShellWidthClass(width: PageWidth, mode: PageWidthMode): string {
  return width === 'narrow' ? 'max-w-2xl' : PAGE_WIDE_CLASS[mode];
}
