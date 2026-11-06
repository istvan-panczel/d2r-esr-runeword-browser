/**
 * Where the floating terror zone widget sits above the bottom-left corner. Fixed bottom elements of the app it must not
 * cover:
 * - the builds form's sticky Save / Cancel bar (`/builds/new`, `/builds/:id/edit`; its buttons sit bottom-left);
 * - the guide note's "Next on your path" bar, fixed to the bottom of the viewport below `sm` (`/guide/:slug`).
 * ScrollToTopButton and the toasts are bottom-right; dialogs and sheets are z-50, above the widget (z-40).
 */
/** The schedule page: the widget would only repeat it (and cover its list) */
export const TERROR_ZONES_PATH = '/terror-zones';

export function isWidgetHidden(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === TERROR_ZONES_PATH;
}

export type WidgetLift = 'none' | 'formBar' | 'phoneBar';

const BUILD_FORM_PATH = /^\/builds\/(?:new|[^/]+\/edit)\/?$/;
const GUIDE_NOTE_PATH = /^\/guide\/(?!map\/?$)[^/]+\/?$/;

export function widgetLift(pathname: string): WidgetLift {
  if (BUILD_FORM_PATH.test(pathname)) return 'formBar';
  if (GUIDE_NOTE_PATH.test(pathname)) return 'phoneBar';
  return 'none';
}

/** The widget's bottom offset classes per lift (safe-area aware: the home indicator on phones). */
export const WIDGET_BOTTOM_CLASS: Readonly<Record<WidgetLift, string>> = {
  none: 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]',
  formBar: 'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
  phoneBar: 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]',
};
