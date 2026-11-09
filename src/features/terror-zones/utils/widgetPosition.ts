/**
 * Where the floating terror zone widget shows. Its bottom offset above the app's fixed bottom bars is shared with
 * ScrollToTopButton: `floatingLift` / `FLOATING_BOTTOM_CLASS` in `@/components/floatingElements`.
 */
/** The schedule page: the widget would only repeat it (and cover its list) */
export const TERROR_ZONES_PATH = '/terror-zones';

export function isWidgetHidden(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === TERROR_ZONES_PATH;
}
