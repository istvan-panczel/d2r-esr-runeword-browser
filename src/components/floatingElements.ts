/*
 * What the app's two floating elements share, both mounted once by AppLayout: the terror zone widget (bottom-left) and
 * ScrollToTopButton (bottom-right; the toasts are bottom-right too). Both are z-40, so dialogs and sheets (z-50) cover
 * them. Every class is a literal string here so Tailwind's scanner sees it.
 */

/** The frosted glass of the round floating buttons: on an `outline` icon `Button`. */
export const FLOATING_GLASS_BUTTON_CLASS =
  'rounded-full shadow-lg backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-background/55';

/**
 * Fixed bottom elements of the app the floating elements must not cover (a new one belongs here):
 * - the builds form's sticky Save / Cancel bar (`/builds/new`, `/builds/:id/edit`);
 * - the guide note's "Next on your path" bar, fixed to the bottom of the viewport below `sm` (`/guide/:slug`).
 */
export type FloatingLift = 'none' | 'formBar' | 'phoneBar';

const BUILD_FORM_PATH = /^\/builds\/(?:new|[^/]+\/edit)\/?$/;
const GUIDE_NOTE_PATH = /^\/guide\/(?!map\/?$)[^/]+\/?$/;

export function floatingLift(pathname: string): FloatingLift {
  if (BUILD_FORM_PATH.test(pathname)) return 'formBar';
  if (GUIDE_NOTE_PATH.test(pathname)) return 'phoneBar';
  return 'none';
}

/** The bottom offset classes per lift (safe-area aware: the home indicator on phones). */
export const FLOATING_BOTTOM_CLASS: Readonly<Record<FloatingLift, string>> = {
  none: 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]',
  formBar: 'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
  phoneBar: 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]',
};
